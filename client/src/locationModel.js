// Modèle de présentation : les colonnes historiques "unite" restent inchangées
// pour préserver les liens Machines / Pannes / PM / Effectif / Operating Time.
// Les localisations communes à deux sites portent un code interne distinct.
export const SITES=["Site 01","Site 02"];
export const LOCALISATION_CODES=[
 {code:"MICROBIOLOGIE__S01",label:"Microbiologie",site:"Site 01"},
 {code:"MICROBIOLOGIE__S02",label:"Microbiologie",site:"Site 02"},
 {code:"QC__S01",label:"QC",site:"Site 01"},
 {code:"QC__S02",label:"QC",site:"Site 02"}
];
const aliases=new Map(LOCALISATION_CODES.map(x=>[x.code,x]));
export function localisationSite(code){
 const c=String(code||"").trim();
 const special=aliases.get(c);if(special)return special.site;
 if(/__S02$/i.test(c)||/^(U6|U06|SG02)$/i.test(c))return "Site 02";
 return "Site 01";
}
export function localisationLabel(code){
 const value=String(code||"").trim();
 const known=aliases.get(value);if(known)return known.label;
 return value.replace(/__S0[12]$/i,"").replaceAll("_"," ").trim();
}
export function localisationName(code,{withSite=false}={}){
 if(!code)return "—";
 const name=localisationLabel(code);
 return withSite?name+" · "+localisationSite(code):name;
}
export function localisationCode(label,site){
 const clean=String(label||"").trim();
 if(!clean||!SITES.includes(site))throw new Error("Localisation et site obligatoires.");
 const existing=LOCALISATION_CODES.find(v=>v.site===site&&v.label.toLowerCase()===clean.toLowerCase());
 if(existing)return existing.code;
 if(/^(U[0-9]+(?:-[0-9]+)?|SG0[12])$/i.test(clean))return clean.toUpperCase();
 const slug=clean.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()
  .replace(/[^A-Z0-9]+/g,"_").replace(/^_+|_+$/g,"");
 if(!slug||slug.length>90)throw new Error("Nom de localisation invalide.");
 return slug+"__"+(site==="Site 02"?"S02":"S01");
}
export function localisationsForSite(codes,site){
 return [...new Set((codes||[]).filter(c=>!site||localisationSite(c)===site))].sort((a,b)=>
  localisationLabel(a).localeCompare(localisationLabel(b),"fr"));
}
