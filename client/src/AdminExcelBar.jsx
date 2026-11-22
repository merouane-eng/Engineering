import React,{useEffect,useRef,useState} from "react";
import {FileSpreadsheet,Upload,Download,FileDown,ShieldCheck,X,CheckCircle2,AlertTriangle} from "lucide-react";

const DATASETS=[
  {id:"machines",label:"Machines"},
  {id:"effectif",label:"Effectif"},
  {id:"pannes",label:"Pannes / Work Orders"},
  {id:"pm",label:"Maintenance préventive"},
  {id:"operating",label:"Operating Time"}
];
const IMPORT_BATCH_SIZE=50;
const FOR_MODULE={
  machines:"machines",effectif:"effectif",saisie:"pannes",liste:"pannes",
  pm:"pm",operating:"operating"
};
const responseError=async response=>{
  let data;try{data=await response.json();}catch{data={};}
  throw new Error(data.error||"Erreur lors de l'opération Excel.");
};
const fileBase64=file=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("Lecture du fichier impossible."));
  reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");
  reader.readAsDataURL(file);
});
const triggerSave=(blob,filename)=>{
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
};
export default function AdminExcelBar({module,onSuccess}){
  const [dataset,setDataset]=useState(FOR_MODULE[module]||"machines");
  const [busy,setBusy]=useState(""),[error,setError]=useState(""),[preview,setPreview]=useState(null),[report,setReport]=useState(null);
  const [importProgress,setImportProgress]=useState(0);
  const picker=useRef(null);
  useEffect(()=>{
    setDataset(FOR_MODULE[module]||"machines");
    setPreview(null);setError("");setReport(null);
  },[module]);
  const token=()=>localStorage.getItem("engineering_token");
  const download=async action=>{
    setBusy(action);setError("");setReport(null);
    try{
      const response=await fetch("/api/excel/"+dataset+"/"+action,{headers:{Authorization:"Bearer "+token()}});
      if(!response.ok)await responseError(response);
      const blob=await response.blob();
      const suffix=action==="template"?"template":"export";
      triggerSave(blob,"Engineering_"+dataset+"_"+suffix+"_"+new Date().toISOString().slice(0,10)+".xlsx");
      setReport({message:action==="template"?"Template Excel téléchargé.":"Export Excel téléchargé.",ok:true});
    }catch(e){setError(e.message);}finally{setBusy("");}
  };
  const send=async(action,file,hash,options={},preparedEncoded=null)=>{
    const encoded=preparedEncoded??await fileBase64(file);
    const response=await fetch("/api/excel/"+dataset+"/"+action,{
      method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token()},
      body:JSON.stringify({file:encoded,...(hash?{hash}:{}),...options})
    });
    const data=await response.json().catch(()=>({error:"Réponse serveur illisible."}));
    if(!response.ok)throw new Error(data.error+(data.errors?.length?" · "+data.errors.slice(0,3).map(x=>"Ligne "+x.line+" : "+x.message).join(" / "):""));
    return data;
  };
  const selectFile=async event=>{
    const file=event.target.files?.[0];event.target.value="";
    if(!file)return;
    setError("");setPreview(null);setReport(null);setImportProgress(0);
    if(!file.name.toLowerCase().endsWith(".xlsx")){setError("Sélectionner un classeur Excel .xlsx.");return;}
    if(file.size>3*1024*1024){setError("Le fichier dépasse 3 Mo. Découper les données en plusieurs fichiers.");return;}
    setBusy("preview");
    try{
      const data=await send("preview",file);
      setPreview({...data,file});
    }catch(e){setError(e.message);}finally{setBusy("");}
  };
  const confirmImport=async()=>{
    if(!preview||preview.errors?.length)return;
    setBusy("import");setError("");setImportProgress(0);
    let imported=0,updated=0,processed=0;
    const errors=[];
    try{
      // Réutiliser le fichier encodé ; chaque requête ne traite que 50 lignes.
      const encoded=await fileBase64(preview.file);
      for(let start=0;start<preview.total;start+=IMPORT_BATCH_SIZE){
        const size=Math.min(IMPORT_BATCH_SIZE,preview.total-start);
        const data=await send("import",preview.file,preview.hash,{batchStart:start,batchSize:size},encoded);
        imported+=data.imported||0;
        updated+=data.updated||0;
        errors.push(...(data.errors||[]));
        processed=start+size;
        setImportProgress(processed);
      }
      setReport({message:errors.length?"Import partiel : vérifier les erreurs de lignes.":"Import terminé.",
        imported,updated,duplicates:preview.duplicates,errors,ok:errors.length===0});
      setPreview(null);
      if(imported||updated)onSuccess?.();
    }catch(e){
      setError((processed?"Import interrompu après "+processed+" lignes. Les données déjà importées sont conservées ; relancer l'import ignorera les doublons. ":"")+e.message);
      if(imported||updated){
        setReport({message:"Import partiel : certaines lignes ont été enregistrées.",
          imported,updated,duplicates:preview.duplicates,errors,ok:false});
        onSuccess?.();
      }
    }finally{setBusy("");}
  };
  return <section className="adminExcel" aria-label="Gestion Excel administrateur">
    <div className="adminExcelTop">
      <span className="adminExcelBadge"><ShieldCheck size={15}/> ADMIN</span>
      <div className="adminExcelTitle"><FileSpreadsheet size={19}/><div><strong>Gestion Excel</strong><small>Import, export et modèle compatibles avec Engineering PC</small></div></div>
      <div className="adminExcelSelector"><label htmlFor="excelDataset">Module</label><select id="excelDataset" value={dataset} disabled={Boolean(busy)}
        onChange={e=>{setDataset(e.target.value);setPreview(null);setReport(null);setError("");}}>
        {DATASETS.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}
      </select></div>
    </div>
    <div className="adminExcelActions">
      <button type="button" disabled={Boolean(busy)} className="adminExcelButton" onClick={()=>download("template")}><FileDown size={16}/> Template</button>
      <button type="button" disabled={Boolean(busy)} className="adminExcelButton" onClick={()=>download("export")}><Download size={16}/> Exporter</button>
      <button type="button" disabled={Boolean(busy)} className="adminExcelButton accent" onClick={()=>picker.current?.click()}><Upload size={16}/> Importer</button>
      <input ref={picker} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={selectFile}/>
      {busy&&<span className="adminExcelLoading">{busy==="preview"?"Analyse du fichier…":busy==="import"?"Import en cours… "+importProgress+" / "+(preview?.total||0)+" lignes":"Préparation Excel…"}</span>}
    </div>
    {preview&&<div className="adminExcelPreview">
      <div className="adminExcelPreviewHead">
        <div><strong>Prévisualisation : {preview.file.name}</strong><small>Aucune donnée modifiée à ce stade.</small></div>
        <button type="button" aria-label="Fermer l'aperçu" onClick={()=>setPreview(null)}><X size={17}/></button>
      </div>
      <div className="adminExcelNumbers">
        <span><strong>{preview.total}</strong> ligne(s)</span>
        <span><strong>{preview.creations}</strong> nouvelle(s)</span>
        <span><strong>{preview.updates}</strong> mise(s) à jour RH</span>
        <span><strong>{preview.duplicates}</strong> doublon(s) ignoré(s)</span>
      </div>
      {preview.errors?.length>0?<div className="adminExcelErrors"><AlertTriangle size={16}/> {preview.errors.length} erreur(s). Corrige le fichier :
        <ul>{preview.errors.slice(0,12).map((e,i)=><li key={i}>Ligne {e.line} : {e.message}</li>)}</ul></div>:
        <div className="adminExcelConfirm"><span><CheckCircle2 size={17}/> Fichier vérifié. L'import n'effacera aucune ligne existante.</span>
          <button type="button" disabled={Boolean(busy)||preview.creations+preview.updates===0}
            onClick={confirmImport}>Confirmer l'import</button></div>}
    </div>}
    {error&&<div className="adminExcelErrors" role="alert"><AlertTriangle size={16}/> {error}</div>}
    {report&&<div className={report.ok?"adminExcelReport":"adminExcelErrors"} role="status">
      {report.ok?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}
      {report.message}
      {report.imported!==undefined&&<span>Ajoutées : {report.imported} · RH actualisés : {report.updated} · Doublons : {report.duplicates}</span>}
      {report.errors?.length>0&&<ul>{report.errors.slice(0,12).map((e,i)=><li key={i}>Ligne {e.line} : {e.message}</li>)}</ul>}
    </div>}
  </section>;
}
