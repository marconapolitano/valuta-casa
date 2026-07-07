// Scanner privati (Subito.it): chiama /api/scan e rende la lista risultati.
// Ogni riga ha "Analizza" → CustomEvent "valuta-annuncio" che app.js intercetta
// per lanciare la valutazione completa (Claude + foto) precompilata.

function el(tag, cls, txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}

function fmtEur(n){return n.toLocaleString("it-IT")+" €";}

function riga(a){
  var row=el("div","scan-row");
  // badge sconto
  var tone=a.sconto==null?"na":(a.sconto>=8?"good":(a.sconto>=-3?"mid":"bad"));
  var badge=el("div","scan-badge "+tone, a.sconto==null?"?":((a.sconto>0?"+":"")+a.sconto+"%"));
  row.appendChild(badge);
  var col=el("div","scan-col");
  col.appendChild(el("div","scan-titolo",a.titolo||"(senza titolo)"));
  var bits=[fmtEur(a.prezzo), a.mq+" mq", a.eurMq.toLocaleString("it-IT")+" €/mq"];
  if(a.stato)bits.push(String(a.stato).replace("_"," "));
  col.appendChild(el("div","scan-meta",bits.join(" · ")));
  var zbits=[];
  if(a.zona)zbits.push("zona "+a.zona+(a.zonaNome?" "+a.zonaNome.split("(")[0].trim():"")+(a.fonteZona==="gps"?" ✓GPS":" ("+a.fonteZona+")"));
  else zbits.push("zona non identificata");
  if(a.benchmark)zbits.push("benchmark "+a.benchmark.toLocaleString("it-IT")+" €/mq");
  col.appendChild(el("div","scan-zona"+(a.fonteZona==="gps"?" ok":""),zbits.join(" · ")));
  var act=el("div","scan-act");
  var go=el("button","scan-btn","Analizza →");
  go.addEventListener("click",function(){document.dispatchEvent(new CustomEvent("valuta-annuncio",{detail:a}));});
  act.appendChild(go);
  if(a.url){var link=el("a","scan-link","Subito ↗");link.href=a.url;link.target="_blank";link.rel="noopener";act.appendChild(link);}
  col.appendChild(act);
  row.appendChild(col);
  return row;
}

export function initScan($, getPassword){
  var btn=$("scan"), out=$("scanout");
  btn.addEventListener("click",function(){
    var password=getPassword();
    if(!password){$("pwbox").style.display="block";alert("Inserisci la password (in alto) e riprova.");return;}
    btn.disabled=true;btn.innerHTML='<span class="spin"></span>Scansiono…';
    out.textContent="";
    fetch("/api/scan",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({password:password,prezzoMin:Number($("smin").value)||undefined,prezzoMax:Number($("smax").value)||undefined,mqMin:Number($("smq").value)||undefined,pagine:2})})
     .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});})
     .then(function(res){
       if(!res.ok){var e=el("div","errbox",res.j.error||"Errore");out.appendChild(e);return;}
       var ann=res.j.annunci||[];
       out.appendChild(el("div","scan-count",ann.length+" annunci di privati"+(res.j.totale?" (su "+res.j.totale+" totali nel budget)":"")+" — dal più scontato"));
       ann.forEach(function(a){out.appendChild(riga(a));});
       if(!ann.length)out.appendChild(el("div","scan-count","Nessun risultato: allarga budget o mq."));
     })
     .catch(function(e){var b=el("div","errbox","Errore di rete: "+e.message);out.appendChild(b);})
     .then(function(){btn.disabled=false;btn.textContent="Scansiona";});
  });
}
