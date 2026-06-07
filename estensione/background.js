// Al click sull'icona: esegue l'estrattore nella pagina attiva (browser reale,
// IP residenziale → non bloccato), riceve dati+foto, apre il servizio.

const SERVICE = "https://valuta-casa.vercel.app/";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:/.test(tab.url || "")) return;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: estrai,           // funzione iniettata, gira nella pagina
    });
    const d = res?.result;
    if (!d) return;
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(d))));
    chrome.tabs.create({ url: SERVICE + "?d=" + encodeURIComponent(enc) });
  } catch (e) {
    chrome.tabs.create({ url: SERVICE });
  }
});

// === Estrattore (gira NELLA pagina annuncio) ===
// Riusa la logica universale: JSON-LD → breadcrumb → dizionario zone → regex.
// In più raccoglie gli URL delle foto/planimetrie.
function estrai() {
  const ZONE_NAMES = ["PARCO DI VEIO PRATO DELLA CORTE","CASALOTTI  PANTAN MONASTERO","LA STORTA CASALE SAN NICOLA","AURELIO MADONNA DEL RIPOSO","FLAMINIO PORTA DEL POPOLO","PRENESTINO COLLE DEL SOLE","RISERVA DELLA MARCIGLIANA","CASILINO VILLA DE SANTIS","TORRACCIA DI SAN BASILIO","TOR MARANCIA NAVIGATORI","CASALOTTI SELVA CANDIDA","TOR VERGATA UNIVERSITA`","ANAGNINA VALLE MARCIANA","CASAL BOCCONE BUFALOTTA","AURELIO MONTE DI CRETA","ARDEATINO OTTAVO COLLE","SETTECAMINI CASE ROSSE","SANTA MARIA DI GALERIA","TOR BELLA MONACA PEEP","CASALOTTI VALLE SANTA","AURELIO GREGORIO VII","APPIO VILLA FIORELLI","PIETRALATA TIBURTINO","CINECITTA` DON BOSCO","MONTE PIETRA PERTUSA","ROMANINA TOR VERGATA","CASILINO MARRANELLA","PRENESTINO LABICANO","AURELIO VAL CANNUTA","MONTEVERDE VECCHIO","BALDUINA GIOVENALE","BATTERIA NOMENTANA","VILLAGGIO OLIMPICO","NOMENTANO TORLONIA","APPIO NOCERA UMBRA","FONTE MERAVIGLIOSA","ARDEATINO MILLEVOI","ARCO DI TRAVERTINO","BOSCO DEGLI ARVALI","CASILINO DUE TORRI","GREGNA SANT`ANDREA","FOSSO SAN GIULIANO","ARDEATINA SELVOTTA","OSTERIA DEL CURATO","CINECITTA` LAMARO","CORTINA D`AMPEZZO","BOCCEA QUARTACCIO","FOSSO SANT`ANDREA","OTTAVIA PALMAROLA","AGRO ROMANO OVEST","MONTEVERDE NUOVO","SALARIO AFRICANO","BALDUINA BELSITO","GIULIANO DALMATA","CASSIA DUE PONTI","PINETA SACCHETTI","MONTE MARIO ALTO","OTTAVIA LUCCHINA","TOR BELLA MONACA","MORENA GASPERINA","FONTE LAURENTINA","CASTEL DI DECIMA","CASTRO PRETORIO","SALARIO TRIESTE","COLLINA FLEMING","TOMBA DI NERONE","GROTTA PERFETTA","CASAL DEI PAZZI","CITTA` D`EUROPA","COLLI PORTUENSI","CASAL MONASTERO","CASTEL GIUBILEO","FONTANA CANDIDA","VILLAGGIO BREDA","LUCREZIA ROMANA","MONTE DEL MARMO","CASTEL DI GUIDO","STAGNI DI OSTIA","CORSO VITTORIO","DELLA VITTORIA","TRIONFALE IGEA","APPIO METRONIO","TOR PIGNATTARA","CASAL BRUCIATO","NOMENTANO KANT","TORRE SPACCATA","CASETTA MATTEI","FONTE OSTIENSE","CINECITTA` EST","PASSO LOMBARDO","CASTEL DI LEVA","VALLE MURICANA","LA GIUSTINIANA","PIANA DEL SOLE","CASAL LUMBROSO","SANTA CORNELIA","PORTA PORTESE","CASAL BERTONE","APPIO CLAUDIO","QUARTO MIGLIO","SACCO PASTORE","TOR TRE TESTE","NUOVO SALARIO","PRATI FISCALI","VALLE FIORITA","PONTE GALERIA","SAN VITTORINO","OSTIA LEVANTE","OSTIA PONENTE","TOR DE` CENCI","ACQUA VERGINE","CASAL PALOCCO","CASTEL ROMANO","COLLE SALARIO","PORTA DI ROMA","PONTE DI NONA","SANTA PALOMBA","FIERA DI ROMA","ISOLA FARNESE","OSTERIA NUOVA","MONTESPACCATO","PONTE MAMMOLO","CAVALLEGGERI","PONTE MILVIO","APPIO LATINO","ALESSANDRINO","TORREVECCHIA","APPIA ANTICA","COLLI ANIENE","TORRINO NORD","CASAL MORENA","TOR SAPIENZA","TORRE ANGELA","DIVINO AMORE","TRAGLIATELLA","LAGO REGILLO","COLLE MATTIA","MEZZOCAMMINO","OSTIA ANTICA","PIAN SAVELLI","TOR PAGNOTTA","ACILIA NUOVA","MALBORGHETTO","SANT`ANGELO","SALLUSTIANO","PORTONACCIO","VIGNA CLARA","CAMILLUCCIA","SAN LORENZO","SAN BASILIO","CONCA D`ORO","TOR FISCALE","PODERE ROSA","TORRINO SUD","MOSTACCIANO","GIARDINETTI","SETTECAMINI","LA CINQUINA","CASTELVERDE","GROTTAROSSA","BORGHESIANA","PRIMA PORTA","TORRE MAURA","ACILIA NORD","VILLA SPADA","VIGNE NUOVE","CECCHIGNOLA","DRAGONCELLO","TOR CERVARA","CAMPITELLI","TRASTEVERE","GARBATELLA","MARCO POLO","MONTESACRO","VALMELAINA","CENTOCELLE","CAPANNELLE","PRIMAVALLE","MONTAGNOLA","TINTORETTO","PIETRALATA","VERDEROCCA","FERRATELLA","VILLAVERDE","LA RUSTICA","FALCOGNANA","BEL POGGIO","SAXA RUBRA","TORRE GAIA","ACILIA SUD","SPREGAMORE","SERPENTARA","SETTEBAGNI","FIORANELLO","MALAGROTTA","MADONNETTA","INFERNETTO","TESTACCIO","ESQUILINO","FARNESINA","COLLATINO","STATUARIO","SAN PAOLO","PORTUENSE","CASALOTTI","BUFALOTTA","VERMICINO","DUE LEONI","TORRENOVA","LUNGHEZZA","VALLERANO","FINOCCHIO","SPINACETO","LA STORTA","TORRESINA","MASSIMINA","LONGARINA","MURATELLA","AVENTINO","SAN SABA","LUDOVISI","VIMINALE","TRIDENTE","LANCIANI","PINCIANO","OSTIENSE","FLAMINIO","QUADRARO","BRAVETTA","MAGLIANA","ROMANINA","CORCOLLE","TRIGORIA","CASACCIA","TIBERINA","PARIOLI","MARCONI","SALARIO","BOLOGNA","PIGNETO","NOCETTA","TUFELLO","TALENTI","ROMA 70","VITINIA","DRAGONA","OLGIATA","TRULLO","PISANA","DECIMA","MORENA","LABARO","FIDENE","CESANO","BORGO","CELIO","MONTI","CIPRO","PRATI"];
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
