// Math deterministica — QUI, NON nel prompt a Claude.
//
// Vincolo duro (commit 7080426 "Sconto calcolato dal backend, Claude sceglie
// solo la zona OMI"): il self-report aritmetico di Claude era inaffidabile
// (dava +9/+15% a caso, badge incoerente fra dispositivi). Fix: Claude ritorna
// SOLO "ZONA: <codice>" in prima riga; QUESTO modulo calcola sconto/rendimento
// dal JSON OMI. Numeri deterministici, identici su ogni device, ogni volta.
// NON spostare questo calcolo a Claude — è stato provato e si è rotto.

// estrae il codice zona dalla risposta di Claude e calcola tutto il resto
// deterministicamente. Ritorna { opinione (ripulita), zonaCode, sconto, esito,
// rendimento, omi, eurMq } — null nei campi se zona non riconosciuta o mancano dati.
export function calcolaValutazione(opinioneGrezza, omiData, prezzo, mq) {
  let opinione = opinioneGrezza;
  let zonaCode = null, sconto = null, esito = null, rendimento = null, eurMq = null, omi = null;

  const zm = opinione.match(/ZONA:\s*([A-Z]\d{1,3})/i);
  if (zm) {
    zonaCode = zm[1].toUpperCase();
    opinione = opinione.replace(zm[0], "").replace(/^\s+/, "");
    const z = omiData.zone[zonaCode];
    if (z && prezzo && mq) {
      eurMq = Math.round(prezzo / mq);
      sconto = Math.round(((z.compr_med - eurMq) / z.compr_med) * 100);
      esito = sconto >= 8 ? "AFFARE" : (sconto >= -3 ? "IN LINEA" : "CARO");
      omi = { min: z.compr_min, med: z.compr_med, max: z.compr_max }; // per barra visiva
      if (z.loc_min && z.loc_max) {
        const locMed = (z.loc_min + z.loc_max) / 2;
        rendimento = +(((locMed * mq * 12) / prezzo) * 100).toFixed(1);
      }
    }
  }

  return { opinione, zonaCode, sconto, esito, rendimento, omi, eurMq };
}
