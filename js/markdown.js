// mini markdown -> HTML (l'opinione viene da Claude via ns backend; comunque escape su < & >)
export function md2html(s){
  function esc(t){return t.replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
  var lines=esc(s).split("\n"),out=[],i=0,inTbl=false,inUl=false;
  function closeUl(){if(inUl){out.push("</ul>");inUl=false;}}
  function closeTbl(){if(inTbl){out.push("</tbody></table>");inTbl=false;}}
  while(i<lines.length){
    var l=lines[i];
    if(/^\s*\|.*\|\s*$/.test(l)){
      var cells=l.trim().replace(/^\||\|$/g,"").split("|");
      if(/^[\s:|-]+$/.test(l.replace(/\|/g,""))){i++;continue;}
      if(!inTbl){out.push('<table><tbody>');inTbl=true;}
      out.push("<tr>"+cells.map(function(c){return "<td>"+inline(c.trim())+"</td>";}).join("")+"</tr>");
      i++;continue;
    } else closeTbl();
    var h=l.match(/^(#{1,3})\s+(.*)/);
    if(h){closeUl();out.push("<h"+h[1].length+">"+inline(h[2])+"</h"+h[1].length+">");i++;continue;}
    if(/^\s*[-*]\s+/.test(l)){if(!inUl){out.push("<ul>");inUl=true;}out.push("<li>"+inline(l.replace(/^\s*[-*]\s+/,""))+"</li>");i++;continue;}
    closeUl();
    if(/^\s*---+\s*$/.test(l)){out.push("<hr>");i++;continue;}
    if(l.trim()==="")out.push("");else out.push("<p>"+inline(l)+"</p>");
    i++;
  }
  closeUl();closeTbl();
  return out.join("");
  function inline(t){return t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/`(.+?)`/g,"<code>$1</code>");}
}
