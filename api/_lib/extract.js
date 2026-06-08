// Estrazione dati annuncio da HTML grezzo (server-side, da URL fetchato).
//
// PAIRED FILE: implementa la stessa estrazione (prezzo/mq/zona/foto/planimetrie)
// indipendentemente da estensione/extractor.src.js — quella gira su `document`
// live nel mondo isolato della pagina (chrome.scripting.executeScript), questa
// su stringa HTML fetchata server-side. MV3 non può condividere moduli fra le
// due (vedi commento in extractor.src.js), quindi sono 2 implementazioni per
// vincolo di piattaforma, non per scelta. FIX A QUESTO FILE: controlla anche
// l'altro — i bug di estrazione tendono a manifestarsi in entrambi.

// rileva se un URL è (probabilmente) una planimetria — usata sia qui
// (classificazione foto) sia da claude.js/valuta.js (conteggio nPlan per badge).
export const isPlanimetria = (u) => /plan(?:imetr)?|floor[\-_]?plan|grundriss|\/map\b/i.test(u);

export const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9",
  "Referer": "https://www.google.com/",
};

export async function fetchHtml(url) {
  // 1) ScraperAPI (se configurato): proxy residenziali + JS render → supera DataDome
  if (process.env.SCRAPERAPI_KEY) {
    try {
      const api = "https://api.scraperapi.com/?api_key=" + process.env.SCRAPERAPI_KEY +
        "&render=true&country_code=it&url=" + encodeURIComponent(url);
      const r = await fetch(api, { signal: AbortSignal.timeout(55000) });
      if (r.ok) { const h = await r.text(); if (h.length > 2000) return h; }
    } catch (e) {}
  }
  // 2) diretto con header browser (portali deboli)
  try {
    const r = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
    if (r.ok) { const h = await r.text(); if (h.length > 2000) return h; }
  } catch (e) {}
  // 3) reader proxy gratuito (best-effort)
  try {
    const r = await fetch("https://r.jina.ai/" + url, { headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] } });
    if (r.ok) { const h = await r.text(); if (h.length > 800 && !/403|CAPTCHA/i.test(h.slice(0, 300))) return h; }
  } catch (e) {}
  throw new Error("blocked");
}

// estrae URL foto+planimetrie dall'HTML. Ritorna {url, plan} ordinati: planimetrie prima.
export function estraiFoto(html, max) {
  const seen = new Set();
  const out = [];
  const add = (u) => {
    if (!u) return;
    u = u.replace(/&amp;/g, "&");
    if (seen.has(u)) return;
    if (/logo|icon|avatar|placeholder|sprite|banner/i.test(u) && !isPlanimetria(u)) return;
    seen.add(u);
    out.push({ url: u, plan: isPlanimetria(u) });
  };
  const og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
  if (og) add(og[1]);
  // src, data-src, srcset, lazy attrs: prendi tutti gli URL immagine grezzi
  const imgs = html.match(/https?:\/\/[^"' )]+\.(?:jpg|jpeg|webp|png)(?:\?[^"' )]*)?/gi) || [];
  for (const u of imgs) add(u);
  // planimetrie prima (analisi layout), poi foto; cap a max
  out.sort((a, b) => (b.plan ? 1 : 0) - (a.plan ? 1 : 0));
  return out.slice(0, max || 5);
}

// estrae prezzo/mq/indirizzo/zona da una pagina annuncio (multi-portale, best-effort).
export async function estraiDaUrl(url, ZONE_NAMES) {
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

  // descrizione (per bias: seminterrato/villa/agenzia/affittato) + foto
  const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  const descrizione = descMatch ? descMatch[1].slice(0, 600) : text.slice(0, 400);
  const foto = estraiFoto(html, 5); // [{url, plan}]

  return { titolo: titolo.trim(), prezzo, mq, indirizzo: indir || zona, zona, descrizione, foto };
}
