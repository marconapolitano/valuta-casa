import {showResult} from "./result-view.js";
import {populateZoneList} from "./zones.js";

var $=function(i){return document.getElementById(i);};
populateZoneList($("zonelist"));
var pw=localStorage.getItem("vc_pw"); if(!pw)$("pwbox").style.display="block";

var EXT=null; // dati extra da estensione (foto+planimetrie, caratteristiche, coordinate) non in form
(function(){var p=new URLSearchParams(location.search).get("d");if(!p)return;try{var d=JSON.parse(decodeURIComponent(escape(atob(p))));EXT=d;if(d.url)$("url").value=d.url;if(d.price)$("prezzo").value=d.price;if(d.mq)$("mq").value=d.mq;if(d.zona)$("zona").value=d.zona;else if(d.indirizzo)$("zona").value=d.indirizzo;if(d.note||d.agenzia)$("note").value=[d.note,d.agenzia?"agenzia":""].filter(Boolean).join("; ");if(pw&&d.price&&d.mq)setTimeout(function(){$("go").click();},300);}catch(e){}})();

$("again").addEventListener("click",function(){$("result").className="";$("form").style.display="block";window.scrollTo({top:0,behavior:"smooth"});});

$("go").addEventListener("click",function(){
  var password=pw||$("pw").value;
  if(!password){$("pwbox").style.display="block";return;}
  localStorage.setItem("vc_pw",password);pw=password;
  var body={password:password,url:$("url").value.trim()||undefined,prezzo:$("prezzo").value?Number($("prezzo").value):undefined,mq:$("mq").value?Number($("mq").value):undefined,indirizzo:$("zona").value.trim()||undefined,note:$("note").value.trim()||undefined,uso:$("uso").value,stato:$("stato").value||undefined};
  if(EXT){
    if(EXT.foto&&EXT.foto.length)body.foto=EXT.foto;
    if(EXT.descrizione)body.descrizione=EXT.descrizione;
    if(EXT.car)body.car=EXT.car;                       // caratteristiche strutturate (piano, stato, ascensore…)
    if(EXT.lat!=null){body.lat=EXT.lat;body.lng=EXT.lng;} // coordinate esatte → geocoding preciso
    if(EXT.agenzia)body.agenzia=true;
  }
  if(/agenzia/i.test(body.note||""))body.agenzia=true;
  if(!body.url&&(!body.prezzo||!body.mq||!body.indirizzo)){alert("Incolla un link, oppure prezzo + m² + zona.");return;}
  var g=$("go");g.disabled=true;g.innerHTML='<span class="spin"></span>Analizzo…';
  fetch("/api/valuta",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
   .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});})
   .then(function(res){
     if(!res.ok){showResult($,null,res.j.error||"Errore");}
     else{showResult($,res.j.opinione,null,res.j.dati);}
   })
   .catch(function(e){showResult($,null,"Errore di rete: "+e.message);})
   .then(function(){g.disabled=false;g.textContent="Valuta";});
});
