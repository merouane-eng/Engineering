// Outils purs du calendrier : les PM restent attachées à leur date PRÉVUE.
// Le nom de l'intervenant provient exclusivement des réalisations effectivement enregistrées.
export const isoDay=value=>{
  const s=String(value||"").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):"";
};
export const validDay=value=>{
  const day=isoDay(value);
  if(!day)return "";
  const d=new Date(day+"T12:00:00");
  return !Number.isNaN(d.getTime())&&[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")===day?day:"";
};
export const monthKey=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0")].join("-");
export const monthFromKey=key=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(key)))return new Date(new Date().getFullYear(),new Date().getMonth(),1);
  return new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1);
};
export const moveMonth=(key,delta)=>{
  const d=monthFromKey(key);return monthKey(new Date(d.getFullYear(),d.getMonth()+delta,1));
};
export const gridDays=key=>{
  const d=monthFromKey(key);
  const first=new Date(d.getFullYear(),d.getMonth(),1);
  const shift=(first.getDay()+6)%7; // Lundi : premier jour
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  const count=Math.ceil((shift+last)/7)*7;
  return Array.from({length:count},(_,i)=>{
    const dt=new Date(d.getFullYear(),d.getMonth(),i-shift+1);
    const date=[dt.getFullYear(),String(dt.getMonth()+1).padStart(2,"0"),String(dt.getDate()).padStart(2,"0")].join("-");
    return {date,number:dt.getDate(),inMonth:dt.getMonth()===d.getMonth()};
  });
};
const normalize=v=>String(v||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export const isPMDone=row=>["realisee","realise","done","completed"].includes(normalize(row?.statut));
export const pmStatus=(row,today)=>{
  if(isPMDone(row))return "done";
  const state=normalize(row?.statut);
  if(["annulee","annule","cancelled","canceled"].includes(state))return "cancelled";
  if(["reportee","reporte","postponed"].includes(state))return "postponed";
  const day=validDay(row?.date_prevue);
  return day&&day<today?"late":"planned";
};
export const initials=value=>{
  const words=String(value||"").trim().split(/\s+/).filter(Boolean);
  return words.slice(0,2).map(w=>w[0]?.toLocaleUpperCase("fr")||"").join("")||"✓";
};
export const realizationIndex=items=>{
  const map=new Map();
  for(const r of items||[]){
    const id=String(r?.id_pm_prog??"");if(!id)continue;
    const last=map.get(id);
    const stamp=String(r.date_fin||r.date_debut||r.date_creation||"");
    if(!last||stamp>last.stamp)map.set(id,{name:String(r.technicien||"").trim(),date:validDay(r.date_fin)||validDay(r.date_debut)||validDay(r.date_creation),stamp});
  }
  return map;
};
export const mergeRealizations=(items,realizations)=>{
  const index=realizationIndex(realizations);
  return (items||[]).map(pm=>{
    const realized=index.get(String(pm.id));
    return {...pm,realisation_technicien:realized?.name||"",realisation_date:realized?.date||""};
  });
};
