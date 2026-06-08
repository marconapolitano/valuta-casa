// Deriva i nomi-zona OMI dal JSON ufficiale per scansione testo (universale, ogni portale).
// FONTE CANONICA UNICA: backend, frontend (js/zones.js via fetch) e estensione
// (scripts/sync-extension.mjs genera l'array statico richiesto da MV3) derivano
// tutti da QUESTA funzione — niente più liste hardcoded da tenere in sync a mano.
export function deriveZoneNames(omiData){
  const set = new Set();
  for (const e of Object.values(omiData.zone)) {
    let n = e.nome.split("(")[0].replace(/^C\.STORICO:/i, "").trim();
    n.split(/[-\/]/).forEach((p) => { p = p.trim(); if (p.length >= 4 && !/^ROMA$/i.test(p) && !/^ZONA /i.test(p)) set.add(p); });
  }
  return [...set].sort((a, b) => b.length - a.length);
}
