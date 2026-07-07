// Math deterministica — QUI, NON nel prompt a Claude.
//
// Vincolo duro (commit 7080426 "Sconto calcolato dal backend, Claude sceglie
// solo la zona OMI"): il self-report aritmetico di Claude era inaffidabile
// (dava +9/+15% a caso, badge incoerente fra dispositivi). Claude ritorna un
// header di sole CLASSIFICAZIONI (ZONA/FIDUCIA/ZONA_ALT/STATO — giudizi, non
// aritmetica); QUESTO modulo è l'unico posto dove si fanno i CONTI.
// NON spostare i calcoli a Claude — è stato provato e si è rotto.
//
// v2: benchmark aggiustato per stato/piano (OMI censisce lo stato NORMALE:
// confrontare un ristrutturato e un rudere con lo stesso compr_med era la
// principale fonte di verdetti sballati) + rendimento NETTO con costi reali.

// ── Tutte le assunzioni economiche in un posto solo. Ritocca QUI. ──────────
export const CONFIG = {
  // correzione benchmark per stato reale (OMI = stato normale; ottimo/scadente
  // scostano di ±10-18% secondo la stessa Agenzia Entrate — valori prudenti)
  statoFactor:        { ottimo: 1.10, normale: 1.0, da_ristrutturare: 0.82 },
  statoAffittoFactor: { ottimo: 1.05, normale: 1.0, da_ristrutturare: 0.90 },
  pianoFactor:        { seminterrato: 0.78, terra: 0.93 }, // rialzato/piani alti: neutro
  ristruttEurMq: 900,       // ristrutturazione completa €/mq (Roma 2026, media)
  valCatSuPrezzo: 0.45,     // valore catastale ≈ 45% del prezzo (Roma, prudente)
  registro: { investimento: 0.09, prima_casa: 0.02 }, // imposta registro sul val. catastale (acquisto da privato)
  notaio: 3000,             // notaio + visure/istruttoria, forfait
  agenziaPct: 0.0366,       // 3% + IVA 22% se vende agenzia
  sfittoMesi: 1,            // vacancy media annua
  cedolare: 0.21,           // cedolare secca canone libero
  imuSuValCat: { investimento: 0.0106, prima_casa: 0 }, // aliquota Roma seconda casa
  manutPctLordo: 0.08,      // manutenzione ordinaria + imprevisti, % del lordo
  soglie: { affare: 8, caro: -3 }, // sconto % vs benchmark aggiustato
};

// normalizza stringhe stato (da Claude, dal form, o dal portale) → enum
export function normStato(s) {
  if (!s) return null;
  const lc = String(s).toLowerCase();
  if (/da[_ ]ristrutturare|da rifare|to.?restore|scadente/.test(lc)) return "da_ristrutturare";
  if (/ottimo|ristrutturato|nuov|excellent|renovated|signorile/.test(lc)) return "ottimo";
  if (/normale|buono|abitabile|good|discreto/.test(lc)) return "normale";
  return null;
}

// normalizza piano (numero, "terra", "S1", "T", "3° piano"...) → chiave pianoFactor o null
function normPiano(p) {
  if (p == null) return null;
  const lc = String(p).toLowerCase();
  if (/semint|interrat|^s\d?$|^-\d/.test(lc)) return "seminterrato";
  if (/terra|terreno|^t$|^0$/.test(lc)) return "terra";
  return null;
}

// estrae l'header di classificazioni dalla risposta di Claude, righe opzionali
// e in qualsiasi ordine (retro-compatibile col vecchio formato solo-ZONA).
function parseHeader(opinioneGrezza) {
  let op = opinioneGrezza;
  const take = (re) => {
    const m = op.match(re);
    if (!m) return null;
    op = op.replace(m[0], "");
    return m[1];
  };
  const zona = take(/^\s*ZONA:\s*([A-Z]\d{1,3})\s*$/im) || take(/ZONA:\s*([A-Z]\d{1,3})/i);
  const fiducia = (take(/^\s*FIDUCIA:\s*(alta|media|bassa)\s*$/im) || "").toLowerCase() || null;
  let zonaAlt = take(/^\s*ZONA_ALT:\s*([A-Z]\d{1,3}|-)\s*$/im);
  if (zonaAlt === "-") zonaAlt = null;
  const stato = normStato(take(/^\s*STATO:\s*(ottimo|normale|da[_ ]ristrutturare)\s*$/im));
  return { zona: zona ? zona.toUpperCase() : null, fiducia, zonaAlt: zonaAlt ? zonaAlt.toUpperCase() : null, stato, opinione: op.replace(/^\s+/, "") };
}

