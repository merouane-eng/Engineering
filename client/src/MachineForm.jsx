import React,{useMemo,useState} from "react";
import {Save,X,MapPin} from "lucide-react";
import {SITES,localisationSite,localisationLabel,localisationsForSite} from "./locationModel.js";

// Dedicated machine form. Location codes are kept stable for WO/PM/OT links.
export default function MachineForm({values={},locations=[],zones=[],onClose,onSave}){
 const [draft,setDraft]=useState(()=>({
   ...values,
   site:values.site||localisationSite(values.unite),
   unite:values.unite||"",
   actif:values.actif??1,
   numero_serie:values.numero_serie||"",
   date_mise_service:values.date_mise_service||"",
   commentaire:values.commentaire||""
 }));
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const allowed=useMemo(()=>localisationsForSite([...locations,draft.unite].filter(Boolean),draft.site),[locations,draft.unite,draft.site]);
 const update=(key,value)=>setDraft(current=>({...current,[key]:value}));
 const submit=async event=>{
   event.preventDefault();setError("");
   if(!draft.site||!draft.unite||localisationSite(draft.unite)!==draft.site){
     setError("Sélectionner une localisation correspondant au site.");return;
   }
   setBusy(true);
   try{
     await onSave({...draft,site:draft.site,unite:draft.unite});
   }catch(e){setError(e.message||"Enregistrement impossible.");}finally{setBusy(false);}
 };
 return <div className="modalBack">
  <form className="modal machineForm" onSubmit={submit}>
   <div className="modalHead"><h3>{values.id?"Modifier la machine":"Ajouter une machine"}</h3>
    <button type="button" className="iconButton" aria-label="Fermer" onClick={onClose}><X/></button></div>
   <p className="machineFormHint"><MapPin size={16}/> Sélectionnez le site puis la localisation. Microbiologie et QC sont disponibles dans les deux sites.</p>
   <div className="formGrid">
    <label>Tag *<input required value={draft.tag||""} onChange={e=>update("tag",e.target.value)}/></label>
    <label>Désignation *<input required value={draft.designation||""} onChange={e=>update("designation",e.target.value)}/></label>
    <label>Site *<select required value={draft.site} onChange={e=>setDraft(d=>({...d,site:e.target.value,unite:""}))}>
     {SITES.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    <label>Localisation *<select required value={draft.unite} onChange={e=>update("unite",e.target.value)}>
     <option value="">Sélectionner une localisation</option>
     {allowed.map(loc=><option value={loc} key={loc}>{localisationLabel(loc)}</option>)}</select></label>
    <label>Zone<input list="machine-zone-options" value={draft.zone||""} onChange={e=>update("zone",e.target.value)}/>
     <datalist id="machine-zone-options">{zones.map(z=><option value={z} key={z}/>)}</datalist></label>
    <label>Marque<input value={draft.marque||""} onChange={e=>update("marque",e.target.value)}/></label>
    <label>Modèle<input value={draft.modele||""} onChange={e=>update("modele",e.target.value)}/></label>
    <label>N° de série<input value={draft.numero_serie||""} onChange={e=>update("numero_serie",e.target.value)}/></label>
    <label>Date de mise en service<input type="date" value={String(draft.date_mise_service||"").slice(0,10)} onChange={e=>update("date_mise_service",e.target.value)}/></label>
    <label>Statut<select value={Number(draft.actif)?1:0} onChange={e=>update("actif",Number(e.target.value))}>
     <option value={1}>En service</option><option value={0}>Inactive</option></select></label>
    <label className="fullField">Commentaire<textarea value={draft.commentaire||""} onChange={e=>update("commentaire",e.target.value)}/></label>
   </div>
   {error&&<div className="formError" role="alert">{error}</div>}
   <div className="modalActions"><button type="button" onClick={onClose}>Annuler</button>
    <button type="submit" className="primary" disabled={busy}><Save/> {busy?"Enregistrement…":"Enregistrer"}</button></div>
  </form>
 </div>;
}
