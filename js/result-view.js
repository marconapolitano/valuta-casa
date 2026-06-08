import {md2html} from "./markdown.js";
import {buildVerdict, barPos, fmtK} from "./verdict.js";

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

  // costruzione DOM (no innerHTML su valori dinamici)
  v.innerHTML="";
  var top=document.createElement("div");top.className="vtop";
  var big=document.createElement("div");big.className="vbig "+vd.tone;big.textContent=vd.big;
  var col=document.createElement("div");
  var lab=document.createElement("div");lab.className="vlabel";lab.textContent=vd.label;
  var sub=document.createElement("div");sub.className="vsub";sub.textContent=vd.sub;
  col.appendChild(lab);col.appendChild(sub);
  if(metaTxt){var m=document.createElement("div");m.className="vmeta";m.textContent=metaTxt;col.appendChild(m);}
  top.appendChild(big);top.appendChild(col);
  v.appendChild(top);

  // barra range OMI (solo se ho eurMq + omi)
  if(dati&&dati.eurMq&&dati.omi&&dati.omi.min){
    var pos=Math.max(0,Math.min(100,barPos(dati.eurMq,dati.omi)));
    var posMed=Math.max(0,Math.min(100,barPos(dati.omi.med,dati.omi)));
    var g=document.createElement("div");g.className="gauge";
    var track=document.createElement("div");track.className="gauge-track";
    var medM=document.createElement("div");medM.className="gauge-med";medM.style.left=posMed+"%";
    var dot=document.createElement("div");dot.className="gauge-dot";dot.style.left=pos+"%";
    track.appendChild(medM);track.appendChild(dot);
    var lbls=document.createElement("div");lbls.className="gauge-lbls";
    lbls.innerHTML="";
    var l1=document.createElement("span"),l2=document.createElement("span"),l3=document.createElement("span");
    l1.innerHTML="<b>"+fmtK(dati.omi.min)+"</b> min";
    l2.innerHTML="medio <b>"+fmtK(dati.omi.med)+"</b>";
    l3.innerHTML="max <b>"+fmtK(dati.omi.max)+"</b>";
    lbls.appendChild(l1);lbls.appendChild(l2);lbls.appendChild(l3);
    var cur=document.createElement("div");cur.className="gauge-cur";
    cur.textContent="questo annuncio: "+dati.eurMq.toLocaleString("it-IT")+" €/mq"+(dati.zona?" · zona "+dati.zona:"");
    g.appendChild(track);g.appendChild(lbls);g.appendChild(cur);
    v.appendChild(g);
  }

  md.innerHTML=md2html(opinione);
  window.scrollTo({top:0,behavior:"smooth"});
}
