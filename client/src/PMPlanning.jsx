import React,{useMemo,useState} from "react";
import {CalendarDays,ChevronLeft,ChevronRight,CheckCircle2,Clock3,AlertTriangle,MapPin,UserRound,Wrench,CalendarCheck,Layers,ArrowUpRight,Search,SlidersHorizontal,X,RotateCcw} from "lucide-react";
import {gridDays,monthKey,moveMonth,monthFromKey,validDay,pmStatus,initials,isPMDone} from "./pmCalendarModel.js";
import {localisationName} from "./locationModel.js";
import "./pmPlanning.css";

const DAYS=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const STATUSES={done:"Réalisée",planned:"Planifiée",late:"En retard",postponed:"Reportée",cancelled:"Annulée"};
const dateLabel=value=>validDay(value)?new Date(value.slice(0,10)+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}):"Date non renseignée";
const formatMonth=key=>monthFromKey(key).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
const todayLocal=()=>{
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
};

export default function PMPlanning({items=[],user,canRealize=false,onRealize,canPlan=false,onPlan,canAssign=false,onAssign}){
  const [month,setMonth]=useState(()=>monthKey(new Date()));
  const [selected,setSelected]=useState(null);
  const [search,setSearch]=useState("");
  const [unit,setUnit]=useState("");
  const [service,setService]=useState("");
  const [status,setStatus]=useState("all");
  const [showFilters,setShowFilters]=useState(false);
  const today=todayLocal();
  const units=useMemo(()=>[...new Set(items.map(p=>p.unite).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr")),[items]);
  const services=useMemo(()=>[...new Set(items.map(p=>p.service_intervenant).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr")),[items]);
  const scoped=useMemo(()=>items.filter(p=>{
    const matches=[p.machine_tag,p.machine_designation,p.unite,p.responsable,p.frequence,p.service_intervenant,p.realisation_technicien].join(" ").toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr"));
    return matches&&(!unit||p.unite===unit)&&(!service||p.service_intervenant===service)&&
      (status==="all"||pmStatus(p,today)===status);
  }),[items,search,unit,service,status,today]);
  const monthly=useMemo(()=>scoped.filter(p=>validDay(p.date_prevue)?.startsWith(month))
    .sort((a,b)=>String(a.date_prevue).localeCompare(String(b.date_prevue))||
      String(a.machine_tag||"").localeCompare(String(b.machine_tag||""),"fr")),[scoped,month]);
  const byDate=useMemo(()=>{
    const map=new Map();
    for(const pm of monthly){const day=validDay(pm.date_prevue);if(!map.has(day))map.set(day,[]);map.get(day).push(pm);}
    return map;
  },[monthly]);
  const days=useMemo(()=>gridDays(month),[month]);
  const completed=monthly.filter(isPMDone).length,late=monthly.filter(p=>pmStatus(p,today)==="late").length;
  const upcoming=monthly.length-completed-late;
  const clearFilters=()=>{setSearch("");setUnit("");setService("");setStatus("all");};
  const open=pm=>setSelected(pm);
  const selectedStatus=selected?pmStatus(selected,today):"planned";

  return <section className="pmcal" aria-label="Planning mensuel de maintenance préventive">
    <div className="pmcal-hero">
      <div className="pmcal-heroMain">
        <span className="pmcal-kicker"><CalendarCheck size={15}/> VUE OPÉRATIONNELLE · MAINTENANCE PLANIFIÉE</span>
        <h2>Planning préventif</h2>
        <p>Un mois, une vision complète. Chaque intervention apparaît automatiquement à sa date prévue.</p>
        <div className="pmcal-heroStats">
          <div><span>Interventions du mois</span><strong>{monthly.length}</strong></div>
          <div><span>Réalisées</span><strong>{completed}</strong></div>
          <div><span>En retard</span><strong>{late}</strong></div>
        </div>
      </div>
      <div className="pmcal-heroArt" aria-hidden="true">
        <div className="pmcal-heroArtRing"><CalendarDays size={57}/></div>
        <span className="pmcal-heroArtTag"><CheckCircle2 size={16}/> Pilotage en temps réel</span>
      </div>
    </div>

    <div className="pmcal-toolbar">
      <div className="pmcal-monthSwitch">
        <button type="button" title="Mois précédent" aria-label="Mois précédent" onClick={()=>setMonth(k=>moveMonth(k,-1))}><ChevronLeft size={19}/></button>
        <div className="pmcal-monthTitle"><span>CALENDRIER MENSUEL</span><strong>{formatMonth(month)}</strong></div>
        <button type="button" title="Mois suivant" aria-label="Mois suivant" onClick={()=>setMonth(k=>moveMonth(k,1))}><ChevronRight size={19}/></button>
        <button type="button" className="pmcal-today" onClick={()=>setMonth(monthKey(new Date()))}>Aujourd'hui</button>
      </div>
      <div className="pmcal-toolbarRight">
        <button type="button" className={"pmcal-filterButton "+(showFilters?"active":"")} onClick={()=>setShowFilters(v=>!v)} aria-expanded={showFilters}><SlidersHorizontal size={16}/> Filtres</button>
        {canPlan&&<button type="button" className="pmcal-new" onClick={()=>onPlan?.()}><CalendarDays size={17}/> Planifier une PM</button>}
      </div>
    </div>

    <div className="pmcal-legend" aria-label="Légende des statuts">
      <span><i className="pmcal-dot planned"/> Planifiée</span>
      <span><i className="pmcal-dot done"/> Réalisée</span>
      <span><i className="pmcal-dot late"/> En retard</span>
      <span><i className="pmcal-dot postponed"/> Reportée / annulée</span>
      <small>Le calendrier utilise la date prévue, même après réalisation.</small>
    </div>

    {showFilters&&<div className="pmcal-filters">
      <label className="pmcal-search"><Search size={16}/><input aria-label="Rechercher dans le planning" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Machine, responsable, fréquence..."/></label>
      <label>Localisation<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="">Toutes</option>{units.map(v=><option key={v} value={v}>{localisationName(v,{withSite:true})}</option>)}</select></label>
      <label>Service<select value={service} onChange={e=>setService(e.target.value)}><option value="">Tous</option>{services.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <label>Statut<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Tous</option>{Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <button type="button" onClick={clearFilters} title="Effacer les filtres"><RotateCcw size={15}/> Effacer</button>
    </div>}

    <div className="pmcal-monthOverview">
      <div><span className="pmcal-overviewIcon blue"><CalendarDays/></span><div><small>Programmées ce mois</small><strong>{monthly.length}</strong></div></div>
      <div><span className="pmcal-overviewIcon green"><CheckCircle2/></span><div><small>Terminées</small><strong>{completed}</strong></div></div>
      <div><span className="pmcal-overviewIcon orange"><Clock3/></span><div><small>À suivre</small><strong>{upcoming}</strong></div></div>
      <div><span className="pmcal-overviewIcon red"><AlertTriangle/></span><div><small>Retards</small><strong>{late}</strong></div></div>
    </div>

    <div className="pmcal-calendarScroll">
      <div className="pmcal-calendar">
        <div className="pmcal-weekHeaders">{DAYS.map(d=><div key={d}>{d}</div>)}</div>
        <div className="pmcal-grid">
          {days.map(day=>{
            const list=day.inMonth?byDate.get(day.date)||[]:[];
            return <div key={day.date} className={"pmcal-day "+(!day.inMonth?"outside ":"")+(day.date===today?"current ":"")+(list.length?"hasPM":"")}>
              <div className="pmcal-dayTop">
                <span className="pmcal-dayNumber">{day.number}</span>
                {list.length>0&&<small>{list.length} PM</small>}
              </div>
              <div className="pmcal-dayItems">
                {list.map(pm=>{
                  const state=pmStatus(pm,today),name=String(pm.realisation_technicien||"").trim();
                  return <button type="button" key={pm.id} className={"pmcal-event "+state}
                    title={pm.machine_tag+" — "+STATUSES[state]+(name?" — "+name:"")}
                    onClick={()=>open(pm)}>
                    <span className="pmcal-eventTop"><strong>{pm.machine_tag||pm.machine_designation||"Machine"}</strong>{state==="done"?<CheckCircle2 size={13}/>:state==="late"?<AlertTriangle size={12}/>:<Clock3 size={12}/>}</span>
                    <span className="pmcal-eventDesc">{pm.machine_designation||pm.frequence||"Préventif"}</span>
                    <span className="pmcal-eventFoot">{state==="done"?
                      <><span className="pmcal-avatar">{initials(name)}</span>{name||"Réalisée"}</>:
                      <>{pm.frequence||STATUSES[state]} · {pm.unite||"—"}</>}</span>
                  </button>;
                })}
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>
    {!monthly.length&&<div className="pmcal-empty"><CalendarDays size={28}/><strong>Aucune maintenance pour {formatMonth(month)}</strong><span>Utilise les flèches pour naviguer entre les mois ou ajuste les filtres.</span></div>}
    <div className="pmcal-footnote"><Layers size={15}/><span>{monthly.length} PM affichée(s) · {items.length} PM accessibles au total. Les droits de lecture et les localisations autorisées sont respectés.</span></div>

    {selected&&<div className="pmcal-dialogBack" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
      <section className="pmcal-dialog" role="dialog" aria-modal="true" aria-label={"Détail de la PM "+(selected.machine_tag||"")} >
        <header className="pmcal-dialogHead"><span>DÉTAIL DE L'INTERVENTION</span><button type="button" aria-label="Fermer" onClick={()=>setSelected(null)}><X size={18}/></button></header>
        <div className="pmcal-dialogTitle"><div className="pmcal-dialogMachine"><Wrench size={25}/></div><div><h3>{selected.machine_tag||"Machine"}</h3><p>{selected.machine_designation||"Maintenance préventive"}</p></div></div>
        <span className={"pmcal-status "+selectedStatus}>{selectedStatus==="done"?<CheckCircle2 size={15}/>:<Clock3 size={15}/>} {STATUSES[selectedStatus]}</span>
        <div className="pmcal-detailGrid">
          <div><small>Date prévue</small><strong>{dateLabel(selected.date_prevue)}</strong></div>
          <div><small>Fréquence</small><strong>{selected.frequence||"—"}</strong></div>
          <div><small>Localisation</small><strong>{localisationName(selected.unite,{withSite:true})||"—"}</strong></div>
          <div><small>Service intervenant</small><strong>{selected.service_intervenant||"Non attribué"}</strong></div>
          <div><small>Responsable prévu</small><strong>{selected.responsable||"—"}</strong></div>
          <div><small>Statut</small><strong>{selected.statut||"—"}</strong></div>
        </div>
        {selectedStatus==="done"&&<div className="pmcal-completed"><span className="pmcal-completedAvatar">{initials(selected.realisation_technicien)}</span><div><strong>Maintenance réalisée</strong><span>{selected.realisation_technicien||"Technicien non renseigné dans l'historique"}</span>{selected.realisation_date&&<small>Terminé le {dateLabel(selected.realisation_date)}</small>}</div><CheckCircle2 size={24}/></div>}
        {selected.consultation_seule&&<div className="pmcal-readOnly"><AlertTriangle size={16}/> Consultation seule : attribution du service nécessaire pour intervenir.</div>}
        <div className="pmcal-dialogActions"><button type="button" onClick={()=>setSelected(null)}>Fermer</button>
          {canRealize&&selectedStatus==="planned"&&!selected.consultation_seule&&
            <button className="pmcal-go" type="button" onClick={()=>{onRealize?.(selected);setSelected(null)}}><CheckCircle2 size={16}/> Marquer réalisée</button>}
          {canAssign&&selected.attribution_requise&&<button className="pmcal-go" type="button" onClick={()=>{onAssign?.(selected);setSelected(null)}}>Voir dans la liste <ArrowUpRight size={15}/></button>}
        </div>
      </section>
    </div>}
  </section>;
}
