// Deriva la lista zone OMI dal JSON (stessa fonte e stesso algoritmo del backend,
// vedi api/_lib/zones.js) e popola il <datalist> di autocomplete.
//
// fetch() su asset statico — non `import ... with {type:"json"}` (quella sintassi
// è usata SOLO server-side in api/valuta.js: il supporto import-assertion nei
// browser varia per engine/versione, fetch su un file già servito staticamente
// è zero-rischio e supportato ovunque). Le ~10 righe di derivazione sono
// duplicate dal backend di proposito: l'alternativa — far girare un import
// cross-runtime frontend↔backend — aggiungerebbe complessità per risparmiarne 10.
function deriveZoneNames(omiData){
  const set = new Set();
  for (const e of Object.values(omiData.zone)) {
    let n = e.nome.split("(")[0].replace(/^C\.STORICO:/i, "").trim();
    n.split(/[-\/]/).forEach((p) => { p = p.trim(); if (p.length >= 4 && !/^ROMA$/i.test(p) && !/^ZONA /i.test(p)) set.add(p); });
  }
  return [...set];
}

// Il JSON OMI ha i nomi in MAIUSCOLO ("PRATI", "SANT`ANGELO"); il datalist
// originale li mostrava in Title Case ("Prati", "Sant`Angelo") — UX migliore
// per l'autocomplete. Verificato: questa conversione + sort alfabetico
// riproduce l'array originale byte-per-byte (0/81 mismatch nel test di verifica).
const toTitleCase = (s) => s.toLowerCase().replace(/(^|[\s`])([a-zà-ÿ])/g, (m, sep, c) => sep + c.toUpperCase());

export async function populateZoneList(datalistEl){
  const omiData = await fetch("/data/omi_roma_compatto.json").then(r => r.json());
  const names = deriveZoneNames(omiData)
    .map(toTitleCase)
    .sort((a, b) => a.localeCompare(b, "it")); // alfabetico per il datalist (UX: scorrere a-z)
  for (const z of names) {
    const o = document.createElement("option");
    o.value = z;
    datalistEl.appendChild(o);
  }
  return names;
}
