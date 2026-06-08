import { OMI_PROMPT_BLOCK } from "./omi-prompt.js";
import { isPlanimetria } from "./extract.js";

const MODEL = "claude-haiku-4-5-20251001"; // economico, sufficiente

const SYSTEM_PROMPT = `Sei un analista immobiliare per Roma. Valuti un annuncio rispetto ai valori OMI ufficiali (Agenzia Entrate, II sem 2025).
Dati OMI per zona (codice=nome|vendita €/mq min-max|affitto €/mq/mese):
${OMI_PROMPT_BLOCK}

Compito:
1. Dall'indirizzo, scegli la zona OMI più corretta usando i nomi e la tua conoscenza di Roma. Se incerto fra due, dillo e usa la più prudente.
2. NON calcolare tu lo sconto: il sistema lo calcola con la matematica esatta. Tu commenta i valori OMI della zona scelta e il €/mq dell'annuncio.
3. Rendimento: usa loc_med della zona; ETICHETTA "LORDO" + riga "netto stimato ~metà (dopo cedolare 21%, sfitto, spese, tasse)".
4. SEGNALA SEMPRE i bias: villa/casa/mq>300 (OMI è €/mq appartamenti, terreno distorce); seminterrato (vale meno); agenzia (l'utente cerca privati); affittato/nuda proprietà.
5. IMMAGINI: le ricevi etichettate (🗺️ PLANIMETRIA o 📷 foto).
   - FOTO → stato reale (ristrutturato/da rifare), luminosità/esposizione, finiture, red flag (umidità, lavori).
   - PLANIMETRIA → taglio e distribuzione (vani passanti vs indipendenti, bagni ciechi, cucina abitabile/cucinotto, doppi affacci, ingresso), quanti veri vani, se i mq dichiarati sembrano coerenti col disegno (segnala se sospetti mq "gonfiati" con balconi/terrazzi conteggiati). La planimetria pesa molto sul valore reale.
   - Se manca la planimetria, dillo: "planimetria non disponibile, taglio da verificare".
6. Verdetto onesto in 3 righe: affare sì/no, cosa verificare.
Sii sintetico. Non inventare dati mancanti.

IMPORTANTISSIMO: inizia la risposta con UNA riga in questo formato esatto, poi vai a capo:
ZONA: <codice zona OMI scelto, es. C51>
Questa riga è per il sistema (calcolerà lo sconto), NON ripeterla nell'analisi.`;

export async function chiediClaude(dati) {
  // normalizza foto: accetta sia stringhe (vecchio) sia {url,plan} (nuovo)
  const foto = (dati.foto || []).slice(0, 5).map((f) =>
    typeof f === "string" ? { url: f, plan: isPlanimetria(f) } : { url: f.url, plan: !!f.plan }
  ).filter((f) => f.url);

  const userText = `Annuncio:
- Titolo/indirizzo: ${dati.indirizzo || dati.titolo || "?"}
- Prezzo: ${dati.prezzo ? dati.prezzo + " €" : "?"}
- Superficie: ${dati.mq ? dati.mq + " mq" : "?"}
- Descrizione: ${dati.descrizione || "—"}
- Note extra: ${dati.note || "—"}
${dati.url ? "- Fonte: " + dati.url : ""}
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
      model: useVision ? "claude-sonnet-4-6" : MODEL, // Sonnet per leggere foto/planimetrie
      max_tokens: useVision ? 1400 : 900,
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
