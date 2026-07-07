// Serverless function (Vercel): scanner annunci PRIVATI Subito.it vs OMI.
//
// POST {password, prezzoMin, prezzoMax, mqMin, pagine}
// → lista annunci valutati DETERMINISTICAMENTE, zero chiamate AI (gratis):
//   zona da GPS + poligoni ufficiali (o nome-zona nel testo), benchmark
//   corretto per stato dichiarato, sconto %. Ordinati dal più scontato.
// L'analisi completa (Claude + foto) parte dal frontend sul singolo annuncio.

import omiData from "../data/omi_roma_compatto.json" with { type: "json" };
import { deriveZoneNameMap } from "./_lib/zones.js";
import { zonaDaCoordinate } from "./_lib/geozone.js";
import { cercaPrivati } from "./_lib/subito.js";
import { normStato, CONFIG } from "./_lib/valuation.js";

const NAME_MAP = deriveZoneNameMap(omiData);

// rate limit separato dalla valutazione (lo scan non costa AI ma martella Subito)
const hits = new Map();
const LIMIT_PER_DAY = 20;
function rateOk(ip) {
  const key = `${ip}|${new Date().toISOString().slice(0, 10)}`;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  return n <= LIMIT_PER_DAY;
}

// zona per annuncio: GPS+poligoni (certa) > nome-zona nel testo (indicativa)
function stimaZona(a) {
  if (a.lat != null) {
    const z = zonaDaCoordinate(a.lat, a.lng);
    if (z) return { zona: z, fonteZona: "gps" };
  }
  const hay = ((a.titolo || "") + " " + (a.indirizzo || "") + " " + (a.descrizione || "")).toUpperCase();
  for (const { nome, codici } of NAME_MAP) {
    if (hay.includes(nome)) return { zona: codici[0], fonteZona: codici.length > 1 ? "nome (ambiguo)" : "nome" };
  }
  return { zona: null, fonteZona: null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { password, prezzoMin, prezzoMax, mqMin, pagine } = req.body || {};
    if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD)
      return res.status(401).json({ error: "Password errata" });
    const ip = (req.headers["x-forwarded-for"] || "anon").split(",")[0];
    if (!rateOk(ip))
      return res.status(429).json({ error: `Limite scan ${LIMIT_PER_DAY}/giorno raggiunto` });

    const { annunci, totale } = await cercaPrivati({
      prezzoMin: Number(prezzoMin) || undefined,
      prezzoMax: Number(prezzoMax) || undefined,
      mqMin: Number(mqMin) || 0,
      pagine: Math.min(Number(pagine) || 2, 3),
    });

    const out = annunci.map((a) => {
      const { zona, fonteZona } = stimaZona(a);
      const z = zona && omiData.zone[zona];
      const stato = normStato(a.stato) || "normale";
      const eurMq = Math.round(a.prezzo / a.mq);
      let benchmark = null, sconto = null;
      if (z) {
        benchmark = Math.round(z.compr_med * CONFIG.statoFactor[stato]);
        sconto = Math.round(((benchmark - eurMq) / benchmark) * 100);
      }
      return { ...a, zona, zonaNome: z ? z.nome : null, fonteZona, stato, eurMq, benchmark, sconto };
    });
    // dal più scontato; senza zona in fondo (non valutabili deterministicamente)
    out.sort((a, b) => (b.sconto ?? -999) - (a.sconto ?? -999));

    return res.status(200).json({ annunci: out, totale });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
