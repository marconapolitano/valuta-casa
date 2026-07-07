import { OMI_PROMPT_BLOCK } from "./omi-prompt.js";
import { isPlanimetria } from "./extract.js";

const MODEL_TEXT = "claude-haiku-4-5-20251001"; // economico, sufficiente senza immagini
const MODEL_VISION = "claude-sonnet-5";         // legge foto/planimetrie con giudizio

// Claude fa SOLO classificazioni (zona, fiducia, stato) + analisi qualitativa.
// I numeri (sconto, rendimento) li calcola valuation.js — vedi vincolo lì.
const SYSTEM_PROMPT = `Sei un analista immobiliare per Roma. Valuti un annuncio rispetto ai valori OMI ufficiali (Agenzia Entrate, II sem 2025).
Dati OMI per zona — ATTENZIONE: sono per stato conservativo NORMALE (codice=nome|vendita €/mq min-max|affitto €/mq/mese):
${OMI_PROMPT_BLOCK}

Compito:
1. ZONA: scegli la zona OMI corretta. Fonti in ordine di affidabilità: blocco GEO (quartiere OSM + coordinate GPS, quando presente — pesa più di tutto), indirizzo/microzona del portale, tua conoscenza di Roma. FIDUCIA: alta = GEO e nomi concordano; media = solo nomi/indirizzo; bassa = hai dovuto tirare a indovinare. Se indeciso fra due zone, metti la seconda in ZONA_ALT.
2. STATO: classifica lo stato REALE in ottimo (ristrutturato/nuovo) | normale (abitabile/buono) | da_ristrutturare. Fonti in ordine: FOTO (prevalgono sempre), caratteristiche dichiarate, descrizione. Se le foto contraddicono l'annuncio ("ristrutturato" ma foto anni '70), dillo esplicitamente e classifica dalle foto.
3. NON calcolare tu sconto/rendimento: il sistema li calcola con matematica esatta usando ZONA e STATO che dichiari (benchmark aggiustato per stato, rendimento netto con cedolare/IMU/sfitto). Tu commenta qualità, coerenza del prezzo, e ciò che il calcolo non vede.
4. SEGNALA SEMPRE i bias: villa/casa/mq>300 (OMI è €/mq appartamenti, terreno distorce); seminterrato; agenzia (l'utente cerca privati); affittato/nuda proprietà; asta; mq commerciali vs calpestabili.
5. IMMAGINI: le ricevi etichettate (🗺️ PLANIMETRIA o 📷 foto).
   - FOTO → stato reale, luminosità/esposizione, finiture, red flag (umidità, impianti datati, lavori nascosti).
   - PLANIMETRIA → taglio e distribuzione (vani passanti vs indipendenti, bagni ciechi, cucina abitabile/cucinotto, doppi affacci, ingresso), quanti veri vani, coerenza mq dichiarati col disegno (segnala mq "gonfiati" con balconi/terrazzi conteggiati). La planimetria pesa molto sul valore reale.
   - Se manca la planimetria, dillo: "planimetria non disponibile, taglio da verificare".
6. Verdetto onesto in 3 righe + cosa verificare PRIMA di fare un'offerta (rogito, condominio, difformità catastali, occupazione).
Sii sintetico. Non inventare dati mancanti.

IMPORTANTISSIMO: inizia la risposta con ESATTAMENTE queste 4 righe (sono per il sistema, NON ripeterle nell'analisi), poi riga vuota e l'analisi:
ZONA: <codice zona OMI, es. C51>
FIDUCIA: <alta|media|bassa>
ZONA_ALT: <codice oppure ->
STATO: <ottimo|normale|da_ristrutturare>`;

// blocco caratteristiche strutturate per il prompt (solo campi presenti)
function carBlock(car) {
  if (!car) return "";
  const label = {
    piano: "Piano", ascensore: "Ascensore", stato: "Stato dichiarato", anno: "Anno costruzione",
    classe: "Classe energetica", speseCondominio: "Spese condominio €/mese", bagni: "Bagni",
    locali: "Locali", terrazzo: "Terrazzo", balcone: "Balcone", box: "Box/posto auto",
  };
  const rows = Object.entries(car)
    .filter(([k, v]) => v != null && label[k])
    .map(([k, v]) => `  - ${label[k]}: ${v === true ? "sì" : v === false ? "no" : v}`);
  return rows.length ? `\nCaratteristiche dichiarate:\n${rows.join("\n")}` : "";
}

function geoBlock(geo, quartiere) {
  const bits = [];
  if (geo && geo.quartiere) bits.push(`quartiere OSM: ${geo.quartiere}`);
  if (quartiere && (!geo || geo.quartiere !== quartiere)) bits.push(`microzona portale: ${quartiere}`);
  if (geo && geo.municipio) bits.push(geo.municipio);
  if (geo && geo.via) bits.push(`via: ${geo.via}`);
  if (geo && geo.lat) bits.push(`coordinate: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
  return bits.length ? `\nGEO (geocoding verificato — fonte più affidabile per la zona):\n  ${bits.join("\n  ")}` : "";
}

export async function chiediClaude(dati) {
  // normalizza foto: accetta sia stringhe (vecchio) sia {url,plan} (nuovo)
  const foto = (dati.foto || []).slice(0, 6).map((f) =>
    typeof f === "string" ? { url: f, plan: isPlanimetria(f) } : { url: f.url, plan: !!f.plan }
  ).filter((f) => f.url);

  const userText = `Annuncio:
- Titolo/indirizzo: ${dati.indirizzo || dati.titolo || "?"}
- Prezzo: ${dati.prezzo ? dati.prezzo + " €" : "?"}
- Superficie: ${dati.mq ? dati.mq + " mq" : "?"}
- Venditore: ${dati.agenzia ? "agenzia" : "non specificato (possibile privato)"}
- Descrizione: ${dati.descrizione || "—"}
- Note extra: ${dati.note || "—"}
${dati.url ? "- Fonte: " + dati.url : ""}${carBlock(dati.car)}${geoBlock(dati.geo, dati.quartiere)}
${foto.length ? `\nAllego ${foto.length} immagini in quest'ordine:` : ""}${foto.map((f, i) => `\n  ${i + 1}. ${f.plan ? "🗺️ PLANIMETRIA (leggi i vani, il taglio, esposizione, doppi affacci, bagni ciechi, mq apparenti)" : "📷 foto immobile"}`).join("")}

Dammi la tua opinione.`;

  // costruisci content: testo + immagini (vision). Planimetrie già in testa.
  const content = [{ type: "text", text: userText }];
  for (const f of foto) {
    content.push({ type: "image", source: { type: "url", url: f.url } });
  }
  const useVision = foto.length > 0;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: useVision ? MODEL_VISION : MODEL_TEXT,
      max_tokens: useVision ? 1600 : 900,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${t.slice(0, 200)}`);
  }
  const j = await resp.json();
  return j.content?.[0]?.text || "(nessuna risposta)";
}
