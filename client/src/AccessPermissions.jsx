import React,{useEffect,useMemo,useState} from "react";
import {ShieldCheck,Save,RotateCcw,Search,Users,BriefcaseBusiness,UserRound,LockKeyhole,AlertTriangle,CheckCircle2} from "lucide-react";
import {resolvePermissions,defaultPermission} from "./accessPolicy.js";
import "./accessPermissions.css";

const TARGETS=[["role","Rôles",Users],["fonction","Postes / fonctions",BriefcaseBusiness],["personne","Personnes",UserRound]];
const ACTIONS={view:"Voir",create:"Ajouter",edit:"Modifier"};
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");

export default function AccessPermissions({api}){
  const [data,setData]=useState(null),[scope,setScope]=useState("role"),[subject,setSubject]=useState("technicien");
  const [draft,setDraft]=useState({}),[filter,setFilter]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const load=async()=>{
    setLoading(true);setError("");
    try{
      const result=await api("/api/settings/access");
      setData(result);
    }catch(e){setError(e.message);}finally{setLoading(false);}
  };
  useEffect(()=>{load();},[]);
  const people=(data?.people||[]).filter(p=>p.actif&&p.role!=="admin");
  const subjects=scope==="role"?(data?.roles||[]):scope==="fonction"?(data?.functions||[])
    .map(label=>({label,subject:norm(label)}))
    .filter(({subject},i,arr)=>subject&&arr.findIndex(x=>x.subject===subject)===i):
    people.map(p=>({subject:p.id,label:[p.prenom,p.nom].filter(Boolean).join(" ")+" · "+(p.fonction||"Poste non indiqué")+" · "+(p.matricule||"")}));
  const options=scope==="role"?subjects.map(x=>({subject:x,label:x==="superviseur"?"Superviseur": "Technicien"})):subjects;
  const visibleOptions=options.filter(x=>x.label.toLocaleLowerCase("fr").includes(filter.toLocaleLowerCase("fr")));
  useEffect(()=>{
    const chosen=options.some(x=>x.subject===subject)?subject:(options[0]?.subject||"");
    if(chosen!==subject)setSubject(chosen);
  },[scope,subject,data]);
  const record=(data?.rules||[]).find(r=>r.scope===scope&&String(r.subject)===subject);
  useEffect(()=>{setDraft(record?.rules?JSON.parse(JSON.stringify(record.rules)):{});setError("");setNotice("");},[scope,subject,data]);
  const person=people.find(p=>p.id===subject);
  const functionPerson=people.find(p=>norm(p.fonction)===subject);
  const example=scope==="role"?{role:subject,fonction:subject==="superviseur"?"Superviseur":"Technicien"}:
    scope==="fonction"?{role:functionPerson?.role||"technicien",fonction:functionPerson?.fonction}:
      {role:person?.role||"technicien",fonction:person?.fonction,id:person?.id,supabase_id:person?.id};
  const effective=useMemo(()=>resolvePermissions(example,[
    ...(data?.rules||[]).filter(r=>!(r.scope===scope&&r.subject===subject)),
    {scope,subject,rules:draft}
  ]),[data,scope,subject,draft]);
  const update=(module,action,value)=>{
    setNotice("");
    setDraft(prev=>{
      const next={...prev},row={...(next[module]||{})};
      if(value==="inherit")delete row[action]; else row[action]=value==="yes";
      if(Object.keys(row).length)next[module]=row;else delete next[module];
      return next;
    });
  };
  const save=async(reset=false)=>{
    if(!subject)return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/api/settings/access",{method:"PUT",body:JSON.stringify({
        scope,subject,rules:reset?{}:draft
      })});
      const latest=await api("/api/settings/access");
      setData(latest);
      setNotice(reset?"Droits personnalisés effacés : retour à l'héritage.":"Droits enregistrés. Ils s'appliqueront aux prochaines requêtes des utilisateurs.");
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <section className="accessPermissions" aria-label="Gestion des droits par rôle et personne">
    <header className="ap-head">
      <div className="ap-heading"><span className="ap-icon"><ShieldCheck/></span>
        <div><h2>Autorisations des modules</h2><p>Définir les accès par rôle, par poste ou individuellement. Les restrictions de site et de département restent actives.</p></div></div>
      <span className="ap-secure"><LockKeyhole size={15}/> Administrateur uniquement</span>
    </header>
    <div className="ap-tabs" role="tablist" aria-label="Périmètre des autorisations">
      {TARGETS.map(([value,label,Icon])=><button key={value} type="button" role="tab" aria-selected={scope===value}
        className={scope===value?"active":""} onClick={()=>{setScope(value);setFilter("");}}>
        <Icon size={17}/>{label}</button>)}
    </div>
    <div className="ap-selector">
      <div><label htmlFor="ap-target">{scope==="role"?"Choisir un rôle":scope==="fonction"?"Choisir un poste / fonction":"Choisir un collaborateur"}</label>
        <p>{scope==="role"?"Règles de base pour les utilisateurs de ce rôle.":scope==="fonction"?"Ces règles prennent le dessus sur celles du rôle.":"Ces règles prennent le dessus sur celles du rôle et du poste."}</p>
      </div>
      <div className="ap-controls">
        {scope!=="role"&&<label className="ap-search"><Search size={16}/><input aria-label="Filtrer les choix" placeholder="Rechercher..." value={filter} onChange={e=>setFilter(e.target.value)}/></label>}
        <select id="ap-target" value={subject} onChange={e=>setSubject(e.target.value)} disabled={!options.length||loading}>
          {!options.length&&<option value="">Aucun choix disponible</option>}
          {visibleOptions.some(x=>x.subject===subject)?null:options.filter(x=>x.subject===subject).map(x=><option key={x.subject} value={x.subject}>{x.label}</option>)}
          {visibleOptions.map(x=><option key={x.subject} value={x.subject}>{x.label}</option>)}
        </select>
      </div>
    </div>
    <div className="ap-note"><ShieldCheck size={17}/><span><strong>Hériter</strong> conserve la règle du niveau précédent. <strong>Autoriser</strong> accorde le droit dans le périmètre déjà autorisé. <strong>Bloquer</strong> le retire. Masquer un module bloque également l'ajout et la modification.</span></div>
    {loading?<p className="ap-status">Chargement des autorisations…</p>:data&&subject?
      <div className="ap-scroll"><table className="ap-matrix">
        <thead><tr><th>Module</th>{Object.values(ACTIONS).map(label=><th key={label}>{label}</th>)}</tr></thead>
        <tbody>{data.modules.map(([id,label,actions])=><tr key={id}>
          <th>{label}{id==="parametres"&&<small>Réservé à l'administrateur</small>}</th>
          {Object.entries(ACTIONS).map(([action,heading])=>{
            const supported=actions.includes(action),locked=id==="parametres";
            const raw=draft[id]?.[action];
            const val=raw===undefined?"inherit":raw?"yes":"no";
            const enabled=effective[id]?.[action]===true;
            return <td key={action}>{supported&&!locked?<div className="ap-cell">
              <select aria-label={label+" — "+heading} className={val==="yes"?"ap-yes":val==="no"?"ap-no":""}
                value={val} onChange={e=>update(id,action,e.target.value)} disabled={busy}>
                <option value="inherit">Hériter</option><option value="yes">Autoriser</option><option value="no">Bloquer</option>
              </select><span className={"ap-effective "+(enabled?"allowed":"denied")}>{enabled?"Actif":"Inactif"}</span></div>
              :<span className="ap-locked">{locked?<LockKeyhole size={14}/>: "—"}</span>}</td>;
          })}
        </tr>)}</tbody>
      </table></div>:null}
    {error&&<div className="ap-alert" role="alert"><AlertTriangle size={17}/>{error}</div>}
    {notice&&<div className="ap-success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
    <footer className="ap-footer"><p>Les changements n'effacent aucune donnée existante. Les droits de suppression et la gestion des comptes restent réservés aux administrateurs.</p>
      <div><button type="button" className="ap-reset" disabled={busy||!subject} onClick={()=>save(true)}><RotateCcw size={16}/> Réinitialiser</button>
        <button type="button" className="ap-save" disabled={busy||!subject||!data} onClick={()=>save(false)}><Save size={16}/>{busy?"Enregistrement…":"Enregistrer les droits"}</button></div>
    </footer>
  </section>;
}
