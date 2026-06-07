// Serverless function (Vercel): valuta un annuncio immobiliare vs OMI con Claude.
//
// Flusso: controlla password -> estrae dati annuncio (da URL o forniti a mano)
//         -> carica OMI zona -> chiama Claude API -> ritorna opinione.
//
// Secret richiesti (Vercel env): ANTHROPIC_API_KEY, APP_PASSWORD
// La API key NON è mai nel frontend.

import omiData from "../data/omi_roma_compatto.json" with { type: "json" };

const MODEL = "claude-haiku-4-5-20251001"; // economico, sufficiente
const MAX_TOKENS = 900;

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

// estrae prezzo/mq/indirizzo da una pagina Idealista (best-effort).
async function estraiDaUrl(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36" },
  });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  const html = await r.text();
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const titolo = (html.match(/<title>([^<]+)</i) || [])[1] || "";
  const prezzo = (() => {
    const m = text.match(/([\d.]+)\s*€/) || text.match(/"price"\s*:\s*"?(\d+)/i);
    return m ? Number(m[1].replace(/\./g, "")) : null;
  })();
  const mq = (() => {
    const m = text.match(/(\d{2,4})\s*m²/) || text.match(/(\d{2,4})\s*m2/i);
    return m ? Number(m[1]) : null;
  })();
  // indirizzo dal titolo: "... in Via X, 12, Zona, Roma ..."
  const indir = (titolo.match(/in\s+(Via|Viale|Vicolo|Piazza|Largo|Corso|Lungotevere)[^,]*(?:,\s*\d+)?/i) || [])[0] || "";
  return { titolo: titolo.trim(), prezzo, mq, indirizzo: indir.replace(/^in\s+/i, "").trim() };
}

function omiCompatto() {
  // testo compatto delle zone per il prompt (nome + range)
  return Object.entries(omiData.zone)
    .map(([z, e]) => `${z}=${e.nome}|${e.compr_min}-${e.compr_max}(med ${e.compr_med})|loc ${e.loc_min ?? "?"}-${e.loc_max ?? "?"}`)
    .join("\n");
}

async function chiediClaude(dati) {
  const sys = `Sei un analista immobiliare per Roma. Valuti un annuncio rispetto ai valori OMI ufficiali (Agenzia Entrate, II sem 2025).
Dati OMI per zona (codice=nome|vendita €/mq min-max(medio)|affitto €/mq/mese):
${omiCompatto()}

Compito:
1. Dall'indirizzo, scegli la zona OMI più corretta usando i nomi e la tua conoscenza di Roma. Se incerto fra due, dillo e usa la più prudente.
2. Calcola €/mq annuncio = prezzo/mq; sconto% = (medio_zona - €/mq)/medio_zona (positivo=sotto mercato); rendimento lordo = (loc_med*mq*12)/prezzo.
3. SEGNALA SEMPRE i bias: villa/casa/mq>300 (OMI è €/mq appartamenti, terreno distorce); seminterrato (vale meno); agenzia (l'utente cerca privati); affittato/nuda proprietà.
4. Verdetto onesto in 3 righe: affare sì/no, sconto reale, cosa verificare.
Sii sintetico. Non inventare dati mancanti: se mancano, dillo.`;

  const userMsg = `Annuncio:
- Titolo/indirizzo: ${dati.indirizzo || dati.titolo || "?"}
- Prezzo: ${dati.prezzo ? dati.prezzo + " €" : "?"}
- Superficie: ${dati.mq ? dati.mq + " mq" : "?"}
- Note extra: ${dati.note || "—"}
${dati.url ? "- Fonte: " + dati.url : ""}

Dammi la tua opinione.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: sys,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${t.slice(0, 200)}`);
  }
  const j = await resp.json();
  return j.content?.[0]?.text || "(nessuna risposta)";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { password, url, prezzo, mq, indirizzo, note } = req.body || {};

    if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD)
      return res.status(401).json({ error: "Password errata" });

    const ip = (req.headers["x-forwarded-for"] || "anon").split(",")[0];
    if (!rateOk(ip))
      return res.status(429).json({ error: `Limite ${LIMIT_PER_DAY}/giorno raggiunto` });

    // dati: da URL se dato, altrimenti a mano
    let dati = { url, prezzo, mq, indirizzo, note };
    if (url) {
      try {
        const e = await estraiDaUrl(url);
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

    const opinione = await chiediClaude(dati);
    return res.status(200).json({ opinione, dati });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
