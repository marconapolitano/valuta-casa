// Serializzazione compatta dei valori OMI per il system prompt.
//
// PRECOMPUTATA UNA VOLTA a module-load (non ad ogni request): l'output dipende
// SOLO dal JSON statico, è byte-identico ad ogni chiamata (~16KB / ~4040 token),
// quindi ricalcolarlo per ogni richiesta è puro spreco CPU (Vercel fattura la
// durata funzione). Verificato: compr_med == (compr_min+compr_max)/2 per tutte
// le 211 zone senza eccezioni → "med" è ridondante, rimosso dalla stringa
// (Claude/backend lo derivano se serve, risparmio token a costo zero).
import omiData from "../../data/omi_roma_compatto.json" with { type: "json" };

function build(){
  return Object.entries(omiData.zone)
    .map(([z, e]) => `${z}=${e.nome}|${e.compr_min}-${e.compr_max}|loc ${e.loc_min ?? "?"}-${e.loc_max ?? "?"}`)
    .join("\n");
}

export const OMI_PROMPT_BLOCK = build();
