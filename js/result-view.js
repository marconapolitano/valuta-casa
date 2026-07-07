import {md2html} from "./markdown.js";
import {buildVerdict, barPos, fmtK} from "./verdict.js";

// helper DOM (no innerHTML su valori dinamici)
function el(tag, cls, txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}

// chips caratteristiche estratte (piano, stato, ascensore…) — solo campi presenti
function buildChips(dati){
  var c=(dati&&dati.car)||{};
  var chips=[];
  if(dati&&dati.stato)chips.push({t:"stato: "+String(dati.stato).replace("_"," "),k:dati.stato==="ottimo"?"good":(dati.stato==="da_ristrutturare"?"bad":"")});
  if(c.piano!=null)chips.push({t:"piano "+c.piano});
  if(c.ascensore===true)chips.push({t:"ascensore ✓"});
  if(c.ascensore===false)chips.push({t:"no ascensore",k:"bad"});
  if(c.locali)chips.push({t:c.locali+" locali"});
  if(c.bagni)chips.push({t:c.bagni+(c.bagni>1?" bagni":" bagno")});
  if(c.anno)chips.push({t:"anno "+c.anno});
  if(c.classe)chips.push({t:"classe "+c.classe});
  if(c.terrazzo)chips.push({t:"terrazzo"});
  else if(c.balcone)chips.push({t:"balcone"});
  if(c.box)chips.push({t:"box/posto auto"});
  if(c.speseCondominio)chips.push({t:"cond. "+c.speseCondominio+" €/mese"});
  return chips;
}

