// Test unità deterministici (niente rete): npm test
// valuation (header/benchmark/rendimento/zonaCerta) + extract + geozone + zones
import assert from "node:assert";
import omiData from "../data/omi_roma_compatto.json" with { type: "json" };
import { calcolaValutazione, CONFIG, normStato } from "../api/_lib/valuation.js";
import { estraiCaratteristiche, estraiJsonAnnuncio, estraiGeoInline } from "../api/_lib/extract.js";
import { zonaDaCoordinate } from "../api/_lib/geozone.js";
import { deriveZoneNames, deriveZoneNameMap } from "../api/_lib/zones.js";
import { parseListaSubito } from "../api/_lib/subito.js";

let ok = 0, fail = 0;
const t = (name, fn) => { try { fn(); ok++; console.log("  ✓", name); } catch (e) { fail++; console.log("  ✗", name, "→", e.message); } };

const op = "ZONA: B1\nFIDUCIA: alta\nZONA_ALT: -\nSTATO: normale\n\nAnalisi qui.";

console.log("— valuation —");
t("header parsato+strippato, sconto esatto (B1, 4815 vs 5350)", () => {
  const v = calcolaValutazione(op, omiData, { prezzo: 481500, mq: 100 });
  assert.equal(v.zonaCode, "B1"); assert.equal(v.fiducia, "alta");
  assert.equal(v.sconto, 10); assert.equal(v.esito, "AFFARE");
  assert.ok(v.opinione.startsWith("Analisi"));
});
t("stato aggiusta benchmark; statoManuale vince", () => {
  const v = calcolaValutazione(op.replace("normale", "ottimo"), omiData, { prezzo: 481500, mq: 100 });
  assert.equal(v.benchmark, Math.round(5350 * CONFIG.statoFactor.ottimo));
  const m = calcolaValutazione(op, omiData, { prezzo: 481500, mq: 100, statoManuale: "da ristrutturare" });
  assert.equal(m.stato, "da_ristrutturare");
});
t("rendimento: netto<lordo, prima casa senza IMU, cantiere se da rifare", () => {
  const v = calcolaValutazione(op, omiData, { prezzo: 481500, mq: 100 });
  assert.equal(v.rendimento.canoneMese, 1715);
  assert.ok(v.rendimento.netto < v.rendimento.lordo);
  const pc = calcolaValutazione(op, omiData, { prezzo: 481500, mq: 100, uso: "prima_casa" });
  assert.equal(pc.rendimento.voci.imu, 0);
  const dr = calcolaValutazione(op.replace("normale", "da_ristrutturare"), omiData, { prezzo: 300000, mq: 80 });
  assert.equal(dr.rendimento.voci.ristrutturazione, 80 * CONFIG.ristruttEurMq);
});
t("zonaCerta sovrascrive Claude; invalida ignorata; retro-compat solo-ZONA", () => {
  const v = calcolaValutazione(op, omiData, { prezzo: 400000, mq: 100, zonaCerta: "B14" });
  assert.equal(v.zonaCode, "B14"); assert.equal(v.fiducia, "certa"); assert.equal(v.zonaAlt, null);
  assert.equal(calcolaValutazione(op, omiData, { prezzo: 4e5, mq: 100, zonaCerta: "Z99" }).zonaCode, "B1");
  assert.equal(calcolaValutazione("ZONA: B1\nVecchio stile.", omiData, { prezzo: 481500, mq: 100 }).sconto, 10);
});
t("normStato varianti (portali inclusi)", () => {
  assert.equal(normStato("Da ristrutturare"), "da_ristrutturare");
  assert.equal(normStato("Ottimo - ristrutturato"), "ottimo");
  assert.equal(normStato("Buono - abitabile"), "normale");
  assert.equal(normStato("toRestore"), "da_ristrutturare");
});

console.log("— extract —");
t("caratteristiche da testo", () => {
  const c = estraiCaratteristiche("3° piano con ascensore, da ristrutturare, 2 bagni, 4 locali, anno di costruzione 1965, classe energetica G, spese condominiali 120");
  assert.deepEqual([c.piano, c.ascensore, c.stato, c.anno, c.classe, c.speseCondominio, c.bagni, c.locali],
    ["3", true, "da ristrutturare", 1965, "G", 120, 2, 4]);
});
t("__NEXT_DATA__ sintetico (immobiliare.it) + utag (idealista) + geo inline", () => {
  const nd = { props: { pageProps: { detailData: { realEstate: { price: { value: 349000 }, properties: [{
    surface: "95 m²", rooms: "3", bathrooms: "2", floor: { value: "3" }, elevator: true,
    condition: "Buono / Abitabile", energy: { class: "G" },
    location: { latitude: 41.8722, longitude: 12.5301, address: "via Appia Nuova", microzone: "Appio Latino" },
    multimedia: { photos: [{ caption: "Planimetria", urls: { large: "https://x.it/2.jpg" } }] } }] } } } } };
  const d = estraiJsonAnnuncio(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nd)}</script>`);
  assert.equal(d.prezzo, 349000); assert.equal(d.mq, 95); assert.equal(d.lat, 41.8722);
  assert.equal(d.quartiere, "Appio Latino"); assert.ok(d.foto[0].plan);
  const u = estraiJsonAnnuncio(`<script>var utag_data = {"ad_price":"295000","ad_area":"78","ad_condition":"toRestore"};</script>`);
  assert.equal(u.prezzo, 295000); assert.equal(normStato(u.car.stato), "da_ristrutturare");
  assert.equal(estraiGeoInline(`{"latitude":41.90278,"longitude":12.49636}`).lat, 41.90278);
});
t("parseListaSubito: fixture minima (privato sì, agenzia/malposto no)", () => {
  const mk = (company, price) => ({ kind: "AdItem", urn: "u" + price, subject: "x", body: "y",
    advertiser: { company }, urls: { default: "https://www.subito.it/a.htm" },
    features: { "/price": { values: [{ key: String(price) }] }, "/size": { values: [{ key: "80" }] } },
    geo: {}, images: [] });
  const nd = { props: { pageProps: { initialState: { items: { total: 3, originalList: [mk(false, 300000), mk(true, 310000), mk(false, 950)] } } } } };
  const { annunci } = parseListaSubito(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nd)}</script>`);
  assert.equal(annunci.length, 1); assert.equal(annunci[0].prezzo, 300000);
});

console.log("— geozone —");
t("landmark noti → zone corrette; fuori Roma → null", () => {
  assert.equal(zonaDaCoordinate(41.8757, 12.4747), "B1");   // Testaccio
  assert.equal(zonaDaCoordinate(41.8867, 12.4692), "B14");  // Trastevere
  assert.equal(zonaDaCoordinate(41.8300, 12.4720), "D29");  // EUR
  assert.equal(zonaDaCoordinate(41.8834, 12.5668), "D14");  // Centocelle
  assert.equal(zonaDaCoordinate(41.9139, 12.4184), "D45");  // Battistini
  assert.equal(zonaDaCoordinate(41.77, 12.24), null);
  assert.equal(zonaDaCoordinate(null, null), null);
});

console.log("— zones —");
t("deriveZoneNames/NameMap coerenti", () => {
  assert.ok(deriveZoneNames(omiData).length > 100);
  const m = deriveZoneNameMap(omiData);
  assert.ok(m.find((x) => x.nome === "CENTOCELLE"));
  for (const { codici } of m.slice(0, 20)) for (const c of codici) assert.ok(omiData.zone[c]);
});

console.log(`\n${ok} ok, ${fail} falliti`);
process.exit(fail ? 1 : 0);
