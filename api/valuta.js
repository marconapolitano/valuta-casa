// Serverless function (Vercel): valuta un annuncio immobiliare vs OMI con Claude.
//
// Flusso: controlla password -> estrae dati annuncio (da estensione, URL o a mano)
//         -> geocoding best-effort (quartiere/coordinate) -> chiama Claude API
//         -> calcolo deterministico (benchmark/sconto/rendimento) -> risposta.
//
// Secret richiesti (Vercel env): ANTHROPIC_API_KEY, APP_PASSWORD
// La API key NON è mai nel frontend.
// Implementazione divisa in api/_lib/* — qui resta solo l'orchestrazione HTTP.

import omiData from "../data/omi_roma_compatto.json" with { type: "json" };
import { deriveZoneNames } from "./_lib/zones.js";
import { estraiDaUrl, isPlanimetria } from "./_lib/extract.js";
import { geocoda } from "./_lib/geo.js";
import { zonaDaCoordinate } from "./_lib/geozone.js";
import { chiediClaude } from "./_lib/claude.js";
import { calcolaValutazione } from "./_lib/valuation.js";

const ZONE_NAMES = deriveZoneNames(omiData);

// rate limit in-memory leggero (per istanza). Per "pochi fidati" basta.
const hits = new Map();
const LIMIT_PER_DAY = 30;

function rateOk(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${ip}|${today}`;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  return n <= LIMIT_PER_DAY;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { password, url, prezzo, mq, indirizzo, note, foto, descrizione,
      car, lat, lng, agenzia, uso, stato } = req.body || {};

    if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD)
      return res.status(401).json({ error: "Password errata" });

    const ip = (req.headers["x-forwarded-for"] || "anon").split(",")[0];
    if (!rateOk(ip))
      return res.status(429).json({ error: `Limite ${LIMIT_PER_DAY}/giorno raggiunto` });

    // dati: da estensione (foto+caratteristiche+coordinate già estratte dal
    // browser reale), da URL (scraping best-effort), o a mano.
    let dati = { url, prezzo, mq, indirizzo, note, descrizione,
      car: car || {}, lat, lng, agenzia: !!agenzia,
      foto: Array.isArray(foto) ? foto.slice(0, 6) : undefined };
    // se l'estensione ha già mandato prezzo+mq+zona, NON serve aprire l'URL
    if (url && (!prezzo || !mq || !indirizzo)) {
      try {
        const e = await estraiDaUrl(url, ZONE_NAMES);
        dati = { ...e, ...dati,
          prezzo: prezzo || e.prezzo, mq: mq || e.mq, indirizzo: indirizzo || e.indirizzo,
          car: { ...e.car, ...(car || {}) },
          lat: lat ?? e.lat, lng: lng ?? e.lng, quartiere: e.quartiere,
          foto: (dati.foto && dati.foto.length ? dati.foto : e.foto) };
      } catch (e) {
        // estrazione fallita: serve input a mano
        if (!prezzo || !mq)
          return res.status(422).json({
            error: "Non riesco ad aprire il link (Idealista blocca). Inserisci prezzo, mq e indirizzo a mano.",
          });
      }
    }
    if (!dati.prezzo || !dati.mq)
      return res.status(422).json({ error: "Servono almeno prezzo e mq." });

    // sanity check sui dati estratti: non blocca, AVVISA (l'estrazione
    // automatica può prendere il numero sbagliato — meglio dirlo che tacere)
    const avvisi = [];
    const eurMqGrezzo = Math.round(dati.prezzo / dati.mq);
    if (dati.prezzo < 30000) avvisi.push(`Prezzo molto basso (${dati.prezzo.toLocaleString("it-IT")} €): estratto male? Verifica sull'annuncio.`);
    if (dati.mq < 20 || dati.mq > 600) avvisi.push(`Superficie anomala (${dati.mq} m²): verifica sull'annuncio.`);
    if (eurMqGrezzo < 500 || eurMqGrezzo > 15000) avvisi.push(`${eurMqGrezzo.toLocaleString("it-IT")} €/m² è fuori da ogni zona di Roma: prezzo o m² quasi certamente sbagliati.`);

    // coordinate DEL PORTALE = posizione esatta dell'immobile → zona CERTA dai
    // perimetri ufficiali OMI (point-in-polygon, niente giudizio).
    dati.zonaCerta = dati.lat != null ? zonaDaCoordinate(dati.lat, dati.lng) : null;

    // geocoding best-effort: quartiere OSM + coordinate → zona OMI più precisa.
    // null su errore/timeout: la valutazione procede comunque.
    dati.geo = await geocoda({ lat: dati.lat, lng: dati.lng, indirizzo: dati.indirizzo });

    // il geocode di un indirizzo cade sull'asse stradale — e i confini OMI
    // corrono lungo le strade: zona solo SUGGERITA, Claude conferma o corregge.
    if (!dati.zonaCerta && dati.geo && dati.geo.lat != null)
      dati.zonaSuggerita = zonaDaCoordinate(dati.geo.lat, dati.geo.lng);

    const opinioneGrezza = await chiediClaude(dati);
    // Claude ritorna solo CLASSIFICAZIONI (zona/fiducia/stato); il BACKEND calcola
    // benchmark/sconto/rendimento (matematica esatta — vedi _lib/valuation.js)
    const v = calcolaValutazione(opinioneGrezza, omiData, {
      prezzo: dati.prezzo, mq: dati.mq, car: dati.car,
      uso, statoManuale: stato, agenzia: dati.agenzia, zonaCerta: dati.zonaCerta,
    });

    // conteggio immagini (foto vs planimetrie) per il badge
    const ft = (dati.foto || []).map((f) => (typeof f === "string" ? { plan: isPlanimetria(f) } : f));
    const nPlan = ft.filter((f) => f && f.plan).length;
    const datiOut = { indirizzo: dati.indirizzo, prezzo: dati.prezzo, mq: dati.mq,
      eurMq: v.eurMq, omi: v.omi, nPlan, nFoto: (dati.foto || []).length,
      zona: v.zonaCode, zonaNome: v.zonaCode && omiData.zone[v.zonaCode] ? omiData.zone[v.zonaCode].nome : null,
      fiducia: v.fiducia, zonaAlt: v.zonaAlt,
      zonaAltNome: v.zonaAlt && omiData.zone[v.zonaAlt] ? omiData.zone[v.zonaAlt].nome : null,
      quartiere: (dati.geo && dati.geo.quartiere) || dati.quartiere || null,
      stato: v.stato, benchmark: v.benchmark, aggiustamenti: v.aggiustamenti,
      sconto: v.sconto, scontoSuMed: v.scontoSuMed, esito: v.esito,
      rendimento: v.rendimento, car: dati.car, avvisi };
    return res.status(200).json({ opinione: v.opinione, dati: datiOut });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
