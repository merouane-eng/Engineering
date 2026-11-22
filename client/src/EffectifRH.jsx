import React, { useEffect, useMemo, useState } from "react";
import { Users, Plus, Save, X, Search, RotateCcw, Layers, MapPin, CheckCircle2, CalendarDays, TrendingUp, BarChart3, ArrowUpRight, CircleAlert, Filter, Activity } from "lucide-react";
import "./styles.css";
import {permissionAllowed} from "./accessPolicy.js";
import {SITES,localisationSite,localisationName,localisationLabel} from "./locationModel.js";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const trueValue = v => v === true || v === 1 || v === "1" || v === "true";
const clean = s => String(s || "").trim();
const unique = xs => [...new Set(xs.filter(Boolean).map(clean).filter(Boolean))].sort((a,b) => a.localeCompare(b, "fr"));
const employeeUnits = row => Array.isArray(row.units) ? row.units : [];
const siteForUnit = localisationSite;
const getSites = row => {
  const codes = employeeUnits(row);
  if (trueValue(row.toutes_unites)) return SITES;
  if (codes.length) return unique(codes.map(siteForUnit));
  return SITES.filter(site => clean(row.site).includes(site));
};
const siteLabel = row => getSites(row).join(" · ") || "À affecter";
const iso = d => String(d || "").slice(0,10);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + "T12:00:00").getTime());
const formatDate = d => d ? new Intl.DateTimeFormat(localStorage.getItem("engineering_language")==="en"?"en-GB":"fr-DZ", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(iso(d) + "T12:00:00")) : "—";
const toMonths = (records, year, key) => MONTHS.map((_,n) => records.filter(r => iso(r[key]).startsWith(String(year) + "-" + String(n+1).padStart(2,"0"))).length);

function MovementChart({ arrivals, departures }) {
  const max = Math.max(1,...arrivals,...departures);
  return <div className="ef-chart" role="img" aria-label="Histogramme mensuel des recrutements et des départs">
    {MONTHS.map((name,i) => <div className="ef-chartCol" key={name}>
      <div className="ef-chartBars">
        <span className="ef-chartBar arrivals" title={name + " : " + arrivals[i] + " recrutement(s)"} style={{height:Math.max(arrivals[i] ? 8 : 0, arrivals[i]/max*100) + "%"}} />
        <span className="ef-chartBar departures" title={name + " : " + departures[i] + " départ(s)"} style={{height:Math.max(departures[i] ? 8 : 0, departures[i]/max*100) + "%"}} />
      </div>
      <small>{name}</small>
    </div>)}
  </div>;
}

