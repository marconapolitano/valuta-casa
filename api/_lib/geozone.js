// Zona OMI da coordinate GPS — point-in-polygon sui perimetri UFFICIALI.
//
// Elimina la scelta zona "a giudizio" quando abbiamo coordinate: il punto cade
// in un poligono → quella È la zona (fonte: perimetri Agenzia Entrate via
// onData, provincia Roma 2018/2 — le zonizzazioni cambiano di rado; 208/211
// zone del JSON quotazioni 2025 hanno perimetro, mancano solo E186-188 che
// restano al fallback Claude+geocoding).
//
// Formato dati (vedi data/omi_roma_zone_poligoni.json):
//   zone[CODICE] = [poligono...]; poligono = [anello...];
//   anello = [lng,lat,lng,lat,...] piatto (primo = bordo, successivi = buchi)
//
// Bounding box precomputate a module-load: il lookup scarta quasi tutti i
// poligoni con 4 confronti prima del ray-casting vero.

import poligoni from "../../data/omi_roma_zone_poligoni.json" with { type: "json" };

// ray casting su anello piatto [lng,lat,...]
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// indice: [{code, bbox:[minLng,minLat,maxLng,maxLat], rings}]
const INDEX = [];
for (const [code, polys] of Object.entries(poligoni.zone)) {
  for (const rings of polys) {
    const outer = rings[0];
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (let i = 0; i < outer.length; i += 2) {
      if (outer[i] < a) a = outer[i];
      if (outer[i] > c) c = outer[i];
      if (outer[i + 1] < b) b = outer[i + 1];
      if (outer[i + 1] > d) d = outer[i + 1];
    }
    INDEX.push({ code, bbox: [a, b, c, d], rings });
  }
}

// → codice zona OMI oppure null (fuori Roma / zone senza perimetro)
export function zonaDaCoordinate(lat, lng) {
  if (lat == null || lng == null) return null;
  lat = Number(lat); lng = Number(lng);
  for (const p of INDEX) {
    const [a, b, c, d] = p.bbox;
    if (lng < a || lng > c || lat < b || lat > d) continue;
    if (!inRing(lng, lat, p.rings[0])) continue;
    let inHole = false;
    for (let i = 1; i < p.rings.length; i++) if (inRing(lng, lat, p.rings[i])) { inHole = true; break; }
    if (!inHole) return p.code;
  }
  return null;
}
