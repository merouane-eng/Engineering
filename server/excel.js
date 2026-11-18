/* Petit lecteur/écrivain XLSX Office Open XML, sans dépendance externe.
   Tout le contenu est traité en mémoire. Les formules importées ne sont jamais évaluées. */
import { inflateRawSync, deflateRawSync } from "node:zlib";

const MAX_UPLOAD = 3 * 1024 * 1024;
const MAX_UNPACKED = 18 * 1024 * 1024;
const MAX_ROWS = 1200;
const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
const utf8 = value => Buffer.from(String(value), "utf8");
const esc = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const unesc = text => String(text ?? "").replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16)))
  .replace(/&#([0-9]+);/g,(_,x)=>String.fromCodePoint(Number(x)))
  .replace(/&(amp|lt|gt|quot|apos);/g,(_,x)=>({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[x]));
const crcTable=Array.from({length:256},(_,i)=>{
  let c=i;
  for(let n=0;n<8;n++) c=(c&1)?0xedb88320^(c>>>1):(c>>>1);
  return c>>>0;
});
function crc32(data){
  let c=0xffffffff;
  for(const b of data) c=crcTable[(c^b)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function zip(entries){
  const local=[],central=[];let offset=0;
  for(const [name,raw] of Object.entries(entries)){
    const nameBuf=utf8(name),buf=utf8(raw),compressed=deflateRawSync(buf),crc=crc32(buf);
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0,6);
    header.writeUInt16LE(8,8);header.writeUInt32LE(crc,14);
    header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(buf.length,22);
    header.writeUInt16LE(nameBuf.length,26);
    local.push(header,nameBuf,compressed);
    const cd=Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);
    cd.writeUInt16LE(8,10);cd.writeUInt32LE(crc,16);
    cd.writeUInt32LE(compressed.length,20);cd.writeUInt32LE(buf.length,24);
    cd.writeUInt16LE(nameBuf.length,28);cd.writeUInt32LE(offset,42);
    central.push(cd,nameBuf);
    offset+=header.length+nameBuf.length+compressed.length;
  }
  const cdBuf=Buffer.concat(central);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);
  end.writeUInt32LE(cdBuf.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,cdBuf,end]);
}
function unzip(buffer){
  if(buffer.length>MAX_UPLOAD) throw new Error("Le fichier dépasse 3 Mo.");
  let end=-1;
  for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--){
    if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
  }
  if(end<0) throw new Error("Fichier XLSX non valide.");
  const count=buffer.readUInt16LE(end+10);
  if(count>60) throw new Error("Trop de fichiers internes dans le classeur.");
  let p=buffer.readUInt32LE(end+16),total=0;
  const files=new Map();
  for(let i=0;i<count;i++){
    if(p+46>buffer.length||buffer.readUInt32LE(p)!==0x02014b50) throw new Error("Archive XLSX corrompue.");
    const method=buffer.readUInt16LE(p+10),length=buffer.readUInt32LE(p+20);
    const size=buffer.readUInt32LE(p+24),n=buffer.readUInt16LE(p+28),x=buffer.readUInt16LE(p+30),comment=buffer.readUInt16LE(p+32);
    const local=buffer.readUInt32LE(p+42);
    const name=buffer.subarray(p+46,p+46+n).toString("utf8");
    if(size>MAX_UNPACKED||total+size>MAX_UNPACKED) throw new Error("Classeur XLSX trop volumineux après décompression.");
    if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50) throw new Error("Entrée ZIP corrompue.");
    const ln=buffer.readUInt16LE(local+26),le=buffer.readUInt16LE(local+28),start=local+30+ln+le;
    if(start+length>buffer.length) throw new Error("Fichier ZIP tronqué.");
    const payload=buffer.subarray(start,start+length);
    const content=method===8?inflateRawSync(payload,{maxOutputLength:MAX_UNPACKED}):method===0?payload:null;
    if(!content||content.length!==size) throw new Error("Compression XLSX non prise en charge.");
    if(crc32(content)!==buffer.readUInt32LE(p+16)) throw new Error("Intégrité du XLSX incorrecte.");
    files.set(name,content.toString("utf8"));total+=size;
    p+=46+n+x+comment;
  }
  return files;
}
const refToIndex = ref => {
  const letters=(ref.match(/^[A-Z]+/i)||[])[0]||"A";
  let i=0;for(const ch of letters.toUpperCase()) i=i*26+(ch.charCodeAt(0)-64);
  return i-1;
};
const columnRef = index => {
  let n=index+1,result="";
  while(n){n--;result=String.fromCharCode(65+n%26)+result;n=Math.floor(n/26);}
  return result;
};
const slash = String.fromCharCode(92);
const anyXml = "[" + slash + "s" + slash + "S]*?";
const extract = (xml,tag) => {
  const result=[];
  const re=new RegExp("<(?:[a-z]+:)?" + tag + "(?:" + slash + "s[^>]*)?>(" + anyXml + ")</(?:[a-z]+:)?" + tag + ">","g");
  let m;while((m=re.exec(xml)))result.push(m[1]);
  return result;
};
const innerText = x => extract(x,"t").map(unesc).join("");
const attribute = (tag,key) => {
  const m=tag.match(new RegExp(key+'="([^"]*)"'));
  return m?unesc(m[1]):"";
};
export function readXlsx(buffer){
  const files=unzip(buffer);
  let sheet=files.get("xl/worksheets/sheet1.xml");
  if(!sheet){
    const rel=files.get("xl/_rels/workbook.xml.rels")||"";
    const sheetId=(files.get("xl/workbook.xml")||"").match(/<sheet[^>]*r:id="([^"]+)"/)?.[1];
    const target=sheetId&&rel.match(new RegExp('<Relationship[^>]*Id="'+sheetId+'"[^>]*Target="([^"]+)"'))?.[1];
    if(target){
      const name=target.startsWith("/")?target.slice(1):"xl/"+target;
      sheet=files.get(name.startsWith("xl/")?name:"xl/"+name);
    }
  }
  if(!sheet) throw new Error("Première feuille Excel introuvable.");
  const shared=extract(files.get("xl/sharedStrings.xml")||"","si").map(innerText);
  const rows=[];
  const rowRegex=new RegExp("<(?:[a-z]+:)?row[^>]*>("+anyXml+")</(?:[a-z]+:)?row>","g");
  let match;
  while((match=rowRegex.exec(sheet))){
    if(rows.length>=MAX_ROWS+1) throw new Error("Maximum 1 200 lignes par import.");
    const cells=[];
    const cellRegex=new RegExp("<(?:[a-z]+:)?c([^>]*?)(?:/>|>("+anyXml+")</(?:[a-z]+:)?c>)","g");
    let m;
    while((m=cellRegex.exec(match[1]))){
      const attrs=m[1],content=m[2]||"",index=refToIndex(attribute(attrs,"r"));
      if(index>200) throw new Error("Trop de colonnes dans le fichier.");
      const t=attribute(attrs,"t");
      let value=t==="inlineStr"?innerText(content):extract(content,"v")[0];
      if(t==="s") value=shared[Number(value)]??"";
      else if(t==="b")value=value==="1";
      else if(t==="str"||t==="e")value=unesc(value??"");
      else if(value!==undefined&&value!==null&&value!==""){
        if(t!=="inlineStr" && !Number.isNaN(Number(value)))value=Number(value);
        else value=unesc(value);
      }
      cells[index]=value??"";
    }
    rows.push(cells);
  }
  if(!rows.length)throw new Error("Classeur vide.");
  return rows;
}
export function makeXlsx(columns,rows,{name="Données",instructions=[]}={}){
  if(!Array.isArray(columns)||!columns.length)throw new Error("Colonnes manquantes");
  const data=[columns.map(c=>typeof c==="string"?c:c.label),...rows];
  const mkSheet=all=>{
    const content=all.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((cell,j)=>{
      const ref=columnRef(j)+(i+1);
      // Toute cellule est une chaîne littérale : aucune formule importée/exportée n'est exécutée.
      const text=cell===null||cell===undefined?"":String(cell);
      return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+esc(text)+'</t></is></c>';
    }).join("")+"</row>").join("");
    const last=columnRef(Math.max(0,(all[0]||[]).length-1))+(all.length||1);
    return XML+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<dimension ref="A1:'+last+'"/><sheetViews><sheetView workbookViewId="0">'+
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
      '<sheetFormatPr defaultRowHeight="16"/><sheetData>'+content+'</sheetData>'+
      '<autoFilter ref="A1:'+last+'"/></worksheet>';
  };
  const haveNotes=instructions.length>0;
  const wb=XML+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
    '<sheet name="'+esc(name.slice(0,31))+'" sheetId="1" r:id="rId1"/>'+
    (haveNotes?'<sheet name="Instructions" sheetId="2" r:id="rId2"/>':"")+
    '</sheets></workbook>';
  const rels=XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
    (haveNotes?'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>':"")+
    '</Relationships>';
  const types=XML+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
    (haveNotes?'<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>':"")+
    '</Types>';
  const files={
    "[Content_Types].xml":types,
    "_rels/.rels":XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":wb,"xl/_rels/workbook.xml.rels":rels,
    "xl/worksheets/sheet1.xml":mkSheet(data)
  };
  if(haveNotes)files["xl/worksheets/sheet2.xml"]=mkSheet([["Champ","Règle"],...instructions]);
  return zip(files);
}