function EffectifRH({ user, api }) {
  const [rows,setRows]=useState([]);
  const [context,setContext]=useState({units:[],services:[],functions:[]});
  const [loading,setLoading]=useState(true), [error,setError]=useState("");
  const [form,setForm]=useState(null), [saving,setSaving]=useState(false);
  const [query,setQuery]=useState(""),[site,setSite]=useState(""),[service,setService]=useState("");
  const [fonction,setFonction]=useState(""),[unite,setUnite]=useState(""),[status,setStatus]=useState("all");
  const [showRh,setShowRh]=useState(false),[year,setYear]=useState(String(new Date().getFullYear()));
  const [rhTab,setRhTab]=useState("mouvements");
  const admin=user?.role==="admin";
  const canCreate=permissionAllowed(user,"effectif","create");
  const canEdit=permissionAllowed(user,"effectif","edit");
  const load=async()=>{setLoading(true);setError("");try{const [employees,refs]=await Promise.all([
    api("/api/modules/effectif"),api("/api/effectif/context")
  ]);setRows(employees);setContext(refs);}catch(e){setError(e.message);}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const siteMatches=r=>!site||getSites(r).includes(site);
  const serviceRows=rows.filter(siteMatches).filter(r=>!service||r.service===service);
  const serviceOptions=unique([...(context.services||[]),...rows.filter(siteMatches).map(r=>r.service)]);
  const functionOptions=unique(serviceRows.map(r=>r.fonction));
  const unitOptions=unique(serviceRows.flatMap(employeeUnits).concat(serviceRows.some(r=>trueValue(r.toutes_unites))?(context.units||[]):[]));
  const allUnitOptions=unique([...(context.units||[]),...rows.flatMap(employeeUnits),"SG01","SG02"]);
  const filtered=serviceRows.filter(r=>(!fonction||r.fonction===fonction)&&(!unite||trueValue(r.toutes_unites)||employeeUnits(r).includes(unite))&&
    (status==="all"||(status==="active"?trueValue(r.actif):!trueValue(r.actif)))&&
    (!query||[r.matricule,r.nom,r.prenom,r.initiale,r.service,r.fonction,r.type_contrat,...employeeUnits(r)].join(" ").toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr").trim())));
  const reportRows=serviceRows;
  const activeCount=reportRows.filter(r=>trueValue(r.actif)).length;
  const cddCount=reportRows.filter(r=>r.type_contrat==="CDD").length;
  const dueDate=new Date();dueDate.setDate(dueDate.getDate()+30);
  const today=new Date().toISOString().slice(0,10);
  const soon=reportRows.filter(r=>r.type_contrat==="CDD"&&isDate(iso(r.date_fin_contrat))&&iso(r.date_fin_contrat)>=today&&iso(r.date_fin_contrat)<=dueDate.toISOString().slice(0,10));
  const selectedYear=Number(year);
  const arrivals=toMonths(reportRows,selectedYear,"date_recrutement");
  const departures=toMonths(reportRows,selectedYear,"date_depart");
  const hires=arrivals.reduce((a,b)=>a+b,0), leaves=departures.reduce((a,b)=>a+b,0);
  const years=unique([String(new Date().getFullYear()),...rows.flatMap(r=>[iso(r.date_recrutement).slice(0,4),iso(r.date_depart).slice(0,4)])].filter(x=>/^\d{4}$/.test(x))).reverse();
  const movements=reportRows.flatMap(r=>[["date_recrutement","Entrée"],["date_depart","Sortie"]]
    .filter(([key])=>iso(r[key]).startsWith(year))
    .map(([key,label])=>({id:String(r.id)+"-"+key,nom:[r.prenom,r.nom].filter(Boolean).join(" "),date:iso(r[key]),label,service:r.service})))
    .sort((a,b)=>b.date.localeCompare(a.date));
  const contracts=[["CDI",reportRows.filter(r=>r.type_contrat==="CDI").length],["CDD",cddCount],["Apprentissage",reportRows.filter(r=>r.type_contrat==="APPRENTISSAGE").length],["Autre",reportRows.filter(r=>r.type_contrat==="AUTRE").length],["Non renseigné",reportRows.filter(r=>!r.type_contrat).length]];
  const reset=()=>{setQuery("");setSite("");setService("");setFonction("");setUnite("");setStatus("all");};
  const changeSite=v=>{setSite(v);setService("");setFonction("");setUnite("");};
  const changeService=v=>{setService(v);setFonction("");setUnite("");};
  const newForm=()=>{setError("");setForm({matricule:"",nom:"",prenom:"",initiale:"",service:"",fonction:"",telephone:"",email:"",
    site:"",type_contrat:"",date_debut_contrat:"",date_fin_contrat:"",date_recrutement:"",date_depart:"",commentaire_depart:"",
    actif:admin,is_admin:false,toutes_unites:false,units:[],service:admin?"":(user.service||"")});};
  const editForm=r=>{setError("");setForm({...r,initiale:r.initiale||"",type_contrat:r.type_contrat||"",
    date_fin_contrat:iso(r.date_fin_contrat),date_debut_contrat:iso(r.date_debut_contrat),commentaire_depart:r.commentaire_depart||"",date_recrutement:iso(r.date_recrutement),date_depart:iso(r.date_depart),
    actif:trueValue(r.actif),is_admin:trueValue(r.is_admin),toutes_unites:trueValue(r.toutes_unites),units:employeeUnits(r)});};
  const patch=(key,value)=>setForm(old=>({...old,[key]:value}));
  const toggleUnit=u=>setForm(old=>({...old,units:old.units.includes(u)?old.units.filter(v=>v!==u):[...old.units,u]}));
  const selectedSites=form ? (form.toutes_unites||form.is_admin ? SITES : form.units.length?unique(form.units.map(siteForUnit)):[]) : [];
  const explicitSite=selectedSites.length ? selectedSites.join("; ") : (form?.site||"");
  const save=async ev=>{
    ev.preventDefault();setError("");
    if(!form.matricule||!form.nom||!form.service||!form.fonction){setError("Matricule, nom, service et fonction sont obligatoires.");return;}
    if(form.type_contrat==="CDD"&&!form.date_fin_contrat){setError("La date de fin est obligatoire pour un CDD.");return;}
    if(form.type_contrat==="CDI"&&form.date_fin_contrat){setError("Un CDI ne possède pas de date de fin de contrat.");return;}
    if(form.date_debut_contrat&&form.date_fin_contrat&&form.date_fin_contrat<form.date_debut_contrat){setError("La fin du contrat précède son début.");return;}
    if(form.date_fin_contrat&&form.date_recrutement&&form.date_fin_contrat<form.date_recrutement){setError("La fin de contrat précède le recrutement.");return;}
    setSaving(true);
    try{
      const payload={...form,site:explicitSite,initiale:clean(form.initiale)||null,
        type_contrat:form.type_contrat||null,date_fin_contrat:form.date_fin_contrat||null,date_debut_contrat:form.date_debut_contrat||null,
        commentaire_depart:clean(form.commentaire_depart)||null};
      await api(form.id?"/api/effectif/"+form.id:"/api/effectif",{method:form.id?"PUT":"POST",body:JSON.stringify(payload)});
      setForm(null);await load();
    }catch(e){setError(e.message);}finally{setSaving(false);}
  };
  return <div className="effectifMaster ef-rh">
    <section className="ef-hero">
      <div><span className="ef-eyebrow">ENGINEERING · PEOPLE & OPERATIONS</span><h1>Effectif & ressources humaines</h1>
        <p>Équipes, affectations, contrats et mouvements du personnel en temps réel.</p></div>
      <div className="ef-heroIcon"><Users/></div>
    </section>
    <section className="ef-kpis">
      <article className="ef-kpi"><div className="ef-kpiTop"><span className="ef-kpiIcon blue"><Users/></span><span className="ef-kpiTag">COLLABORATEURS</span></div><strong>{reportRows.length}</strong><small>Dans le périmètre sélectionné</small></article>
      <article className="ef-kpi"><div className="ef-kpiTop"><span className="ef-kpiIcon green"><CheckCircle2/></span><span className="ef-kpiTag">ACTIFS</span></div><strong>{activeCount}</strong><small>{reportRows.length-activeCount} inactif(s)</small></article>
      <article className="ef-kpi"><div className="ef-kpiTop"><span className="ef-kpiIcon violet"><Layers/></span><span className="ef-kpiTag">CONTRATS CDD</span></div><strong>{cddCount}</strong><small>{reportRows.filter(r=>r.type_contrat==="CDI").length} CDI renseigné(s)</small></article>
      <article className="ef-kpi"><div className="ef-kpiTop"><span className="ef-kpiIcon orange"><CalendarDays/></span><span className="ef-kpiTag">ÉCHÉANCES</span></div><strong>{soon.length}</strong><small>CDD terminant sous 30 jours</small></article>
    </section>
    <section className="ef-rhToggle"><div><span className="ef-rhToggleIcon"><BarChart3/></span><div><strong>Tableau de bord RH</strong><small>Entrées, sorties, évolution et répartition des contrats</small></div></div>
      <button type="button" onClick={()=>setShowRh(v=>!v)} aria-expanded={showRh} className={showRh?"ef-rhToggleBtn selected":"ef-rhToggleBtn"}><TrendingUp/>{showRh?"Masquer les graphes":"Voir les graphes"}<ArrowUpRight/></button>
    </section>
    <section className="ef-toolbar">
      <div className="ef-search"><Search/><input placeholder="Nom, matricule, initiale, fonction..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className="ef-filter"><label><MapPin/> Site</label><select value={site} onChange={e=>changeSite(e.target.value)}><option value="">Tous les sites</option>{SITES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
      <div className="ef-filter"><label><Layers/> Service</label><select value={service} onChange={e=>changeService(e.target.value)}><option value="">Tous les services</option>{serviceOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
      <div className="ef-filter"><label><Users/> Fonction</label><select value={fonction} onChange={e=>setFonction(e.target.value)}><option value="">Toutes les fonctions</option>{functionOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
      <div className="ef-filter"><label><MapPin/> Localisation</label><select value={unite} onChange={e=>setUnite(e.target.value)}><option value="">Toutes les localisations</option>{unitOptions.map(v=><option key={v} value={v}>{localisationName(v,{withSite:true})}</option>)}</select></div>
      <div className="ef-filter"><label><Filter/> Statut</label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Tous les statuts</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select></div>
      <button className="ef-reset" onClick={reset}><RotateCcw/> Effacer</button>
      {canCreate&&<button className="primary ef-add" onClick={newForm}><Plus/> Ajouter</button>}
    </section>
    {showRh&&<section className="ef-rhDashboard">
      <div className="ef-rhDashboardHead"><div><span className="ef-eyebrow">ANALYSE RH</span><h2>Évolution des effectifs</h2><p>Les sorties sont calculées à partir des dates de départ, jamais de la fin d’un CDD.</p></div>
        <label>Année<select value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option value={y} key={y}>{y}</option>)}</select></label></div>
      <div className="ef-rhMetricRow">
        <div><span className="ef-rhDot green"/><small>Recrutements</small><strong>+{hires}</strong></div>
        <div><span className="ef-rhDot coral"/><small>Départs</small><strong>{leaves}</strong></div>
        <div><span className="ef-rhDot blue"/><small>Solde net</small><strong>{hires-leaves>0?"+":""}{hires-leaves}</strong></div>
      </div>
      <div className="ef-rhVizGrid">
        <article className="ef-rhPanel"><div className="ef-rhPanelHead"><div><h3>Entrées & sorties mensuelles</h3><small>Comparaison sur 12 mois · {year}</small></div><Activity/></div>
          <div className="ef-rhLegend"><span><i className="ef-rhDot green"/> Recrutements</span><span><i className="ef-rhDot coral"/> Départs</span></div>
          <MovementChart arrivals={arrivals} departures={departures}/></article>
        <article className="ef-rhPanel"><div className="ef-rhPanelHead"><div><h3>Répartition des contrats</h3><small>Personnel du périmètre sélectionné</small></div><Layers/></div>
          <div className="ef-rhContracts">{contracts.map(([label,n],i)=><div key={label} className="ef-rhContractItem">
            <div><span>{label}</span><strong>{n}</strong></div><div className="ef-rhTrack"><span className={"ef-rhTrackFill n"+i} style={{width:reportRows.length?n/reportRows.length*100+"%":"0%"}}/></div>
            <small>{reportRows.length?Math.round(n/reportRows.length*100):0}%</small></div>)}</div>
          {soon.length>0&&<div className="ef-rhNotice"><CircleAlert/> {soon.length} échéance(s) de CDD sous 30 jours</div>}</article>
      </div>
      <div className="ef-rhMovements"><div className="ef-rhPanelHead"><div><h3>Journal des mouvements</h3><small>Événements enregistrés pour {year}</small></div>
        <div className="ef-rhTabs"><button className={rhTab==="mouvements"?"active":""} onClick={()=>setRhTab("mouvements")}>Mouvements</button><button className={rhTab==="contrats"?"active":""} onClick={()=>setRhTab("contrats")}>Contrats CDD</button></div></div>
        {rhTab==="mouvements"?<div className="ef-rhEventList">{movements.length?movements.slice(0,50).map(m=><div key={m.id} className="ef-rhEvent">
          <span className={m.label==="Entrée"?"ef-rhEventTag in":"ef-rhEventTag out"}>{m.label}</span><strong>{m.nom}</strong><small>{m.service||"—"}</small><time>{formatDate(m.date)}</time></div>):<div className="ef-rhNoData">Aucune entrée ni sortie renseignée pour cette année.</div>}</div>
        :<div className="ef-rhEventList">{reportRows.filter(r=>r.type_contrat==="CDD").sort((a,b)=>iso(a.date_fin_contrat).localeCompare(iso(b.date_fin_contrat))).map(r=><div key={r.id} className="ef-rhEvent">
          <span className="ef-rhEventTag contract">CDD</span><strong>{[r.prenom,r.nom].filter(Boolean).join(" ")}</strong><small>{r.service||"—"}</small><time>{formatDate(r.date_fin_contrat)}</time></div>)}
          {!cddCount&&<div className="ef-rhNoData">Aucun contrat CDD renseigné.</div>}</div>}
      </div>
    </section>}
    <div className="ef-results"><span><strong>{filtered.length}</strong> collaborateur(s) affiché(s) · {rows.length} enregistré(s)</span><button type="button" onClick={load} disabled={loading}>{loading?"Chargement…":"Actualiser"}</button></div>
    {error&&!form&&<div className="formError" role="alert">{error}</div>}
    {!loading&&(filtered.length?<section className="ef-grid">{filtered.map(row=>{
      const units=employeeUnits(row), badge=clean(row.initiale)||([row.prenom,row.nom].map(s=>clean(s).slice(0,1)).join("")).toUpperCase()||"—";
      const expired=row.type_contrat==="CDD"&&iso(row.date_fin_contrat)&&iso(row.date_fin_contrat)<today;
      return <article className="ef-person" key={row.id||row.matricule}>
        <div className="ef-personHead"><span className="ef-avatar">{badge.slice(0,4)}</span><div className="ef-personName"><strong>{[row.prenom,row.nom].filter(Boolean).join(" ")||"Nom non renseigné"}</strong><small>Matricule : {row.matricule||"—"} · Initiale : {row.initiale||"—"}</small></div><span className={"ef-status "+(trueValue(row.actif)?"on":"off")}>{trueValue(row.actif)?"ACTIF":"INACTIF"}</span></div>
        <div className="ef-personRole"><Users/> {row.fonction||"Fonction non renseignée"}</div>
        <div className="ef-personMeta">
          <div className="ef-metaRow"><span>Service</span><strong>{row.service||"—"}</strong></div>
          <div className="ef-metaRow"><span>Site</span><strong>{siteLabel(row)}</strong></div>
          <div className="ef-metaRow"><span>Localisations</span><div className="ef-unitTags">{trueValue(row.toutes_unites)?<span>Toutes les localisations</span>:units.length?units.map(v=><span key={v}>{v}</span>):<span>Non affecté</span>}</div></div>
          <div className="ef-metaRow"><span>Type de contrat</span><strong className="ef-contractBadge">{row.type_contrat||"Non renseigné"}</strong></div>
          <div className="ef-metaRow"><span>Début de contrat</span><strong>{formatDate(row.date_debut_contrat)}</strong></div>
          <div className="ef-metaRow"><span>Fin de contrat</span><strong className={expired?"ef-expired":""}>{row.type_contrat!=="CDI"?formatDate(row.date_fin_contrat):"—"}{expired?" · Échu":""}</strong></div>
          {!trueValue(row.actif)&&row.commentaire_depart&&<div className="ef-metaRow"><span>Motif de sortie</span><strong>{row.commentaire_depart}</strong></div>}
          <div className="ef-metaRow"><span>Téléphone</span><strong>{row.telephone||"—"}</strong></div>
          <div className="ef-metaRow"><span>Email</span><strong>{row.email||"—"}</strong></div>
        </div>
        {canEdit&&<div className="ef-personFoot"><button onClick={()=>editForm(row)}><Save/> Modifier</button></div>}
      </article>;
    })}</section>:<div className="ef-empty"><Users/><strong>Aucun collaborateur ne correspond aux filtres.</strong><span>Modifie les critères ou efface les filtres.</span></div>)}
    {form&&<div className="modalBack" role="presentation"><form className="modal ef-rhModal" onSubmit={save}>
      <div className="modalHead"><div><span className="ef-eyebrow">FICHE PERSONNEL</span><h3>{form.id?"Modifier un collaborateur":"Ajouter un collaborateur"}</h3></div><button type="button" className="iconButton" onClick={()=>setForm(null)} aria-label="Fermer"><X/></button></div>
      {!admin&&<p className="hint">Pour les comptes non administrateurs, la modification des fiches existantes est limitée à l’initiale et aux coordonnées. Les créations sont inactives jusqu’à validation par un administrateur.</p>}
      <div className="formGrid">
        <label>Matricule *<input required disabled={!admin&&Boolean(form.id)} value={form.matricule||""} onChange={e=>patch("matricule",e.target.value)}/></label>
        <label>Nom *<input required disabled={!admin&&Boolean(form.id)} value={form.nom||""} onChange={e=>patch("nom",e.target.value)}/></label>
        <label>Prénom<input disabled={!admin&&Boolean(form.id)} value={form.prenom||""} onChange={e=>patch("prenom",e.target.value)}/></label>
        <label>Initiale <small>facultatif</small><input placeholder="Ex. MR" value={form.initiale||""} onChange={e=>patch("initiale",e.target.value)}/></label>
        <label>Service *<select required disabled={!admin&&Boolean(form.id)} value={form.service||""} onChange={e=>patch("service",e.target.value)}><option value="">Sélectionner</option>{unique([...context.services,form.service]).map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Fonction *<select required disabled={!admin&&Boolean(form.id)} value={form.fonction||""} onChange={e=>patch("fonction",e.target.value)}><option value="">Sélectionner</option>{unique([...context.functions,form.fonction]).map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Type de contrat<select disabled={!admin&&Boolean(form.id)} value={form.type_contrat||""} onChange={e=>setForm(old=>({...old,type_contrat:e.target.value,date_fin_contrat:e.target.value==="CDI"?"":old.date_fin_contrat}))}><option value="">Non renseigné</option><option>CDI</option><option>CDD</option><option value="APPRENTISSAGE">Apprentissage</option><option value="AUTRE">Autre</option></select></label>
        <label>Début de contrat<input type="date" disabled={!admin&&Boolean(form.id)} value={form.date_debut_contrat||""} onChange={e=>patch("date_debut_contrat",e.target.value)}/></label>
        <label>Fin de contrat {form.type_contrat==="CDD"?"*":""}<input type="date" required={form.type_contrat==="CDD"} disabled={form.type_contrat==="CDI"||(!admin&&Boolean(form.id))} value={form.date_fin_contrat||""} onChange={e=>patch("date_fin_contrat",e.target.value)}/></label>
        <label>Date de recrutement<input type="date" disabled={!admin&&Boolean(form.id)} value={form.date_recrutement||""} onChange={e=>patch("date_recrutement",e.target.value)}/></label>
        <label>Date de départ<input type="date" disabled={!admin&&Boolean(form.id)} value={form.date_depart||""} onChange={e=>patch("date_depart",e.target.value)}/></label>
        <label className="fullField">Motif de sortie / commentaire<textarea rows={3} disabled={!admin&&Boolean(form.id)} value={form.commentaire_depart||""} onChange={e=>patch("commentaire_depart",e.target.value)} placeholder="Démission, fin de contrat ou autre motif renseigné..."/></label>
        <label>Téléphone<input value={form.telephone||""} onChange={e=>patch("telephone",e.target.value)}/></label>
        <label>Email<input type="email" value={form.email||""} onChange={e=>patch("email",e.target.value)}/></label>
        <label>Site<select value={explicitSite} disabled={selectedSites.length>0||(!admin&&Boolean(form.id))} onChange={e=>patch("site",e.target.value)}><option value="">Non renseigné</option>{SITES.map(s=><option key={s} value={s}>{s}</option>)}<option value="Site 01; Site 02">Les deux sites</option></select><small>Automatique si des localisations sont affectées.</small></label>
      </div>
      <fieldset className="unitPicker" disabled={!admin&&Boolean(form.id)}><legend>Affectations aux localisations</legend><label><input type="checkbox" checked={Boolean(form.toutes_unites)} onChange={e=>patch("toutes_unites",e.target.checked)}/> Toutes les localisations</label>
        {!form.toutes_unites&&<div className="unitGrid">{allUnitOptions.map(u=><label key={u}><input type="checkbox" checked={form.units.includes(u)} onChange={()=>toggleUnit(u)}/>{localisationName(u,{withSite:true})}</label>)}</div>}
      </fieldset>
      <div className="formGrid"><label><input type="checkbox" disabled={!admin} checked={Boolean(form.actif)} onChange={e=>patch("actif",e.target.checked)}/> Actif</label><label><input type="checkbox" disabled={!admin} checked={Boolean(form.is_admin)} onChange={e=>patch("is_admin",e.target.checked)}/> Administrateur</label></div>
      {error&&<div className="formError" role="alert">{error}</div>}
      <div className="modalActions"><button type="button" onClick={()=>setForm(null)}>Annuler</button><button className="primary" type="submit" disabled={saving}><Save/>{saving?"Enregistrement…":"Enregistrer"}</button></div>
    </form></div>}
  </div>;
}

export default EffectifRH;
