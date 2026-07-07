// Geocoding best-effort via Nominatim (OpenStreetMap). Gratuito, senza chiave.
//
// Scopo: dare a Claude quartiere OSM + coordinate → scelta zona OMI molto più
// affidabile del solo nome nel testo annuncio (che spesso dice solo "Roma").
// Policy Nominatim: max 1 req/s, User-Agent identificativo — ok per uso
// personale a bassa frequenza. Cache in-memory per istanza: stessa via/coord
// richiesta due volte = zero chiamate extra.
//
// SEMPRE best-effort: ogni errore/timeout ritorna null, la valutazione procede
// senza blocco GEO (come prima di questa feature).

const cache = new Map();
const HEADERS = { "User-Agent": "valuta-casa/2.0 (strumento personale)", "Accept-Language": "it" };

async function nominatim(path) {
  const r = await fetch("https://nominatim.openstreetmap.org/" + path, {
    headers: HEADERS, signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error("nominatim " + r.status);
  return r.json();
}

// A Roma Nominatim usa i campi così: suburb = "Municipio Roma IV" (non il
// quartiere!), il quartiere vero (Pietralata, Casal Monastero…) compare come
// quarter/neighbourhood/village — spesso solo a zoom basso (14).
function distilla(j) {
  const a = j.address || {};
  const sub = a.suburb || a.city_district || null;
  const quart = a.quarter || a.neighbourhood || a.village || a.hamlet
    || (sub && !/municipio/i.test(sub) ? sub : null);
  return {
    lat: Number(j.lat), lng: Number(j.lon),
    quartiere: quart || null,
    municipio: sub && /municipio/i.test(sub) ? sub : null,
    via: a.road || null,
  };
}

// {lat,lng} (dal portale: precisione massima) oppure indirizzo con via → geocode.
// Zone OMI seguono i confini dei quartieri: quartiere+municipio OSM sono il segnale giusto.
export async function geocoda({ lat, lng, indirizzo }) {
  try {
    const key = (lat != null && lng != null)
      ? Number(lat).toFixed(4) + "," + Number(lng).toFixed(4)
      : (indirizzo || "").toLowerCase().trim();
    if (!key) return null;
    if (cache.has(key)) return cache.get(key);
    let out = null;
    if (lat == null && /\b(via|viale|vicolo|piazza|piazzale|largo|corso|lungotevere|circonvallazione|salita|clivo)\b/i.test(indirizzo || "")) {
      const q = encodeURIComponent(indirizzo.replace(/,?\s*roma.*$/i, "") + ", Roma, Italia");
      const j = await nominatim(`search?format=jsonv2&limit=1&addressdetails=1&q=${q}`);
      if (Array.isArray(j) && j[0]) { out = distilla(j[0]); lat = out.lat; lng = out.lng; }
    }
    if (lat != null && lng != null) {
      // zoom 16 → via + municipio; se manca il quartiere, secondo giro a zoom 14
      const j = await nominatim(`reverse?format=jsonv2&zoom=16&addressdetails=1&lat=${lat}&lon=${lng}`);
      const d = distilla(j);
      if (!d.quartiere) {
        try {
          const j14 = await nominatim(`reverse?format=jsonv2&zoom=14&addressdetails=1&lat=${lat}&lon=${lng}`);
          d.quartiere = distilla(j14).quartiere;
        } catch (e) {}
      }
      d.lat = Number(lat); d.lng = Number(lng);
      if (out && out.via && !d.via) d.via = out.via;
      out = d;
    }
    cache.set(key, out);
    return out;
  } catch (e) { return null; }
}
