// FILE GENERATO — non editare a mano. Modifica estensione/extractor.src.js
// e rilancia "npm run sync-extension" (o data/omi_roma_compatto.json per
// aggiornare l'array zone). Caricato da background.js via importScripts().
//
// Generato da scripts/sync-extension.mjs il 2026-07-07
// — 259 zone da data/omi_roma_compatto.json.

// === Estrattore (gira NELLA pagina annuncio) — file SORGENTE, edit qui ===
//
// PAIRED FILE: implementa la stessa estrazione (prezzo/mq/zona/foto/planimetrie/
// caratteristiche/coordinate) indipendentemente da api/_lib/extract.js — quella
// gira su stringa HTML fetchata server-side (regex su testo), questa su
// `document` live nel mondo isolato della pagina (querySelectorAll, currentSrc,
// naturalWidth...). MV3 non può condividere moduli fra le due
// (chrome.scripting.executeScript richiede una funzione autocontenuta, niente
// import — vedi nota ZONE_NAMES sotto). FIX A QUESTO FILE: controlla anche
// l'altro — i bug di estrazione tendono a manifestarsi in entrambi.
//
// QUESTO FILE NON VIENE CARICATO DIRETTAMENTE DALL'ESTENSIONE.
// `npm run sync-extension` lo legge, sostituisce il placeholder ZONE_NAMES con
// l'array reale (derivato da data/omi_roma_compatto.json — fonte canonica in
// api/_lib/zones.js) e scrive il risultato in generated/extractor.inject.js,
// che background.js carica con importScripts(). Il placeholder resta un
// letterale vuoto così questo file è anche eseguibile/lintabile da solo.
//
// Ordine fonti (dalla più alla meno affidabile):
//   1. JSON strutturato del portale nel DOM (<script id="__NEXT_DATA__"> di
//      immobiliare.it, utag_data/config inline di idealista — il mondo isolato
//      NON vede window.* della pagina, ma i tag <script> sono nel DOM e il loro
//      textContent è leggibile) → caratteristiche, lat/lng, foto con caption
//   2. JSON-LD schema.org
//   3. regex su body.innerText (universale) + dizionario zone
function estrai() {
  // Vincolo piattaforma (non scelta): chrome.scripting.executeScript({func: estrai})
  // inietta il TESTO SORGENTE della funzione nella pagina — niente closure su
  // variabili esterne, niente import. L'array DEVE restare un letterale qui
  // dentro. Quello che non è forzato è doverlo scrivere/sincronizzare a mano:
  // sync-extension.mjs lo genera da omi_roma_compatto.json ad ogni modifica dati.
  const ZONE_NAMES = ["PARCO DI VEIO PRATO DELLA CORTE","CASALOTTI  PANTAN MONASTERO","LA STORTA CASALE SAN NICOLA","AURELIO MADONNA DEL RIPOSO","FLAMINIO PORTA DEL POPOLO","PRENESTINO COLLE DEL SOLE","RISERVA DELLA MARCIGLIANA","CASILINO VILLA DE SANTIS","TORRACCIA DI SAN BASILIO","TOR MARANCIA NAVIGATORI","CASALOTTI SELVA CANDIDA","TOR VERGATA UNIVERSITA`","ANAGNINA VALLE MARCIANA","CASAL BOCCONE BUFALOTTA","AURELIO MONTE DI CRETA","ARDEATINO OTTAVO COLLE","SETTECAMINI CASE ROSSE","SANTA MARIA DI GALERIA","TOR BELLA MONACA PEEP","CASALOTTI VALLE SANTA","AURELIO GREGORIO VII","APPIO VILLA FIORELLI","PIETRALATA TIBURTINO","CINECITTA` DON BOSCO","MONTE PIETRA PERTUSA","ROMANINA TOR VERGATA","CASILINO MARRANELLA","PRENESTINO LABICANO","AURELIO VAL CANNUTA","MONTEVERDE VECCHIO","BALDUINA GIOVENALE","BATTERIA NOMENTANA","VILLAGGIO OLIMPICO","NOMENTANO TORLONIA","APPIO NOCERA UMBRA","FONTE MERAVIGLIOSA","ARDEATINO MILLEVOI","ARCO DI TRAVERTINO","BOSCO DEGLI ARVALI","CASILINO DUE TORRI","GREGNA SANT`ANDREA","FOSSO SAN GIULIANO","ARDEATINA SELVOTTA","OSTERIA DEL CURATO","CINECITTA` LAMARO","CORTINA D`AMPEZZO","BOCCEA QUARTACCIO","FOSSO SANT`ANDREA","OTTAVIA PALMAROLA","AGRO ROMANO OVEST","MONTEVERDE NUOVO","SALARIO AFRICANO","BALDUINA BELSITO","GIULIANO DALMATA","CASSIA DUE PONTI","PINETA SACCHETTI","MONTE MARIO ALTO","OTTAVIA LUCCHINA","TOR BELLA MONACA","MORENA GASPERINA","FONTE LAURENTINA","CASTEL DI DECIMA","CASTRO PRETORIO","SALARIO TRIESTE","COLLINA FLEMING","TOMBA DI NERONE","GROTTA PERFETTA","CASAL DEI PAZZI","CITTA` D`EUROPA","COLLI PORTUENSI","CASAL MONASTERO","CASTEL GIUBILEO","FONTANA CANDIDA","VILLAGGIO BREDA","LUCREZIA ROMANA","MONTE DEL MARMO","CASTEL DI GUIDO","STAGNI DI OSTIA","CORSO VITTORIO","DELLA VITTORIA","TRIONFALE IGEA","APPIO METRONIO","TOR PIGNATTARA","CASAL BRUCIATO","NOMENTANO KANT","TORRE SPACCATA","CASETTA MATTEI","FONTE OSTIENSE","CINECITTA` EST","PASSO LOMBARDO","CASTEL DI LEVA","VALLE MURICANA","LA GIUSTINIANA","PIANA DEL SOLE","CASAL LUMBROSO","SANTA CORNELIA","PORTA PORTESE","CASAL BERTONE","APPIO CLAUDIO","QUARTO MIGLIO","SACCO PASTORE","TOR TRE TESTE","NUOVO SALARIO","PRATI FISCALI","VALLE FIORITA","PONTE GALERIA","SAN VITTORINO","OSTIA LEVANTE","OSTIA PONENTE","TOR DE` CENCI","ACQUA VERGINE","CASAL PALOCCO","CASTEL ROMANO","COLLE SALARIO","PORTA DI ROMA","PONTE DI NONA","SANTA PALOMBA","FIERA DI ROMA","ISOLA FARNESE","OSTERIA NUOVA","MONTESPACCATO","PONTE MAMMOLO","CAVALLEGGERI","PONTE MILVIO","APPIO LATINO","ALESSANDRINO","TORREVECCHIA","APPIA ANTICA","COLLI ANIENE","TORRINO NORD","CASAL MORENA","TOR SAPIENZA","TORRE ANGELA","DIVINO AMORE","TRAGLIATELLA","LAGO REGILLO","COLLE MATTIA","MEZZOCAMMINO","OSTIA ANTICA","PIAN SAVELLI","TOR PAGNOTTA","ACILIA NUOVA","MALBORGHETTO","SANT`ANGELO","SALLUSTIANO","PORTONACCIO","VIGNA CLARA","CAMILLUCCIA","SAN LORENZO","SAN BASILIO","CONCA D`ORO","TOR FISCALE","PODERE ROSA","TORRINO SUD","MOSTACCIANO","GIARDINETTI","SETTECAMINI","LA CINQUINA","CASTELVERDE","GROTTAROSSA","BORGHESIANA","PRIMA PORTA","TORRE MAURA","ACILIA NORD","VILLA SPADA","VIGNE NUOVE","CECCHIGNOLA","DRAGONCELLO","TOR CERVARA","CAMPITELLI","TRASTEVERE","GARBATELLA","MARCO POLO","MONTESACRO","VALMELAINA","CENTOCELLE","CAPANNELLE","PRIMAVALLE","MONTAGNOLA","TINTORETTO","PIETRALATA","VERDEROCCA","FERRATELLA","VILLAVERDE","LA RUSTICA","FALCOGNANA","BEL POGGIO","SAXA RUBRA","TORRE GAIA","ACILIA SUD","SPREGAMORE","SERPENTARA","SETTEBAGNI","FIORANELLO","MALAGROTTA","MADONNETTA","INFERNETTO","TESTACCIO","ESQUILINO","FARNESINA","COLLATINO","STATUARIO","SAN PAOLO","PORTUENSE","CASALOTTI","BUFALOTTA","VERMICINO","DUE LEONI","TORRENOVA","LUNGHEZZA","VALLERANO","FINOCCHIO","SPINACETO","LA STORTA","TORRESINA","MASSIMINA","LONGARINA","MURATELLA","AVENTINO","SAN SABA","LUDOVISI","VIMINALE","TRIDENTE","LANCIANI","PINCIANO","OSTIENSE","FLAMINIO","QUADRARO","BRAVETTA","MAGLIANA","ROMANINA","CORCOLLE","TRIGORIA","CASACCIA","TIBERINA","PARIOLI","MARCONI","SALARIO","BOLOGNA","PIGNETO","NOCETTA","TUFELLO","TALENTI","ROMA 70","VITINIA","DRAGONA","OLGIATA","TRULLO","PISANA","DECIMA","MORENA","LABARO","FIDENE","CESANO","BORGO","CELIO","MONTI","CIPRO","PRATI"];
  const body = document.body.innerText, title = document.title;
  let price = null, mq = null, indir = "", zona = "";
  const num = (s) => { if (s == null) return null; const m = String(s).replace(/[. ]/g, "").match(/\d+/); return m ? Number(m[0]) : null; };

  // ── 1. JSON strutturato del portale (deep-walk, resistente ai cambi schema) ──
  const dj = { car: {}, foto: [] };
  const isPlan = (u) => /plan(?:imetr)?|floor[\-_]?plan|grundriss/i.test(u);
  const seenFoto = new Set();
  const addFotoJson = (u, plan) => {
    if (!u || typeof u !== "string" || !/^https?:/.test(u) || seenFoto.has(u)) return;
    seenFoto.add(u); dj.foto.push({ url: u, plan: !!plan || isPlan(u) });
  };
  const pickUrl = (p) => typeof p === "string" ? p : (p && (p.urls && (p.urls.large || p.urls.medium || p.urls.small) || p.url)) || null;
  const walk = (node, fn, depth) => {
    if (!node || typeof node !== "object" || depth > 14) return;
    fn(node);
    for (const k in node) { const v = node[k]; if (v && typeof v === "object") walk(v, fn, depth + 1); }
  };
  const distilla = (root) => walk(root, (o) => {
    if (dj.lat == null && o.latitude != null && o.longitude != null) {
      const la = Number(o.latitude), lo = Number(o.longitude);
      if (la > 36 && la < 47 && lo > 6 && lo < 19) { dj.lat = la; dj.lng = lo; }
    }
    if (dj.prezzo == null && o.price != null) dj.prezzo = num(typeof o.price === "object" ? o.price.value : o.price);
    if (dj.mq == null && o.surface != null) dj.mq = num(typeof o.surface === "object" ? o.surface.value : o.surface);
    if (dj.mq == null && o.floorSize && o.floorSize.value != null) dj.mq = num(o.floorSize.value);
    if (dj.car.locali == null && o.rooms != null) dj.car.locali = num(o.rooms);
    if (dj.car.bagni == null && o.bathrooms != null) dj.car.bagni = num(o.bathrooms);
    if (dj.car.piano == null && o.floor != null) {
      const f = typeof o.floor === "object" ? (o.floor.value != null ? o.floor.value : o.floor.abbreviation) : o.floor;
      if (f != null && String(f).length <= 20) dj.car.piano = String(f);
    }
    if (dj.car.ascensore == null && typeof o.elevator === "boolean") dj.car.ascensore = o.elevator;
    if (dj.car.stato == null && typeof o.condition === "string" && o.condition.length <= 60) dj.car.stato = o.condition;
    if (dj.car.anno == null && (o.buildingYear || o.constructionYear)) dj.car.anno = num(o.buildingYear || o.constructionYear);
    const ec = (typeof o.energyClass === "string" && o.energyClass) || (o.energy && typeof o.energy.class === "string" && o.energy.class);
    if (dj.car.classe == null && ec && /^[A-G]/i.test(ec)) dj.car.classe = ec.toUpperCase().slice(0, 4);
    if (!dj.indirizzo && typeof o.address === "string" && o.address.length > 3 && o.address.length < 120) dj.indirizzo = o.address;
    if (!dj.indirizzo && o.address && typeof o.address === "object" && o.address.streetAddress)
      dj.indirizzo = [o.address.streetAddress, o.address.addressLocality].filter(Boolean).join(", ");
    if (!dj.quartiere && typeof o.microzone === "string") dj.quartiere = o.microzone;
    if (!dj.quartiere && typeof o.macrozone === "string") dj.quartiere = o.macrozone;
    if (Array.isArray(o.floorplans)) for (const p of o.floorplans) addFotoJson(pickUrl(p), true);
    if (Array.isArray(o.photos)) for (const p of o.photos) addFotoJson(pickUrl(p), /plan/i.test((p && p.caption) || ""));
  }, 0);
  // __NEXT_DATA__ (immobiliare.it): script tag nel DOM, leggibile dal mondo isolato
  const nx = document.getElementById("__NEXT_DATA__");
  if (nx) {
    try {
      const j = JSON.parse(nx.textContent);
      distilla((j.props && j.props.pageProps && (j.props.pageProps.detailData || j.props.pageProps)) || j);
    } catch (e) {}
  }
  // utag_data / config inline (idealista): scandaglia gli script inline
  if (dj.prezzo == null || dj.lat == null) {
    for (const s of document.scripts) {
      const t = s.textContent || "";
      if (!t || t.length > 500000) continue;
      if (dj.prezzo == null && t.indexOf("utag_data") > -1) {
        const m = t.match(/utag_data\s*=\s*(\{[\s\S]*?\});/);
        if (m) { try { const u = JSON.parse(m[1]); dj.prezzo = dj.prezzo || num(u.ad_price); dj.mq = dj.mq || num(u.ad_area); if (!dj.car.stato && typeof u.ad_condition === "string") dj.car.stato = u.ad_condition; } catch (e) {} }
      }
      if (dj.lat == null && t.indexOf("latitude") > -1) {
        const la = t.match(/["']?latitude["']?\s*[:=]\s*["']?(4\d\.\d{3,})/);
        const lo = t.match(/["']?longitude["']?\s*[:=]\s*["']?(1?\d\.\d{3,})/);
        if (la && lo) { const lat = Number(la[1]); if (lat > 36 && lat < 47) { dj.lat = lat; dj.lng = Number(lo[1]); } }
      }
      if (dj.prezzo != null && dj.lat != null) break;
    }
  }

  // ── 2. JSON-LD (fallback) ──
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

  // ── 3. regex su testo (universale) ──
  price = dj.prezzo || price;
  mq = dj.mq || mq;
  if (!price) { const p = document.querySelector('.info-data-price,.in-detail__price,[class*="price"]'); if (p) price = num(p.textContent); }
  if (!price) { const m = body.match(/([\d.]{4,})\s*€/) || body.match(/€\s*([\d.]{4,})/); if (m) price = num(m[1]); }
  if (!mq) { const m = body.match(/(\d{2,4})\s*m(?:²|q\b|2\b)/i); if (m) mq = Number(m[1]); }

  // zona
  let bc = body.match(/Roma\s*[•·›>]\s*([^•·›>\n]{3,40})\s*[•·›>]/i);
  if (bc) zona = bc[1].trim();
  if (!zona && dj.quartiere) zona = dj.quartiere;
  if (!zona) { const hay = (body + " " + title).toLowerCase(); for (const z of ZONE_NAMES) { if (hay.indexOf(z.toLowerCase()) > -1) { zona = z; break; } } }
  // indirizzo
  const h1 = document.querySelector("h1");
  let src = (h1 ? h1.textContent : "") + " " + title;
  indir = dj.indirizzo || ldAddr || ((src.match(/in vendita in\s+([^,—|]+)/i) || src.match(/\b(?:Via|Viale|Vicolo|Piazza|Largo|Corso|Lungotevere)[^,—|]{2,40}/i) || [])[0] || "");
  indir = indir.replace(/^in vendita in\s+/i, "").trim();

  // caratteristiche da testo (il JSON del portale, se presente, vince)
  const lc = body.toLowerCase().replace(/\s+/g, " ");
  const car = dj.car;
  let m;
  if (car.piano == null) {
    if (/seminterrat|piano interrato/.test(lc)) car.piano = "seminterrato";
    else if (/piano\s*terra|pian\s*terreno/.test(lc)) car.piano = "terra";
    else if (/piano\s+rialzato/.test(lc)) car.piano = "rialzato";
    else if ((m = lc.match(/(\d{1,2})[°º]\s*piano/)) || (m = lc.match(/piano\s+(\d{1,2})\b/))) car.piano = m[1];
  }
  if (car.ascensore == null) {
    if (/senza ascensore|no ascensore|ascensore assente/.test(lc)) car.ascensore = false;
    else if (/ascensore/.test(lc)) car.ascensore = true;
  }
  if (car.stato == null) {
    if (/da ristrutturare|da rifare|da sistemare|da ammodernare/.test(lc)) car.stato = "da ristrutturare";
    else if (/finemente ristrutturato|completamente ristrutturato|ristrutturato|nuova costruzione|ottimo stato|ottime condizioni/.test(lc)) car.stato = "ristrutturato";
    else if (/buono stato|buone condizioni|abitabile|ben tenuto/.test(lc)) car.stato = "buono";
  }
  if (car.anno == null && (m = lc.match(/anno di costruzione\D{0,12}(1[89]\d\d|20\d\d)/))) car.anno = Number(m[1]);
  if (car.classe == null && (m = lc.match(/classe energetica\W{0,10}([a-g])\b/))) car.classe = m[1].toUpperCase();
  if (car.speseCondominio == null && ((m = lc.match(/spese condominial\w*\D{0,12}([\d.]+)/)) || (m = lc.match(/condominio\D{0,8}([\d.]{2,6})\s*€/)))) car.speseCondominio = num(m[1]);
  if (car.bagni == null && (m = lc.match(/(\d)\s*bagn/))) car.bagni = Number(m[1]);
  if (car.locali == null && (m = lc.match(/(\d{1,2})\s*(?:local|vani)/))) car.locali = Number(m[1]);
  if (/terrazz/.test(lc)) car.terrazzo = true; else if (/balcon/.test(lc)) car.balcone = true;
  if (/box auto|posto auto|garage/.test(lc)) car.box = true;

  // venditore
  const ag = /tecnocasa|gabetti|remax|re\/max|grimaldi|toscano|professionecasa/.test(lc) || (/\bagenzia\b/.test(lc) && !/no agenzie|astenersi/.test(lc));
  const note = [];
  if (/no agenzie|astenersi.*agenzi|privato vende|vendesi privat|no intermediari/.test(lc)) note.push("privato dichiarato");
  if (/seminterrat|interrat/.test(lc)) note.push("seminterrato");
  if (/affittat|nuda propriet/.test(lc)) note.push("affittato/vincolo");
  if (/\bvilla\b|villetta|casa indip|bifamiliare|a schiera/.test(lc)) note.push("villa/casa indip");

  // descrizione
  const dm = document.querySelector('.comment,[class*="description"],.adCommentsLanguage,[class*="in-readAll"]');
  const descrizione = (dm ? dm.textContent : body).replace(/\s+/g, " ").trim().slice(0, 600);

  // FOTO + PLANIMETRIE: gallery JSON del portale se disponibile (URL puliti,
  // caption affidabili), altrimenti raccolta dal DOM con lazy-load.
  let foto;
  if (dj.foto.length) {
    foto = dj.foto.sort((a, b) => (b.plan ? 1 : 0) - (a.plan ? 1 : 0)).slice(0, 6);
  } else {
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
    foto = [...imgMap.entries()]
      .map(([url, plan]) => ({ url, plan }))
      .sort((a, b) => (b.plan ? 1 : 0) - (a.plan ? 1 : 0))
      .slice(0, 6);
  }

  return { url: location.href, portale: location.hostname.replace(/^www\./, ""),
    price, mq, indirizzo: indir || zona, zona, quartiere: dj.quartiere || undefined,
    lat: dj.lat, lng: dj.lng, car, agenzia: ag, note: note.join("; "), descrizione, foto };
}
