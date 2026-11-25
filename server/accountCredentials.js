// Comptes créés depuis le formulaire RH ou l'import Excel.
export function usernameBase(nom,prenom){
 const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .toLowerCase().replace(/[^a-z0-9]+/g,"").trim();
 const parts=[normalize(nom),normalize(prenom)].filter(Boolean);
 return parts.join(".");
}
export async function availableUsername(nom,prenom,matricule,supabaseRequest,used=new Set()){
 const base=usernameBase(nom,prenom)||("user"+String(matricule||"").replace(/[^a-zA-Z0-9]/g,""));
 for(let n=0;n<10000;n++){
  const candidate=n===0?base:base+"."+n;
  if(used.has(candidate.toLowerCase()))continue;
  const existing=await supabaseRequest("effectif",{
   query:"?select=id&username=ilike."+encodeURIComponent(candidate)+"&limit=1"
  });
  if(!existing.length){used.add(candidate.toLowerCase());return candidate;}
 }
 throw new Error("Impossible de générer un identifiant unique.");
}
