// Entry point pagina scanner (scan.html): password condivisa via localStorage
// (stessa chiave della pagina valuta) + wiring dello scanner.
import {initScan} from "./scan-view.js";

var $=function(i){return document.getElementById(i);};
var pw=localStorage.getItem("vc_pw"); if(!pw)$("pwbox").style.display="block";

initScan($,function(){
  var v=pw||$("pw").value.trim();
  if(v){localStorage.setItem("vc_pw",v);pw=v;}
  return v;
});
