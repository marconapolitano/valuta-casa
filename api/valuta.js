// Serverless function (Vercel): valuta un annuncio immobiliare vs OMI con Claude.
//
// Flusso: controlla password -> estrae dati annuncio (da URL o forniti a mano)
//         -> carica OMI zona -> chiama Claude API -> ritorna opinione.
//
// Secret richiesti (Vercel env): ANTHROPIC_API_KEY, APP_PASSWORD
// La API key NON è mai nel frontend.
// Implementazione divisa in api/_lib/* — qui resta solo l'orchestrazione HTTP.

import omiData from "../data/omi_roma_compatto.json" with { type: "json" };
import { deriveZoneNames } from "./_lib/zones.js";
import { estraiDaUrl, isPlanimetria } from "./_lib/extract.js";
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
    const { password, url, prezzo, mq, indirizzo, note, foto, descrizione } = req.body || {};

    if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD)
      return res.status(401).json({ error: "Password errata" });

    const ip = (req.headers["x-forwarded-for"] || "anon").split(",")[0];
    if (!rateOk(ip))
      return res.status(429).json({ error: `Limite ${LIMIT_PER_DAY}/giorno raggiunto` });

    // dati: da estensione (foto+descrizione già estratte dal browser reale),
    // da URL (scraping best-effort), o a mano.
    let dati = { url, prezzo, mq, indirizzo, note, descrizione,
      foto: Array.isArray(foto) ? foto.slice(0, 4) : undefined };
    // se l'estensione ha già mandato prezzo+mq+zona, NON serve aprire l'URL
    if (url && (!prezzo || !mq || !indirizzo)) {
      try {
        const e = await estraiDaUrl(url, ZONE_NAMES);
        dati = { ...e, ...dati, prezzo: prezzo || e.prezzo, mq: mq || e.mq, indirizzo: indirizzo || e.indirizzo };
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

    const opinioneGrezza = await chiediClaude(dati);
    // Claude ritorna solo la ZONA; il BACKEND calcola sconto/rendimento (matematica esatta — vedi _lib/valuation.js)
    const { opinione, zonaCode, sconto, esito, rendimento, omi, eurMq } =
      calcolaValutazione(opinioneGrezza, omiData, dati.prezzo, dati.mq);

    // conteggio immagini (foto vs planimetrie) per il badge
    const ft = (dati.foto || []).map((f) => (typeof f === "string" ? { plan: isPlanimetria(f) } : f));
    const nPlan = ft.filter((f) => f && f.plan).length;
    const datiOut = { indirizzo: dati.indirizzo, prezzo: dati.prezzo, mq: dati.mq,
      eurMq, omi, nPlan,
      zona: zonaCode, zonaNome: zonaCode && omiData.zone[zonaCode] ? omiData.zone[zonaCode].nome : null,
      nFoto: (dati.foto || []).length, sconto, esito, rendimento };
    return res.status(200).json({ opinione, dati: datiOut });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
