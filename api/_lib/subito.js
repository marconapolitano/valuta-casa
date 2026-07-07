// Scanner annunci PRIVATI su Subito.it (categoria Appartamenti, Roma città).
//
// Fonte scelta perché: (a) è il portale con più annunci "da privato" e ha il
// filtro nativo advt=0; (b) espone i dati strutturati in __NEXT_DATA__ e
// risponde a una normale GET con User-Agent browser — nessun blocco da
// superare. NIENTE tecniche di evasione anti-bot (vincolo di progetto): se un
// domani Subito blocca, questo modulo fallisce con errore chiaro e basta.
//
// Dati per annuncio: prezzo, mq, stato, piano, ascensore, locali, bagni,
// classe energetica, indirizzo + lat/lng (quando il venditore mette la mappa),
// foto CDN. Tutto senza aprire le pagine dei singoli annunci: 1 GET per pagina
// di ricerca (30 annunci).

import { BROWSER_HEADERS } from "./extract.js";

const BASE = "https://www.subito.it/annunci-lazio/vendita/appartamenti/roma/roma/";
const IMG_RULE = "?rule=gallery-desktop-2x-auto"; // senza rule il CDN risponde 400

const feat = (ad, uri) => ((ad.features || {})[uri] || {}).values?.[0] || {};
const boolFeat = (ad, uri) => { const k = feat(ad, uri).key; return k === "1" ? true : k === "0" ? false : null; };

// parsing separato dal fetch: testabile su HTML salvato
export function parseListaSubito(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("subito: __NEXT_DATA__ non trovato (layout cambiato?)");
  const j = JSON.parse(m[1]);
  const items = j?.props?.pageProps?.initialState?.items;
  const lst = items?.originalList || [];
  const out = [];
  for (const ad of lst) {
    if (ad.advertiser && ad.advertiser.company) continue; // solo privati
    const prezzo = Number(feat(ad, "/price").key) || null;
    const mq = Number(feat(ad, "/size").key) || null;
    // prezzo < 10k in categoria vendita = annuncio malposto (affitto/box/errore)
    if (!prezzo || !mq || prezzo < 10000) continue;
    const map = (ad.geo || {}).map || {};
    out.push({
      id: ad.urn,
      titolo: ad.subject,
      url: (ad.urls || {}).default || null,
      prezzo, mq,
      stato: feat(ad, "/building_condition").value || null,
      piano: feat(ad, "/floor").value ?? null,
      ascensore: boolFeat(ad, "/elevator"),
      locali: Number(feat(ad, "/room").key) || null,
      bagni: Number(feat(ad, "/bathrooms").key) || null,
      classe: feat(ad, "/energy_class").value || null,
      indirizzo: map.address || null,
      lat: map.latitude != null ? Number(map.latitude) : null,
      lng: map.longitude != null ? Number(map.longitude) : null,
      descrizione: (ad.body || "").replace(/\s+/g, " ").slice(0, 600),
      foto: (ad.images || []).slice(0, 4)
        .map((i) => i.cdnBaseUrl && { url: i.cdnBaseUrl + IMG_RULE, plan: false })
        .filter(Boolean),
      data: ad.date || null,
    });
  }
  return { annunci: out, totale: items?.total ?? null, perPagina: lst.length };
}

export async function cercaPrivati({ prezzoMin, prezzoMax, mqMin = 0, pagine = 2 } = {}) {
  const seen = new Set();
  const out = [];
  let totale = null;
  for (let p = 1; p <= Math.min(pagine || 1, 5); p++) {
    const url = BASE + "?advt=0"
      + (prezzoMin ? "&ps=" + prezzoMin : "") + (prezzoMax ? "&pe=" + prezzoMax : "")
      + (p > 1 ? "&o=" + p : "");
    const r = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("subito " + r.status);
    const pg = parseListaSubito(await r.text());
    totale = pg.totale;
    for (const a of pg.annunci) {
      if (a.mq < mqMin || seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
    }
    if (pg.perPagina < 30) break; // ultima pagina
  }
  return { annunci: out, totale };
}
