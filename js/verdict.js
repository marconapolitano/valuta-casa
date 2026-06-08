// badge verdetto dai campi STRUTTURATI del backend (sconto/esito calcolati, non pescati dal testo)
export function buildVerdict(op,dati){
  var pct = (dati && typeof dati.sconto==="number") ? dati.sconto : null;
  var esito = (dati && dati.esito) ? dati.esito : null;
  var tone="mid",big="—",label="Valutazione",sub="Da valutare";
  if(pct!==null){
    big=(pct>0?"+":"")+pct+"%";
    if(pct>=8){tone="good";label="Sotto mercato";sub="Possibile affare";}
    else if(pct>=-3){tone="mid";label="In linea";sub="In linea col mercato";}
    else{tone="bad";label="Sopra mercato";sub="Probabilmente caro";}
  } else if(esito){
    if(esito==="AFFARE"){tone="good";big="Sì";label="Affare";sub="Sotto mercato";}
    else if(esito==="CARO"){tone="bad";big="No";label="Caro";sub="Sopra mercato";}
    else{tone="mid";big="≈";label="In linea";}
  }
  return {tone:tone,big:big,label:label,sub:sub};
}

export function barPos(eurMq, omi){
  var sp=omi.max-omi.min || 1;
  var base=omi.min-0.2*sp, top=omi.max+0.2*sp; // scala estesa ±20%: fuori-range resta visibile
  return (eurMq-base)/(top-base)*100;
}

export function fmtK(n){return n>=1000?(n/1000).toFixed(n%1000?1:0).replace(".",",")+"k":String(n);}
