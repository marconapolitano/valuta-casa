// === Estrattore (gira NELLA pagina annuncio) — file SORGENTE, edit qui ===
//
// PAIRED FILE: implementa la stessa estrazione (prezzo/mq/zona/foto/planimetrie)
// indipendentemente da api/_lib/extract.js — quella gira su stringa HTML
// fetchata server-side (regex su testo), questa su `document` live nel mondo
// isolato della pagina (querySelectorAll, currentSrc, naturalWidth...). MV3 non
// può condividere moduli fra le due (chrome.scripting.executeScript richiede una
// funzione autocontenuta, niente import — vedi nota ZONE_NAMES sotto). FIX A
// QUESTO FILE: controlla anche l'altro — i bug di estrazione tendono a
// manifestarsi in entrambi.
//
// QUESTO FILE NON VIENE CARICATO DIRETTAMENTE DALL'ESTENSIONE.
// `npm run sync-extension` lo legge, sostituisce il placeholder ZONE_NAMES con
// l'array reale (derivato da data/omi_roma_compatto.json — fonte canonica in
// api/_lib/zones.js) e scrive il risultato in _generated/extractor.inject.js,
// che background.js carica con importScripts(). Il placeholder resta un
// letterale vuoto così questo file è anche eseguibile/lintabile da solo.
//
// Riusa la logica universale: JSON-LD → breadcrumb → dizionario zone → regex.
// In più raccoglie gli URL delle foto/planimetrie.
function estrai() {
  // Vincolo piattaforma (non scelta): chrome.scripting.executeScript({func: estrai})
  // inietta il TESTO SORGENTE della funzione nella pagina — niente closure su
  // variabili esterne, niente import. L'array DEVE restare un letterale qui
  // dentro. Quello che non è forzato è doverlo scrivere/sincronizzare a mano:
  // sync-extension.mjs lo genera da omi_roma_compatto.json ad ogni modifica dati.
  const ZONE_NAMES = /*__ZONE_NAMES__*/[];
  const body = document.body.innerText, title = document.title;
  let price = null, mq = null, indir = "", zona = "";
  const num = (s) => { if (s == null) return null; const m = String(s).replace(/\./g, "").match(/\d+/); return m ? Number(m[0]) : null; };

  // JSON-LD
  let ldAddr = "", ldImgs = [];
  try {
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      let j; try { j = JSON.parse(s.textContent); } catch (e) { return; }
      (Array.isArray(j) ? j : (j["@graph"] || [j])).forEach((o) => {
        if (!o) return;
        const off = o.offers || (o.makesOffer && o.makesOffer[0]);
        if (off && off.price && !price) price = num(off.price);
        if (o.floorSize && o.floorSize.value && !mq) mq = num(o.floorSize.value);
        if (o.address && !ldAddr) ldAddr = typeof o.address === "string" ? o.address : [o.address.streetAddress, o.address.addressLocality].filter(Boolean).join(", ");
        if (o.image) ldImgs = ldImgs.concat(Array.isArray(o.image) ? o.image : [o.image]);
      });
    });
  } catch (e) {}

  if (!price) { const p = document.querySelector('.info-data-price,.in-detail__price,[class*="price"]'); if (p) price = num(p.textContent); }
  if (!price) { const m = body.match(/([\d.]{4,})\s*€/) || body.match(/€\s*([\d.]{4,})/); if (m) price = num(m[1]); }
  if (!mq) { const m = body.match(/(\d{2,4})\s*m(?:²|q\b|2\b)/i); if (m) mq = Number(m[1]); }

  // zona
  let bc = body.match(/Roma\s*[•·›>]\s*([^•·›>\n]{3,40})\s*[•·›>]/i);
  if (bc) zona = bc[1].trim();
  if (!zona) { const hay = (body + " " + title).toLowerCase(); for (const z of ZONE_NAMES) { if (hay.indexOf(z.toLowerCase()) > -1) { zona = z; break; } } }
  // indirizzo
  const h1 = document.querySelector("h1");
  let src = (h1 ? h1.textContent : "") + " " + title;
  indir = ldAddr || ((src.match(/in vendita in\s+([^,—|]+)/i) || src.match(/\b(?:Via|Viale|Vicolo|Piazza|Largo|Corso|Lungotevere)[^,—|]{2,40}/i) || [])[0] || "");
  indir = indir.replace(/^in vendita in\s+/i, "").trim();

  // venditore
  const lc = body.toLowerCase();
  const ag = /tecnocasa|gabetti|remax|re\/max|grimaldi|toscano|professionecasa/.test(lc) || (/\bagenzia\b/.test(lc) && !/no agenzie|astenersi/.test(lc));
  const note = [];
  if (/no agenzie|astenersi.*agenzi|privato vende|vendesi privat|no intermediari/.test(lc)) note.push("privato dichiarato");
  if (/seminterrat|interrat/.test(lc)) note.push("seminterrato");
  if (/affittat|nuda propriet/.test(lc)) note.push("affittato/vincolo");
  if (/\bvilla\b|villetta|casa indip|bifamiliare|a schiera/.test(lc)) note.push("villa/casa indip");

  // descrizione
  const dm = document.querySelector('.comment,[class*="description"],.adCommentsLanguage,[class*="in-readAll"]');
  const descrizione = (dm ? dm.textContent : body).replace(/\s+/g, " ").trim().slice(0, 600);

  // FOTO + PLANIMETRIE: raccolgo URL immobile, taggando le planimetrie.
  // Lazy-load: leggo anche data-src / srcset / data-lazy (URL presente anche se img non caricata).
  const isPlan = (u) => /plan(?:imetr)?|floor[\-_]?plan|grundriss/i.test(u);
  const isPlanEl = (im) => isPlan((im.alt || "") + " " + (im.className || "") + " " + (im.closest("[class*='plan'],[data-tab*='plan'],[id*='plan']") ? "plan" : ""));
  const imgMap = new Map(); // url -> plan(bool); dedup mantenendo plan=true se mai visto
  const consider = (u, plan) => {
    if (!u || !/^https?:/.test(u)) return;
    u = u.split(" ")[0].replace(/&amp;/g, "&"); // srcset: primo candidato
    if (/sprite|favicon|\/logo|avatar|placeholder|banner|\/static\/|googleapis|gstatic|map(?:box|s)?\./i.test(u) && !isPlan(u)) return;
    imgMap.set(u, (imgMap.get(u) || false) || plan);
  };
  ldImgs.filter(Boolean).forEach((u) => consider(u, isPlan(u)));
  document.querySelectorAll("img").forEach((im) => {
    const cand = im.currentSrc || im.src || im.getAttribute("data-src") || im.getAttribute("data-lazy") || (im.getAttribute("srcset") || "").split(",").pop() || "";
    const w = im.naturalWidth || im.width || parseInt(im.getAttribute("width")) || 0;
    const plan = isPlan(cand) || isPlanEl(im);
    // tieni: planimetrie sempre, foto solo se abbastanza grandi o dimensione ignota (lazy)
    if (plan || w === 0 || w >= 300) consider(cand, plan);
  });
  // ordina: planimetrie prima (analisi taglio), poi foto; max 5
  const foto = [...imgMap.entries()]
    .map(([url, plan]) => ({ url, plan }))
    .sort((a, b) => (b.plan ? 1 : 0) - (a.plan ? 1 : 0))
    .slice(0, 5);

  return { url: location.href, portale: location.hostname.replace(/^www\./, ""), price, mq, indirizzo: indir || zona, zona, agenzia: ag, note: note.join("; "), descrizione, foto };
}