/* Sauvegarde globale : un onglet par table, sans exécuter de formules. */
export function makeMultiSheetXlsx(tabs){
  if(!Array.isArray(tabs)||!tabs.length||tabs.length>20)
    throw new Error("Nombre de feuilles Excel invalide.");
  const sheetNames=new Set();
  const entries={};
  const workbookSheets=[],workbookRels=[],overrides=[];
  tabs.forEach((tab,i)=>{
    const name=String(tab.name||"Feuille "+(i+1)).slice(0,31);
    if(sheetNames.has(name))throw new Error("Nom de feuille en double.");
    sheetNames.add(name);
    const head=tab.headers||[],rows=[head,...(tab.rows||[])];
    if(head.length<1||head.length>180||rows.length>20001)
      throw new Error("Feuille trop grande : "+name);
    const body=rows.map((row,ri)=>'<row r="'+(ri+1)+'">'+
      head.map((_,ci)=>{
        const value=row[ci]===null||row[ci]===undefined?"":String(row[ci]);
        return '<c r="'+columnRef(ci)+(ri+1)+'" t="inlineStr"><is><t xml:space="preserve">'+
          esc(value)+'</t></is></c>';
      }).join("")+'</row>').join("");
    const file="xl/worksheets/sheet"+(i+1)+".xml";
    const last=columnRef(head.length-1)+rows.length;
    entries[file]=XML+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
      '<dimension ref="A1:'+last+'"/><sheetData>'+body+'</sheetData><autoFilter ref="A1:'+last+'"/></worksheet>';
    workbookSheets.push('<sheet name="'+esc(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>');
    workbookRels.push('<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>');
    overrides.push('<Override PartName="/'+file+'" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
  });
  entries["xl/workbook.xml"]=XML+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+workbookSheets.join("")+'</sheets></workbook>';
  entries["xl/_rels/workbook.xml.rels"]=XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+workbookRels.join("")+'</Relationships>';
  entries["[Content_Types].xml"]=XML+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+overrides.join("")+'</Types>';
  entries["_rels/.rels"]=XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  return zip(entries);
}
