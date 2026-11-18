import React,{useEffect,useMemo,useRef,useState} from "react";
import {SlidersHorizontal,Plus,Pencil,Trash2,RefreshCcw,Save,X,Search,ShieldCheck,Database,Download,Upload,AlertTriangle,CheckCircle2,Layers,ChevronRight} from "lucide-react";
import "./desktopSettings.css";

const TABS=[
 ["service","Services"],["fonction","Fonctions"],["zone","Zones"],
 ["unite","Unités"],["groupe","Groupes"],["frequence_pm","Fréquences PM"],
 ["statut_pm","Statuts PM"],["statut_panne","Statuts panne"],
 ["area_SG01","Areas SG — Site 01"],["equipement_SG01","Équipements SG — Site 01"],
 ["area_SG02","Areas SG — Site 02"],["equipement_SG02","Équipements SG — Site 02"]
];
const header=()=>({Authorization:"Bearer "+localStorage.getItem("engineering_token")});
async function request(url,options={}){
 const res=await fetch(url,{...options,headers:{"Content-Type":"application/json",...header(),...(options.headers||{})}});
 const data=await res.json().catch(()=>({error:"Réponse serveur invalide."}));
 if(!res.ok)throw new Error(data.error||"Opération impossible.");
 return data;
}
const readFile=file=>new Promise((resolve,reject)=>{
 const reader=new FileReader();
 reader.onerror=()=>reject(new Error("Impossible de lire le fichier."));
 reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");
 reader.readAsDataURL(file);
});
function saveFile(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export default function DesktopSettings(){
 const [rows,setRows]=useState([]),[tab,setTab]=useState("service"),[query,setQuery]=useState("");
 const [form,setForm]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [preview,setPreview]=useState(null),[restoreResult,setRestoreResult]=useState(null);
 const fileRef=useRef(null);
 const label=TABS.find(x=>x[0]===tab)?.[1]||tab;
 const load=async()=>{
  setBusy(true);setError("");
  try{const result=await request("/api/settings/references");setRows(Array.isArray(result)?result:[]);}
  catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 useEffect(()=>{load();},[]);
 const current=useMemo(()=>rows.filter(r=>r.type_liste===tab&&[r.valeur,r.parent].join(" ").toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))),[rows,tab,query]);
 const parentOpts=rows.filter(r=>r.type_liste==="groupe").map(r=>r.valeur);
 const openForm=row=>{
  setError("");setNotice("");
  setForm(row?{id:row.id,type_liste:row.type_liste,valeur:row.valeur,parent:row.parent||""}:
   {type_liste:tab,valeur:"",parent:""});
 };
 const submit=async e=>{
  e.preventDefault();if(!form?.valeur?.trim())return;
  setBusy(true);setError("");
  try{
   await request(form.id?"/api/settings/references/"+form.id:"/api/settings/references",{
    method:form.id?"PUT":"POST",body:JSON.stringify(form)
   });
   setForm(null);setNotice(form.id?"Référence modifiée.":"Référence ajoutée.");
   await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const remove=async row=>{
  if(row.usage>0){setError("Cette référence est utilisée "+row.usage+" fois : suppression interdite.");return;}
  if(!window.confirm('Supprimer « '+row.valeur+' » ? Cette action ne supprimera aucune donnée métier.'))return;
  setBusy(true);setError("");
  try{
   await request("/api/settings/references/"+row.id,{method:"DELETE"});
   setNotice("Référence supprimée.");await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const backup=async()=>{
  setBusy(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/settings/backup",{headers:header()});
   if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error||"Sauvegarde impossible.");}
   saveFile(await res.blob(),"Engineering_Parametres_Sauvegarde.xlsx");
   setNotice("Sauvegarde Excel des références téléchargée.");
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const pick=async e=>{
  const file=e.target.files?.[0];e.target.value="";
  if(!file)return;
  setError("");setNotice("");setPreview(null);setRestoreResult(null);
  if(!/\.xlsx$/i.test(file.name)||file.size>3*1024*1024){setError("Sélectionner un fichier .xlsx de 3 Mo maximum.");return;}
  setBusy(true);
  try{
   const encoded=await readFile(file);
   const result=await request("/api/settings/restore/preview",{method:"POST",body:JSON.stringify({file:encoded})});
   setPreview({...result,encoded,name:file.name});
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const confirm=async()=>{
  if(!preview||preview.errors?.length)return;
  setBusy(true);setError("");
  try{
   const result=await request("/api/settings/restore/fusion",{
    method:"POST",body:JSON.stringify({file:preview.encoded,hash:preview.hash})});
   setRestoreResult(result);setPreview(null);
   setNotice("Fusion terminée : "+result.imported+" référence(s) ajoutée(s), "+result.duplicates+" doublon(s) ignoré(s).");
   await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="desktopSettings" aria-label="Référentiels de l'application">
  <header className="ds-hero">
   <div className="ds-icon"><SlidersHorizontal size={23}/></div>
   <div><span className="ds-eyebrow">CONFIGURATION CENTRALISÉE · ADMINISTRATEURS</span>
    <h2>Paramètres de l'application</h2>
    <p>Listes de référence communes à Engineering PC et Engineering Mobile.</p></div>
   <span className="ds-guard"><ShieldCheck size={15}/> Accès admin</span>
  </header>
  <div className="ds-kpis">
   <div><span>Références</span><strong>{rows.length}</strong><small>Valeurs disponibles</small></div>
   <div><span>Référentiels</span><strong>{TABS.length}</strong><small>Maintenance & organisation</small></div>
   <div><span>{label}</span><strong>{rows.filter(r=>r.type_liste===tab).length}</strong><small>Dans cet onglet</small></div>
  </div>
  <div className="ds-section">
   <div className="ds-heading"><div><h3>Listes de référence</h3><p>Ajouter, renommer et supprimer les valeurs non utilisées.</p></div>
    <button type="button" className="ds-outline" onClick={load} disabled={busy}><RefreshCcw size={15}/> Rafraîchir</button></div>
   <div className="ds-tabs" role="tablist" aria-label="Types de références">
    {TABS.map(([key,name])=><button type="button" role="tab" aria-selected={tab===key}
      className={tab===key?"active":""} key={key} onClick={()=>{setTab(key);setQuery("");setForm(null);setError("");}}>
      {name}<span>{rows.filter(r=>r.type_liste===key).length}</span></button>)}
   </div>
   <div className="ds-actionbar">
    <div className="ds-search"><Search size={16}/><input aria-label="Rechercher une référence" placeholder={"Rechercher dans "+label+"…"} value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <button type="button" className="ds-primary" onClick={()=>openForm()}><Plus size={16}/> Ajouter</button>
   </div>
   <div className="ds-tableWrap"><table>
    <thead><tr><th>Valeur</th><th>Parent (groupe)</th><th>Utilisation</th><th>Actions</th></tr></thead>
    <tbody>{current.length?current.map(r=><tr key={r.id}>
     <td><strong>{r.valeur}</strong></td>
     <td>{tab==="unite"?(r.parent||"—"):"—"}</td>
     <td><span className={r.usage?"ds-usage used":"ds-usage"}>{r.usage||0} usage{r.usage===1?"":"s"}</span></td>
     <td><div className="ds-rowactions">
      <button type="button" aria-label={"Modifier "+r.valeur} title="Modifier" onClick={()=>openForm(r)}><Pencil size={15}/></button>
      <button type="button" aria-label={"Supprimer "+r.valeur} title={r.usage?"Référence déjà utilisée : suppression impossible":"Supprimer"}
       disabled={r.usage>0} onClick={()=>remove(r)}><Trash2 size={15}/></button>
     </div></td>
    </tr>):<tr><td colSpan={4} className="ds-empty">Aucune référence à afficher.</td></tr>}</tbody>
   </table></div>
  </div>
  <div className="ds-section ds-backup">
   <div className="ds-heading"><div><h3><Database size={20}/> Sauvegarde / Restauration</h3>
    <p>Archive des listes de référence. La restauration est une fusion qui ignore les doublons.</p></div></div>
   <div className="ds-backupActions">
    <button type="button" onClick={backup} disabled={busy}><Download size={18}/><span><strong>Exporter les paramètres</strong><small>Sauvegarde complète des références en Excel</small></span></button>
    <button type="button" onClick={()=>fileRef.current?.click()} disabled={busy}><Upload size={18}/><span><strong>Importer (fusion)</strong><small>Aperçu et confirmation avant ajout</small></span></button>
    <input ref={fileRef} hidden type="file" accept=".xlsx" onChange={pick}/>
   </div>
   <div className="ds-safety"><AlertTriangle size={17}/><p>Pour protéger Supabase, le remplacement total destructeur et la restauration d'une base SQLite ne sont pas proposés ici. Les exports des données métier (Machines, Effectif, Pannes, PM et Operating Time) sont disponibles dans la barre Excel admin.</p></div>
   {preview&&<div className="ds-preview">
    <div className="ds-heading"><div><strong>{preview.name}</strong><p>Aucune donnée modifiée avant confirmation.</p></div><button onClick={()=>setPreview(null)} aria-label="Fermer"><X size={17}/></button></div>
    <div className="ds-previewStats"><span>{preview.total} ligne(s)</span><span>{preview.creations} nouvelle(s)</span><span>{preview.duplicates} doublon(s)</span></div>
    {preview.errors?.length?<div className="ds-alert">Corriger {preview.errors.length} erreur(s) dans le fichier.
      <ul>{preview.errors.slice(0,10).map((x,i)=><li key={i}>Ligne {x.line} : {x.message}</li>)}</ul></div>:
     <button type="button" className="ds-primary" onClick={confirm} disabled={busy||!preview.creations}><CheckCircle2 size={16}/> Confirmer la fusion</button>}
   </div>}
   {restoreResult?.errors?.length>0&&<div className="ds-alert">Import partiel : {restoreResult.errors.map(x=>"Ligne "+x.line+" : "+x.message).join(" ; ")}</div>}
  </div>
  {error&&<div className="ds-alert" role="alert"><AlertTriangle size={17}/>{error}</div>}
  {notice&&<div className="ds-success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
  {busy&&<p className="ds-loading">Chargement / vérification en cours…</p>}
  {form&&<div className="ds-modalBack" role="presentation"><form className="ds-modal" onSubmit={submit}>
    <header><div><span className="ds-eyebrow">{form.id?"MODIFICATION":"NOUVELLE RÉFÉRENCE"}</span>
      <h3>{label}</h3></div><button type="button" onClick={()=>setForm(null)} aria-label="Fermer"><X size={18}/></button></header>
    <label>Valeur <span>*</span><input required maxLength={120} autoFocus value={form.valeur} onChange={e=>setForm(old=>({...old,valeur:e.target.value}))} placeholder="Nom de la référence"/></label>
    {form.type_liste==="unite"&&<label>Parent (groupe)<select value={form.parent||""} onChange={e=>setForm(old=>({...old,parent:e.target.value}))}>
      <option value="">Aucun groupe</option>{parentOpts.map(g=><option key={g} value={g}>{g}</option>)}</select></label>}
    <p>Les références utilisées ne peuvent pas être renommées vers un autre libellé ni supprimées sans réaffecter les données métier.</p>
    <div className="ds-modalActions"><button type="button" onClick={()=>setForm(null)}>Annuler</button>
      <button type="submit" className="ds-primary" disabled={busy}><Save size={16}/> Enregistrer</button></div>
   </form></div>}
 </section>;
}
