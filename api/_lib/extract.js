// Estrazione dati annuncio da HTML grezzo (server-side, da URL fetchato).
//
// PAIRED FILE: implementa la stessa estrazione (prezzo/mq/zona/foto/planimetrie/
// caratteristiche/coordinate) indipendentemente da estensione/extractor.src.js —
// quella gira su `document` live nel mondo isolato della pagina
// (chrome.scripting.executeScript), questa su stringa HTML fetchata server-side.
// MV3 non può condividere moduli fra le due (vedi commento in extractor.src.js),
// quindi sono 2 implementazioni per vincolo di piattaforma, non per scelta.
// FIX A QUESTO FILE: controlla anche l'altro — i bug di estrazione tendono a
// manifestarsi in entrambi.
//
// Ordine fonti (dalla più alla meno affidabile):
//   1. JSON strutturato del portale (__NEXT_DATA__ di immobiliare.it, utag_data
//      di idealista) → prezzo/mq/caratteristiche/lat-lng/foto con caption
//   2. JSON-LD schema.org
//   3. regex su testo (universale, ogni portale)

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

const num = (s) => { if (s == null) return null; const m = String(s).replace(/[. ]/g, "").match(/\d+/); return m ? Number(m[0]) : null; };

// caratteristiche da testo piano (universale). Il JSON del portale, se c'è, vince.
export function estraiCaratteristiche(text) {
  const lc = " " + text.toLowerCase().replace(/\s+/g, " ") + " ";
  const car = {};
  let m;
  if (/seminterrat|piano interrato/.test(lc)) car.piano = "seminterrato";
  else if (/piano\s*terra|pian\s*terreno/.test(lc)) car.piano = "terra";
  else if (/piano\s+rialzato/.test(lc)) car.piano = "rialzato";
  else if ((m = lc.match(/(\d{1,2})[°º]\s*piano/)) || (m = lc.match(/piano\s+(\d{1,2})\b/))) car.piano = m[1];
  if (/senza ascensore|no ascensore|ascensore assente|non .{0,20}ascensore/.test(lc)) car.ascensore = false;
  else if (/ascensore/.test(lc)) car.ascensore = true;
  if (/da ristrutturare|da rifare|da sistemare|da ammodernare/.test(lc)) car.stato = "da ristrutturare";
  else if (/finemente ristrutturato|completamente ristrutturato|ristrutturato|nuova costruzione|ottimo stato|ottime condizioni/.test(lc)) car.stato = "ristrutturato";
  else if (/buono stato|buone condizioni|abitabile|ben tenuto/.test(lc)) car.stato = "buono";
  if ((m = lc.match(/anno di costruzione\D{0,12}(1[89]\d\d|20\d\d)/))) car.anno = Number(m[1]);
  if ((m = lc.match(/classe energetica\W{0,10}([a-g])\b/))) car.classe = m[1].toUpperCase();
  if ((m = lc.match(/spese condominial\w*\D{0,12}([\d.]+)/)) || (m = lc.match(/condominio\D{0,8}([\d.]{2,6})\s*€/))) car.speseCondominio = num(m[1]);
  if ((m = lc.match(/(\d)\s*bagn/))) car.bagni = Number(m[1]);
  if ((m = lc.match(/(\d{1,2})\s*(?:local|vani)/))) car.locali = Number(m[1]);
  if (/terrazz/.test(lc)) car.terrazzo = true;
  else if (/balcon/.test(lc)) car.balcone = true;
  if (/box auto|posto auto|garage/.test(lc)) car.box = true;
  return car;
}

// deep-walk di JSON annidati del portale: cerca chiavi note ovunque nell'albero.
// Resistente ai cambi di schema — non dipende dal percorso esatto delle proprietà.
function walk(node, fn, depth = 0) {
  if (!node || typeof node !== "object" || depth > 14) return;
  fn(node);
  for (const k in node) { const v = node[k]; if (v && typeof v === "object") walk(v, fn, depth + 1); }
}

export function distillaJson(root) {
  const out = { car: {}, foto: [] };
  const seen = new Set();
  const addFoto = (u, plan) => {
    if (!u || typeof u !== "string" || !/^https?:/.test(u) || seen.has(u)) return;
    seen.add(u); out.foto.push({ url: u, plan: !!plan || isPlanimetria(u) });
  };
  const pickUrl = (p) => typeof p === "string" ? p : (p && (p.urls?.large || p.urls?.medium || p.urls?.small || p.url)) || null;
  walk(root, (o) => {
    if (out.lat == null && o.latitude != null && o.longitude != null) {
      const la = Number(o.latitude), lo = Number(o.longitude);
      if (la > 36 && la < 47 && lo > 6 && lo < 19) { out.lat = la; out.lng = lo; }
    }
    if (out.prezzo == null && o.price != null) out.prezzo = num(typeof o.price === "object" ? o.price.value : o.price);
    if (out.mq == null && o.surface != null) out.mq = num(typeof o.surface === "object" ? o.surface.value : o.surface);
    if (out.mq == null && o.floorSize && o.floorSize.value != null) out.mq = num(o.floorSize.value);
    if (out.car.locali == null && o.rooms != null) out.car.locali = num(o.rooms);
    if (out.car.bagni == null && o.bathrooms != null) out.car.bagni = num(o.bathrooms);
    if (out.car.piano == null && o.floor != null) {
      const f = typeof o.floor === "object" ? (o.floor.value ?? o.floor.abbreviation) : o.floor;
      if (f != null && String(f).length <= 20) out.car.piano = String(f);
    }
    if (out.car.ascensore == null && typeof o.elevator === "boolean") out.car.ascensore = o.elevator;
    if (out.car.stato == null && typeof o.condition === "string" && o.condition.length <= 60) out.car.stato = o.condition;
    if (out.car.anno == null && (o.buildingYear || o.constructionYear)) out.car.anno = num(o.buildingYear || o.constructionYear);
    const ec = (typeof o.energyClass === "string" && o.energyClass) || (o.energy && typeof o.energy.class === "string" && o.energy.class);
    if (out.car.classe == null && ec && /^[A-G]/i.test(ec)) out.car.classe = ec.toUpperCase().slice(0, 4);
    if (!out.indirizzo && typeof o.address === "string" && o.address.length > 3 && o.address.length < 120) out.indirizzo = o.address;
    if (!out.indirizzo && o.address && typeof o.address === "object" && o.address.streetAddress)
      out.indirizzo = [o.address.streetAddress, o.address.addressLocality].filter(Boolean).join(", ");
    if (!out.quartiere && typeof o.microzone === "string") out.quartiere = o.microzone;
    if (!out.quartiere && typeof o.macrozone === "string") out.quartiere = o.macrozone;
    if (Array.isArray(o.floorplans)) for (const p of o.floorplans) addFoto(pickUrl(p), true);
    if (Array.isArray(o.photos)) for (const p of o.photos) addFoto(pickUrl(p), /plan/i.test((p && p.caption) || ""));
  });
  return out;
}