export function showResult($, opinione, err, dati){
  $("form").style.display="none";
  var r=$("result");r.className="show";
  var v=$("verdict"),md=$("md");
  if(err){v.innerHTML="";md.className="";md.innerHTML='<div class="errbox"></div>';md.querySelector(".errbox").textContent=err;window.scrollTo({top:0,behavior:"smooth"});return;}
  md.className="md";
  var vd=buildVerdict(opinione,dati);
  v.className="verdict "+vd.tone;

  // meta riga: foto + planimetrie analizzate
  var nFoto=(dati&&dati.nFoto)||0, nPlan=(dati&&dati.nPlan)||0;
  var bits=[];
  if(nPlan)bits.push("🗺️ "+nPlan+" planimetri"+(nPlan>1?"e":"a"));
  if(nFoto-nPlan>0)bits.push("📷 "+(nFoto-nPlan)+" foto");
  var metaTxt=bits.length?bits.join(" · ")+" analizzate":"";

  v.innerHTML="";
  var top=el("div","vtop");
  var big=el("div","vbig "+vd.tone,vd.big);
  var col=el("div");
  col.appendChild(el("div","vlabel",vd.label));
  col.appendChild(el("div","vsub",vd.sub));
  if(metaTxt)col.appendChild(el("div","vmeta",metaTxt));
  top.appendChild(big);top.appendChild(col);
  v.appendChild(top);

  // riga zona + fiducia + benchmark aggiustato
  if(dati&&dati.zona){
    var zbits=["Zona "+dati.zona+(dati.zonaNome?" — "+dati.zonaNome.split("(")[0].trim():"")];
    if(dati.fiducia)zbits.push("fiducia "+dati.fiducia);
    if(dati.zonaAlt)zbits.push("alternativa: "+dati.zonaAlt+(dati.zonaAltNome?" "+dati.zonaAltNome.split("(")[0].trim():""));
    var zl=el("div","zline",zbits.join(" · "));
    if(dati.fiducia==="bassa")zl.classList.add("warn");
    v.appendChild(zl);
    if(dati.benchmark&&dati.aggiustamenti&&dati.aggiustamenti.length){
      var agg=dati.aggiustamenti.map(function(a){return a.label+" "+(a.pct>0?"+":"")+a.pct+"%";}).join(", ");
      v.appendChild(el("div","zline sub","benchmark "+dati.benchmark.toLocaleString("it-IT")+" €/mq (OMI medio "+dati.omi.med.toLocaleString("it-IT")+" corretto: "+agg+")"));
    }
  }

  // chips caratteristiche
  var chips=buildChips(dati);
  if(chips.length){
    var cw=el("div","chips");
    chips.forEach(function(c){cw.appendChild(el("span","chip"+(c.k?" "+c.k:""),c.t));});
    v.appendChild(cw);
  }

  // barra range OMI (solo se ho eurMq + omi)
  if(dati&&dati.eurMq&&dati.omi&&dati.omi.min){
    var pos=Math.max(0,Math.min(100,barPos(dati.eurMq,dati.omi)));
    var posMed=Math.max(0,Math.min(100,barPos(dati.omi.med,dati.omi)));
    var g=el("div","gauge");
    var track=el("div","gauge-track");
    var medM=el("div","gauge-med");medM.style.left=posMed+"%";
    var dot=el("div","gauge-dot");dot.style.left=pos+"%";
    track.appendChild(medM);track.appendChild(dot);
    var lbls=el("div","gauge-lbls");
    var l1=el("span"),l2=el("span"),l3=el("span");
    l1.innerHTML="<b>"+fmtK(dati.omi.min)+"</b> min";
    l2.innerHTML="medio <b>"+fmtK(dati.omi.med)+"</b>";
    l3.innerHTML="max <b>"+fmtK(dati.omi.max)+"</b>";
    lbls.appendChild(l1);lbls.appendChild(l2);lbls.appendChild(l3);
    var cur=el("div","gauge-cur","questo annuncio: "+dati.eurMq.toLocaleString("it-IT")+" €/mq"+(dati.zona?" · zona "+dati.zona:""));
    g.appendChild(track);g.appendChild(lbls);g.appendChild(cur);
    v.appendChild(g);
  }

  // rendimento: lordo/netto + voci di costo (breakdown deterministico dal backend)
  var rd=dati&&dati.rendimento;
  if(rd&&typeof rd.netto==="number"){
    var box=el("div","rend");
    var head=el("div","rend-head");
    head.appendChild(el("span","rend-big",rd.netto+"% netto"));
    head.appendChild(el("span","rend-sub"," · "+rd.lordo+"% lordo · "+rd.canoneMese.toLocaleString("it-IT")+" €/mese stimati"+(rd.uso==="prima_casa"?" · prima casa":"")));
    box.appendChild(head);
    var rows=[
      ["Costo totale ingresso",rd.costoTotale,""],
      ["Imposte + notaio",rd.voci.registro+rd.voci.notaio,""],
      rd.voci.agenzia?["Agenzia (3%+IVA)",rd.voci.agenzia,""]:null,
      rd.voci.ristrutturazione?["Ristrutturazione stimata",rd.voci.ristrutturazione,""]:null,
      ["Sfitto (1 mese/anno)",-rd.voci.sfitto,"anno"],
      ["Cedolare secca 21%",-rd.voci.cedolare,"anno"],
      rd.voci.imu?["IMU stimata",-rd.voci.imu,"anno"]:null,
      ["Manutenzione/varie",-rd.voci.manutenzione,"anno"],
      ["Netto in tasca",rd.nettoAnnuo,"anno"]
    ].filter(Boolean);
    var tbl=el("div","rend-rows");
    rows.forEach(function(row){
      var line=el("div","rend-row");
      line.appendChild(el("span","",row[0]));
      var val=(row[1]<0?"−":"")+Math.abs(row[1]).toLocaleString("it-IT")+" €"+(row[2]?"/"+row[2]:"");
      line.appendChild(el("span",row[1]<0?"neg":"",val));
      tbl.appendChild(line);
    });
    box.appendChild(tbl);
    box.appendChild(el("div","rend-note","stime deterministiche su OMI + assunzioni fiscali standard (modificabili in api/_lib/valuation.js)"));
    v.appendChild(box);
  }

  md.innerHTML=md2html(opinione);
  window.scrollTo({top:0,behavior:"smooth"});
}