// rendimento affitto: lordo semplice + netto con costi reali, tutto esplicito.
function calcolaRendimento(z, { prezzo, mq, stato, uso, agenzia }) {
  if (!z.loc_min || !z.loc_max) return null;
  const canoneMese = Math.round(((z.loc_min + z.loc_max) / 2) * CONFIG.statoAffittoFactor[stato] * mq);
  const lordoAnnuo = canoneMese * 12;
  const sfitto = Math.round(lordoAnnuo * CONFIG.sfittoMesi / 12);
  const incassato = lordoAnnuo - sfitto;
  const cedolare = Math.round(incassato * CONFIG.cedolare);
  const valCat = prezzo * CONFIG.valCatSuPrezzo;
  const imu = Math.round(valCat * CONFIG.imuSuValCat[uso]);
  const manut = Math.round(lordoAnnuo * CONFIG.manutPctLordo);
  const nettoAnnuo = incassato - cedolare - imu - manut;
  // costo totale d'ingresso: è il denominatore giusto per il netto
  const registro = Math.max(1000, Math.round(valCat * CONFIG.registro[uso]));
  const ristrutturazione = stato === "da_ristrutturare" ? mq * CONFIG.ristruttEurMq : 0;
  const agenziaCosto = agenzia ? Math.round(prezzo * CONFIG.agenziaPct) : 0;
  const costoTotale = prezzo + registro + CONFIG.notaio + agenziaCosto + ristrutturazione;
  return {
    lordo: +((lordoAnnuo / prezzo) * 100).toFixed(1),
    netto: +((nettoAnnuo / costoTotale) * 100).toFixed(1),
    canoneMese, lordoAnnuo, nettoAnnuo, costoTotale, uso,
    voci: { sfitto, cedolare, imu, manutenzione: manut, registro, notaio: CONFIG.notaio, agenzia: agenziaCosto, ristrutturazione },
  };
}

// dati: { prezzo, mq, car, uso, statoManuale, agenzia }
// Ritorna { opinione, zonaCode, fiducia, zonaAlt, stato, sconto, scontoSuMed,
//           esito, benchmark, aggiustamenti, omi, eurMq, rendimento } — null nei
// campi se zona non riconosciuta o mancano dati.
export function calcolaValutazione(opinioneGrezza, omiData, dati) {
  const h = parseHeader(opinioneGrezza);
  const out = { opinione: h.opinione, zonaCode: h.zona, fiducia: h.fiducia, zonaAlt: h.zonaAlt,
    stato: null, sconto: null, scontoSuMed: null, esito: null, benchmark: null,
    aggiustamenti: [], omi: null, eurMq: null, rendimento: null };

  const z = h.zona && omiData.zone[h.zona];
  if (!z || !dati.prezzo || !dati.mq) return out;

  // precedenza stato: scelta manuale utente > giudizio Claude (vede le foto) > testo annuncio
  const stato = normStato(dati.statoManuale) || h.stato || normStato(dati.car && dati.car.stato) || "normale";
  out.stato = stato;
  out.eurMq = Math.round(dati.prezzo / dati.mq);
  out.omi = { min: z.compr_min, med: z.compr_med, max: z.compr_max };

  // benchmark = OMI med × fattori dichiarati (ognuno tracciato per la UI)
  let f = CONFIG.statoFactor[stato];
  if (stato !== "normale")
    out.aggiustamenti.push({ label: "stato " + stato.replace("_", " "), pct: Math.round((CONFIG.statoFactor[stato] - 1) * 100) });
  const pt = normPiano(dati.car && dati.car.piano);
  if (pt && CONFIG.pianoFactor[pt]) {
    f *= CONFIG.pianoFactor[pt];
    out.aggiustamenti.push({ label: "piano " + pt, pct: Math.round((CONFIG.pianoFactor[pt] - 1) * 100) });
  }
  out.benchmark = Math.round(z.compr_med * Math.max(0.6, Math.min(1.25, f)));
  out.sconto = Math.round(((out.benchmark - out.eurMq) / out.benchmark) * 100);
  out.scontoSuMed = Math.round(((z.compr_med - out.eurMq) / z.compr_med) * 100);
  out.esito = out.sconto >= CONFIG.soglie.affare ? "AFFARE" : (out.sconto >= CONFIG.soglie.caro ? "IN LINEA" : "CARO");

  const uso = dati.uso === "prima_casa" ? "prima_casa" : "investimento";
  out.rendimento = calcolaRendimento(z, { prezzo: dati.prezzo, mq: dati.mq, stato, uso, agenzia: !!dati.agenzia });
  return out;
}