// blocchi JSON noti nell'HTML: __NEXT_DATA__ (immobiliare.it), utag_data (idealista)
export function estraiJsonAnnuncio(html) {
  const nx = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nx) {
    try {
      const j = JSON.parse(nx[1]);
      // se lo schema è quello noto, restringi all'annuncio (evita prezzo di "annunci simili")
      const core = (j.props && j.props.pageProps && (j.props.pageProps.detailData || j.props.pageProps)) || j;
      const d = distillaJson(core);
      if (d.prezzo || d.lat || d.foto.length) return d;
    } catch (e) {}
  }
  const ut = html.match(/utag_data\s*=\s*(\{[\s\S]*?\});/);
  if (ut) {
    try {
      const u = JSON.parse(ut[1]);
      const d = { car: {}, foto: [] };
      d.prezzo = num(u.ad_price); d.mq = num(u.ad_area);
      if (typeof u.ad_condition === "string") d.car.stato = u.ad_condition;
      if (d.prezzo || d.mq) return d;
    } catch (e) {}
  }
  return null;
}

// coordinate in config inline (idealista e simili): regex tollerante
export function estraiGeoInline(html) {
  const la = html.match(/["']?latitude["']?\s*[:=]\s*["']?(4\d\.\d{3,})/i);
  const lo = html.match(/["']?longitude["']?\s*[:=]\s*["']?(1?\d\.\d{3,})/i);
  if (la && lo) { const lat = Number(la[1]), lng = Number(lo[1]); if (lat > 36 && lat < 47) return { lat, lng }; }
  return null;
}

// estrae URL foto+planimetrie dall'HTML (fallback quando il JSON portale manca).
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
  return out.slice(0, max || 6);
}

// estrae prezzo/mq/indirizzo/zona/caratteristiche/geo da una pagina annuncio (multi-portale).
export async function estraiDaUrl(url, ZONE_NAMES) {
  const html = await fetchHtml(url);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const titolo = (html.match(/<title>([^<]+)</i) || [])[1] || "";
  const dj = estraiJsonAnnuncio(html) || { car: {}, foto: [] };

  // JSON-LD (fallback)
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

  const prezzo = dj.prezzo || ldPrice || (() => { const m = text.match(/([\d.]{4,})\s*€/) || text.match(/€\s*([\d.]{4,})/); return m ? Number(m[1].replace(/\./g, "")) : null; })();
  const mq = dj.mq || ldMq || (() => { const m = text.match(/(\d{2,4})\s*m(?:²|q\b|2\b)/i); return m ? Number(m[1]) : null; })();

  // caratteristiche: regex su testo come base, JSON portale vince
  const car = { ...estraiCaratteristiche(text), ...dj.car };
  const geo = (dj.lat != null ? { lat: dj.lat, lng: dj.lng } : null) || estraiGeoInline(html);

  // zona: breadcrumb "Roma • ZONA •", microzona del portale, o dizionario nomi-zona
  let zona = (text.match(/Roma\s*[•·›>]\s*([^•·›>]{3,40})\s*[•·›>]/i) || [])[1] || dj.quartiere || "";
  if (!zona) { const hay = text.toLowerCase(); for (const z of ZONE_NAMES) { if (hay.includes(z.toLowerCase())) { zona = z; break; } } }
  let indir = dj.indirizzo || ldAddr || (titolo.match(/in\s+(Via|Viale|Vicolo|Piazza|Largo|Corso|Lungotevere)[^,—|]*/i) || [])[0] || "";
  indir = indir.replace(/^in\s+/i, "").trim();
  if (zona && indir.toLowerCase().indexOf(zona.toLowerCase()) < 0) indir = (indir ? indir + ", " : "") + zona;

  // descrizione (per stato/bias) + foto (JSON portale se disponibile: gallery pulita, plan affidabili)
  const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  const descrizione = descMatch ? descMatch[1].slice(0, 600) : text.slice(0, 400);
  const foto = dj.foto.length
    ? dj.foto.sort((a, b) => (b.plan ? 1 : 0) - (a.plan ? 1 : 0)).slice(0, 6)
    : estraiFoto(html, 6);

  return { titolo: titolo.trim(), prezzo, mq, indirizzo: indir || zona, zona,
    quartiere: dj.quartiere || null, car, lat: geo ? geo.lat : undefined, lng: geo ? geo.lng : undefined,
    descrizione, foto };
}
