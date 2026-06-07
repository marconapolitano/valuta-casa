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

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9",
  "Referer": "https://www.google.com/",
};

// nomi-zona OMI per scansione testo (universale, ogni portale)
const ZONE_NAMES = (() => {
  const set = new Set();
  for (const e of Object.values(omiData.zone)) {
    let n = e.nome.split("(")[0].replace(/^C\.STORICO:/i, "").trim();
    n.split(/[-\/]/).forEach((p) => { p = p.trim(); if (p.length >= 4 && !/^ROMA$/i.test(p) && !/^ZONA /i.test(p)) set.add(p); });
  }
  return [...set].sort((a, b) => b.length - a.length);
})();

async function fetchHtml(url) {
  // 1) diretto con header browser
  try {
    const r = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
    if (r.ok) { const h = await r.text(); if (h.length > 2000) return h; }
  } catch (e) {}
  // 2) reader proxy (best-effort, alcuni portali leggeri passano)
  try {
    const r = await fetch("https://r.jina.ai/" + url, { headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] } });
    if (r.ok) { const h = await r.text(); if (h.length > 800 && !/403|CAPTCHA/i.test(h.slice(0, 300))) return h; }
  } catch (e) {}
  throw new Error("blocked");
}

// estrae prezzo/mq/indirizzo/zona da una pagina annuncio (multi-portale, best-effort).
async function estraiDaUrl(url) {
  const html = await fetchHtml(url);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const titolo = (html.match(/<title>([^<]+)</i) || [])[1] || "";

  // JSON-LD
  let ldPrice = null, ldMq = null, ldAddr = "";
  try {
    const lds = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const blk of lds) {
      const jm = blk.match(/>([\s\S]*?)<\/script>/i); if (!jm) continue;
      let j; try { j = JSON.parse(jm[1]); } catch (e) { continue; }
      const arr = Array.isArray(j) ? j : (j["@graph"] || [j]);
      for (const o of arr) {
        if (!o) continue;
        const off = o.offers || (o.makesOffer && o.makesOffer[0]);
        if (off && off.price && !ldPrice) ldPrice = Number(String(off.price).replace(/\D/g, ""));
        if (o.floorSize && o.floorSize.value && !ldMq) ldMq = Number(String(o.floorSize.value).replace(/\D/g, ""));
        if (o.address && !ldAddr) ldAddr = typeof o.address === "string" ? o.address : [o.address.streetAddress, o.address.addressLocality].filter(Boolean).join(", ");
      }
    }
  } catch (e) {}

  const prezzo = ldPrice || (() => { const m = text.match(/([\d.]{4,})\s*€/) || text.match(/€\s*([\d.]{4,})/); return m ? Number(m[1].replace(/\./g, "")) : null; })();
  const mq = ldMq || (() => { const m = text.match(/(\d{2,4})\s*m(?:²|q\b|2\b)/i); return m ? Number(m[1]) : null; })();

  // zona: breadcrumb "Roma • ZONA •" o dizionario nomi-zona nel testo
  let zona = (text.match(/Roma\s*[•·›>]\s*([^•·›>]{3,40})\s*[•·›>]/i) || [])[1] || "";
  if (!zona) { const hay = text.toLowerCase(); for (const z of ZONE_NAMES) { if (hay.includes(z.toLowerCase())) { zona = z; break; } } }
  let indir = ldAddr || (titolo.match(/in\s+(Via|Viale|Vicolo|Piazza|Largo|Corso|Lungotevere)[^,—|]*/i) || [])[0] || "";
  indir = indir.replace(/^in\s+/i, "").trim();
  if (zona && indir.toLowerCase().indexOf(zona.toLowerCase()) < 0) indir = (indir ? indir + ", " : "") + zona;

  return { titolo: titolo.trim(), prezzo, mq, indirizzo: indir || zona, zona };
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
2. Calcola €/mq annuncio = prezzo/mq; sconto% = (medio_zona - €/mq)/medio_zona (positivo=sotto mercato); rendimento lordo = (loc_med*mq*12)/prezzo. ETICHETTA SEMPRE il rendimento come "LORDO" e aggiungi una riga: "netto stimato ~metà (dopo cedolare 21%, sfitto, spese, tasse)". Non spacciare il lordo per netto.
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
