import React,{useEffect,useMemo,useState} from "react";
import {
 Activity,BarChart3,CalendarClock,CalendarDays,CheckCircle2,ChevronDown,Clock3,
 Download,Filter,Gauge,Layers,LineChart as LineIcon,Monitor, Moon,Sun,Palette,
 RefreshCw,TrendingUp,Wrench,Users,AlertCircle,ClipboardList,SlidersHorizontal,
 ArrowUpRight,ShieldCheck,ChartNoAxesCombined,Target,Timer,RotateCcw,
 Check,Info, Settings2, Sparkles, PieChart, Waves
} from "lucide-react";
import "./statsMaster.css";

const empty={pannes:[],pm:[],operating:[],machines:[],units:[],scope:{}};
const fr=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1});
const number=v=>fr.format(Number(v)||0);
const n=v=>{const x=Number(v);return Number.isFinite(x)?Math.max(0,x):0};
const iso=v=>String(v||"").slice(0,10);
const dateOK=d=>/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d+"T12:00:00Z"));
const dateFR=d=>dateOK(iso(d))?new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(iso(d)+"T12:00:00Z")):"—";
const norm=t=>String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const isClosed=p=>["close","closed","cloture","cloturee","termine","terminee"].includes(norm(p.statut));
const isPMDone=p=>["realisee","realise","non conforme"].includes(norm(p.statut));
const isPMCancelled=p=>["annulee","annule"].includes(norm(p.statut));
const unitSite=u=>/^(U6|U06|SG02)$/i.test(String(u||""))?"Site 02":"Site 01";
const unique=xs=>[...new Set(xs.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"fr"));
function safeLocal(key,def){try{return localStorage.getItem(key)||def;}catch{return def;}}
function persist(key,value){try{localStorage.setItem(key,value);}catch{}}
function csvValue(v){const s=String(v??"");return /^[=+\-@\t\r]/.test(s)?"'"+s:s;}
function downloadCSV(name,headers,rows){
 const esc=v=>'"'+csvValue(v).replaceAll('"','""')+'"';
 const content="\uFEFF"+[headers,...rows].map(row=>row.map(esc).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function linePath(values,width=600,height=172){
 const max=Math.max(1,...values);
 return values.map((v,i)=>{
  const x=40+(i/Math.max(values.length-1,1))*(width-72);
  const y=height-22-(v/max)*(height-45);
  return [x,y];
 });
}
const monthsFor=(latest,months=12)=>Array.from({length:months},(_,i)=>{
 const date=new Date(latest.getFullYear(),latest.getMonth()-(months-1-i),1);
 return {key:date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0"),
   label:new Intl.DateTimeFormat("fr",{month:"short"}).format(date),year:date.getFullYear()};
});
function Panel({eyebrow,title,subtitle,icon:Icon,children,extra,className=""}){
 return <article className={"sm-panel "+className}>
  <div className="sm-panelHead"><div><span className="sm-eyebrow">{eyebrow}</span><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>
   <div className="sm-panelTopRight">{extra}{Icon&&<span className="sm-panelIcon"><Icon size={19}/></span>}</div></div>
  {children}
 </article>;
}
function KPI({label,value,description,icon:Icon,tone="cyan",badge}){
 return <article className={"sm-kpi sm-kpi-"+tone}>
  <div className="sm-kpiTop"><span className="sm-kpiIcon"><Icon size={21}/></span>{badge&&<span className="sm-kpiBadge">{badge}</span>}</div>
  <div className="sm-kpiNumber">{value}</div><h3>{label}</h3><p>{description}</p>
 </article>;
}
function TrendGraph({series,labels,mode="line",height=218}){
 const [hover,setHover]=useState(null);
 const width=640,plotH=185,all=series.flatMap(s=>s.values),max=Math.max(1,...all);
 const points=series.map(s=>({...s,points:linePath(s.values,width,plotH)}));
 const poly=pts=>pts.map(p=>p.join(",")).join(" ");
 const active=hover===null?null:labels[hover];
 return <div className="sm-graph">
  <div className="sm-chartLegend">{series.map(s=><span key={s.name}><i style={{background:s.color}}/>{s.name}</span>)}</div>
  <div className="sm-chartViewport">
   <svg viewBox="0 0 640 218" role="img" aria-label={"Graphique "+series.map(s=>s.name).join(" et ")+" sur "+labels.length+" périodes"} preserveAspectRatio="none">
    {[0,1,2,3,4].map(step=><g key={step}><line x1="40" x2="615" y1={163-step*33} y2={163-step*33} stroke="var(--sm-grid)" strokeDasharray="4 6"/>
      <text x="32" y={166-step*33} textAnchor="end" fontSize="10" fill="var(--sm-subtle)">{Math.round(max*step/4)}</text></g>)}
    {points.map((s,k)=>mode==="bars"?<g key={s.name}>{s.values.map((v,i)=>{
      const size=Math.min(21,Math.max(4,450/labels.length/series.length));
      const total=labels.length,base=40+((i+.5)/total)*575,offset=(k-(series.length-1)/2)*(size+3);
      return <rect key={i} x={base-size/2+offset} width={size} y={163-v/max*132} height={Math.max(v?3:0,v/max*132)} rx="4" fill={s.color} opacity={hover===i?1:.88}/>;
    })}</g>:<g key={s.name}>
      <polygon points={poly([[s.points[0]?.[0]||40,163],...s.points,[s.points.at(-1)?.[0]||615,163]])} fill={s.color} fillOpacity=".085"/>
      <polyline points={poly(s.points)} fill="none" stroke={s.color} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
      {s.points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={hover===i?5:2.5} fill={s.color} stroke="var(--sm-card)" strokeWidth="2"/>)}
     </g>)}
    {labels.map((label,i)=><g key={i}><rect x={40+i*575/labels.length} y="14" width={575/labels.length} height="161" fill="transparent"
      onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(i)} tabIndex="0" aria-label={label+": "+series.map(s=>s.name+" "+s.values[i]).join(", ")}>
      <title>{label+" · "+series.map(s=>s.name+": "+s.values[i]).join(" / ")}</title></rect>
      {hover===i&&<line x1={40+(i+.5)*575/labels.length} x2={40+(i+.5)*575/labels.length} y1="17" y2="164" stroke="var(--sm-muted)" strokeDasharray="3 5"/>}
      <text x={40+(i+.5)*575/labels.length} y="198" fontSize="10" textAnchor="middle" fill="var(--sm-subtle)">{label}</text>
    </g>)}
   </svg>
  </div>
  <div className="sm-chartHint">{active?active+" — "+series.map(s=>s.name+" : "+s.values[hover]).join(" · "):"Survolez ou touchez une période pour consulter les valeurs"}</div>
 </div>;
}
function Donut({parts,total,centerLabel}){
 const sum=parts.reduce((a,p)=>a+p.count,0);
 let offset=0;const r=68,circ=2*Math.PI*r;
 return <div className="sm-donutBody"><svg viewBox="0 0 220 220" role="img" aria-label={parts.map(p=>p.label+" : "+p.count).join(", ")}>
  <circle cx="110" cy="110" r={r} fill="none" stroke="var(--sm-track)" strokeWidth="23"/>
  {parts.map(p=>{const length=sum?p.count/sum*circ:0;const start=offset;offset+=length;
   return <circle key={p.label} cx="110" cy="110" r={r} fill="none" stroke={p.color} strokeWidth="23"
    strokeDasharray={length+" "+Math.max(0,circ-length)} strokeDashoffset={-start} transform="rotate(-90 110 110)"/>;
  })}
  <text x="110" y="105" fill="var(--sm-text)" fontSize="28" fontWeight="800" textAnchor="middle">{total}</text>
  <text x="110" y="127" fill="var(--sm-muted)" fontSize="11" textAnchor="middle">{centerLabel}</text>
 </svg><div className="sm-donutLegend">{parts.map(p=><div key={p.label}><i style={{background:p.color}}/><span>{p.label}</span><strong>{p.count}</strong></div>)}</div></div>;
}
function Ranking({items,suffix="",empty="Aucune donnée sur la sélection.",tone="cyan"}){
 const max=Math.max(1,...items.map(x=>x.value));
 return items.length?<div className="sm-ranking">{items.map((it,i)=><div className="sm-rankRow" key={it.name}>
  <span className="sm-rankIndex">{String(i+1).padStart(2,"0")}</span>
  <div className="sm-rankContent"><div className="sm-rankLabels"><strong title={it.name}>{it.name}</strong><span>{number(it.value)} {suffix}</span></div>
   <div className="sm-rankTrack"><i className={"sm-rankFill "+tone} style={{width:it.value/max*100+"%"}}/></div></div>
 </div>)}</div>:<div className="sm-noData"><Info size={19}/>{empty}</div>;
}
function GaugeRing({value,label,unit="%",tone="green"}){
 const percent=value===null?0:Math.max(0,Math.min(100,value));
 return <div className={"sm-ring sm-ring-"+tone} style={{"--pct":percent+"%"}}><div><strong>{value===null?"—":number(value)+unit}</strong><small>{label}</small></div></div>;
}
function statsReducer(data,site,unit,machine,period,month,now){
 const assets=data.machines.filter(r=>(!site||unitSite(r.unite)===site)&&(!unit||r.unite===unit)&&(!machine||r.tag===machine));
 const tags=new Set(assets.map(r=>r.tag));
 // Inclure les interventions de services généraux sans machine de production,
 // mais appliquer toujours le périmètre d'unités fourni par le serveur.
 const units=new Set(data.units.filter(u=>(!site||unitSite(u)===site)&&(!unit||u===unit)));
 const low=new Date(now);low.setHours(0,0,0,0);
 if(period==="30")low.setDate(low.getDate()-29);
 if(period==="90")low.setDate(low.getDate()-89);
 if(period==="365")low.setDate(low.getDate()-364);
 const inTime=d=>{const t=iso(d);if(!dateOK(t))return false;return (period==="all"||new Date(t+"T12:00:00Z")>=low) &&
   (!month||t.startsWith(month));};
 const ps=data.pannes.filter(p=>units.has(p.unite)&&(!machine||p.machine===machine)&&inTime(p.date_panne));
 const pm=data.pm.filter(p=>units.has(p.unite)&&(!machine||p.machine_tag===machine)&&inTime(p.date_prevue));
 const ops=data.operating.filter(o=>tags.has(o.machine)&&inTime(o.date_jour));
 const open=ps.filter(p=>!isClosed(p)),closed=ps.filter(isClosed);
 const done=pm.filter(isPMDone),cancelled=pm.filter(isPMCancelled);
 const nowDate=iso(now.toISOString());
 const overdue=data.pm.filter(p=>units.has(p.unite)&&(!machine||p.machine_tag===machine)&&!isPMDone(p)&&!isPMCancelled(p)&&iso(p.date_prevue)<nowDate&&dateOK(iso(p.date_prevue)));
 const downtime=ps.reduce((a,p)=>a+n(p.downtime),0),closedDT=closed.reduce((a,p)=>a+n(p.downtime),0);
 const run=ops.reduce((a,o)=>a+n(o.heures_marche),0),planned=ops.reduce((a,o)=>a+n(o.heures_planifiees),0),stop=ops.reduce((a,o)=>a+n(o.heures_arret),0);
 const availability=planned>0?Math.min(100,run/planned*100):null;
 const mtbf=ps.length&&ops.length?run/ps.length:null;
 const mttr=closed.length?closedDT/closed.length:null;
 const machineStats=assets.map(a=>{
  const p=ps.filter(x=>x.machine===a.tag),o=ops.filter(x=>x.machine===a.tag),
   runM=o.reduce((v,x)=>v+n(x.heures_marche),0),planM=o.reduce((v,x)=>v+n(x.heures_planifiees),0),
   closedM=p.filter(isClosed);
  return {tag:a.tag,designation:a.designation,unite:a.unite,pannes:p.length,
   downtime:p.reduce((v,x)=>v+n(x.downtime),0),
   dispon:planM>0?Math.min(100,runM/planM*100):null,
   mtbf:p.length&&o.length?runM/p.length:null,
   mttr:closedM.length?closedM.reduce((v,x)=>v+n(x.downtime),0)/closedM.length:null};
 }).filter(x=>x.pannes||x.dispon!==null);
 const pareto=[...machineStats].sort((a,b)=>b.pannes-a.pannes).slice(0,7).map(x=>({name:x.tag,value:x.pannes}));
 const stopPareto=[...machineStats].sort((a,b)=>b.downtime-a.downtime).filter(x=>x.downtime>0).slice(0,7).map(x=>({name:x.tag,value:+(x.downtime/60).toFixed(1)}));
 const techMap=new Map();
 for(const p of ps){const name=String(p.technicien||"").trim();if(!name)continue;const prev=techMap.get(name)||{name,count:0,closed:0,minutes:0};
   prev.count++;if(isClosed(p)){prev.closed++;prev.minutes+=n(p.downtime);}techMap.set(name,prev);}
 const technicians=[...techMap.values()].sort((a,b)=>b.count-a.count).slice(0,8);
 const byUnit=unique([...ps.map(p=>p.unite),...pm.map(p=>p.unite)]).map(u=>({name:u,value:ps.filter(p=>p.unite===u).length,pm:pm.filter(p=>p.unite===u).length}));
 const endMonth=new Date(now.getFullYear(),now.getMonth(),1);
 const buckets=monthsFor(endMonth,12);
 const series={
  pannes:buckets.map(m=>ps.filter(p=>iso(p.date_panne).startsWith(m.key)).length),
  pm:buckets.map(m=>pm.filter(p=>iso(p.date_prevue).startsWith(m.key)).length),
  done:buckets.map(m=>done.filter(p=>iso(p.date_prevue).startsWith(m.key)).length),
  downtime:buckets.map(m=>Math.round(ps.filter(p=>iso(p.date_panne).startsWith(m.key)).reduce((a,p)=>a+n(p.downtime),0)/60)),
  availability:buckets.map(m=>{
   const o=ops.filter(x=>iso(x.date_jour).startsWith(m.key)),planned=o.reduce((a,x)=>a+n(x.heures_planifiees),0);
   return planned?Math.round(o.reduce((a,x)=>a+n(x.heures_marche),0)/planned*100):0;
  })
 };
 return {assets,ps,pm,ops,open,closed,done,cancelled,overdue,downtime,run,planned,stop,availability,mtbf,mttr,
   closureRate:ps.length?closed.length/ps.length*100:null,
   pmRate:pm.length?done.length/pm.length*100:null,machineStats,pareto,stopPareto,technicians,byUnit,buckets,series};
}
function ThemeControls({theme,onThemeChange,palette,setPalette,compact,setCompact}){
 const [open,setOpen]=useState(false);
 return <div className="sm-themeSettings"><button type="button" className="sm-themeToggle" aria-expanded={open} onClick={()=>setOpen(!open)}>
  <Palette size={17}/> Personnaliser <ChevronDown size={14}/></button>
  {open&&<div className="sm-themePopover" role="group" aria-label="Personnalisation du tableau de bord">
   <strong>APPARENCE DU DASHBOARD</strong><small>Mode d'affichage</small>
   <div className="sm-themeOptions"><button className={theme==="dark"?"active":""} aria-pressed={theme==="dark"} onClick={()=>onThemeChange("dark")}><Moon size={17}/> Sombre</button>
   <button className={theme==="light"?"active":""} aria-pressed={theme==="light"} onClick={()=>onThemeChange("light")}><Sun size={17}/> Clair</button></div>
   <small>Palette de couleurs</small><div className="sm-paletteOptions">
   {[["ocean","Océan","#36c5e9"],["emerald","Émeraude","#47d3a4"],["royal","Royal","#9c8cf5"]].map(([key,label,color])=>
     <button key={key} type="button" aria-label={label} title={label} aria-pressed={palette===key} className={palette===key?"selected":""} onClick={()=>setPalette(key)}>
      <span style={{background:color}}/>{palette===key&&<Check size={13}/>}</button>)}</div>
   <small>Disposition</small><div className="sm-themeOptions"><button className={!compact?"active":""} onClick={()=>setCompact(false)}>Confort</button><button className={compact?"active":""} onClick={()=>setCompact(true)}>Compact</button></div>
   <p>Ces préférences sont enregistrées sur cet appareil.</p>
  </div>}
 </div>;
}
export default function StatsMaster({theme="dark",onThemeChange=()=>{}}){
 const [data,setData]=useState(empty),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [period,setPeriod]=useState("365"),[site,setSite]=useState(""),[unit,setUnit]=useState(""),[machine,setMachine]=useState(""),[month,setMonth]=useState("");
 const [tab,setTab]=useState("overview"),[graphMode,setGraphMode]=useState("line");
 const [palette,setPalette]=useState(()=>safeLocal("engineering_stats_palette","ocean"));
 const [compact,setCompact]=useState(()=>safeLocal("engineering_stats_compact","false")==="true");
 const today=useMemo(()=>new Date(),[]);
 const load=async()=>{
  setLoading(true);setError("");
  try{
   const token=localStorage.getItem("engineering_token");
   const response=await fetch("/api/stats/overview",{headers:{Authorization:"Bearer "+token}});
   if(!response.ok){const json=await response.json().catch(()=>({}));throw new Error(json.error||"Statistiques indisponibles");}
   const json=await response.json();
   setData({pannes:json.pannes||[],pm:json.pm||[],operating:json.operating||[],machines:json.machines||[],units:json.units||[],scope:json.scope||{}});
  }catch(e){setError(String(e.message||"Chargement impossible"))}finally{setLoading(false)}
 };
 useEffect(()=>{load()},[]);
 useEffect(()=>persist("engineering_stats_palette",palette),[palette]);
 useEffect(()=>persist("engineering_stats_compact",String(compact)),[compact]);
 const siteOptions=["Site 01","Site 02"];
 const units=useMemo(()=>unique(data.units.filter(u=>!site||unitSite(u)===site)),[data.units,site]);
 const machines=useMemo(()=>data.machines.filter(m=>(!site||unitSite(m.unite)===site)&&(!unit||m.unite===unit)).sort((a,b)=>String(a.tag).localeCompare(String(b.tag),"fr")),[data.machines,site,unit]);
 const stats=useMemo(()=>statsReducer(data,site,unit,machine,period,month,today),[data,site,unit,machine,period,month,today]);
 const reset=()=>{setPeriod("365");setSite("");setUnit("");setMachine("");setMonth("")};
 const mOptions=useMemo(()=>unique([...data.pannes.map(p=>iso(p.date_panne).slice(0,7)),...data.pm.map(p=>iso(p.date_prevue).slice(0,7))].filter(x=>/^\d{4}-\d{2}$/.test(x))).reverse(),[data]);
 const exportReport=()=>{
  const rows=stats.machineStats.sort((a,b)=>b.pannes-a.pannes).map(x=>[x.tag,x.designation||"",x.unite,x.pannes,number(x.downtime/60),x.mtbf===null?"":number(x.mtbf),x.mttr===null?"":number(x.mttr),x.dispon===null?"":number(x.dispon)]);
  downloadCSV("Engineering_Statistiques_"+iso(new Date().toISOString())+".csv",["Machine","Désignation","Unité","Pannes","Arrêt (h)","MTBF estimé (h)","MTTR (min)","Disponibilité (%)"],rows);
 };
 const annual=stats.buckets.map(x=>x.label);
 const primary=getComputedStyleSafe(palette).primary,secondary=getComputedStyleSafe(palette).secondary;
 const views=[["overview","Vue générale",BarChart3],["reliability","Fiabilité & MTBF",Gauge],["pm","Maintenance préventive",CalendarClock],["team","Performance techniciens",Users]];
 const hasData=stats.ps.length||stats.pm.length||stats.ops.length;
 const periodText=period==="all"?"Toutes périodes":period==="365"?"12 derniers mois":period+" derniers jours";
 const scopeText=[site||"Tous les sites",unit||"Toutes les unités",machine||"Toutes les machines"].join(" / ");
 const scheduled=stats.pm.length-stats.done.length-stats.cancelled.length;
 return <div className={"statsMaster "+(compact?"sm-compact":"")} data-stats-palette={palette}>
  <section className="sm-hero">
   <div className="sm-heroMain"><div className="sm-kicker"><span className="sm-liveDot"/> ENGINEERING ANALYTICS <span className="sm-separator"/> COMMAND CENTER</div>
     <h1>Intelligence <em>maintenance</em></h1>
     <p>Pilotez la fiabilité, la disponibilité et la performance de votre parc industriel depuis un seul espace.</p>
     <div className="sm-heroPills"><span><Activity size={14}/> Données réelles</span><span><CalendarDays size={14}/> {dateFR(today.toISOString())}</span>
       <span><ShieldCheck size={14}/> {data.scope.electricite?"Périmètre Électricité":"Périmètre autorisé"}</span></div></div>
   <div className="sm-heroVisual" aria-hidden="true"><div className="sm-orbit sm-orbit1"/><div className="sm-orbit sm-orbit2"/><ChartNoAxesCombined size={84}/><div className="sm-visualTag">ANALYSE • PERFORMANCE</div></div>
  </section>
  <div className="sm-commandBar">
   <div className="sm-commandTitle"><span className="sm-commandIcon"><SlidersHorizontal size={19}/></span><div><strong>Configuration du rapport</strong><small>Filtres synchronisés pour tous les indicateurs</small></div></div>
   <ThemeControls theme={theme} onThemeChange={onThemeChange} palette={palette} setPalette={setPalette} compact={compact} setCompact={setCompact}/>
  </div>
  <div className="sm-filterCard">
   <div className="sm-periodGroup"><label><CalendarDays size={13}/> PÉRIODE</label><div className="sm-segments">
    {[["30","30 jours"],["90","90 jours"],["365","12 mois"],["all","Tout"]].map(([key,label])=>
     <button type="button" key={key} className={period===key?"selected":""} aria-pressed={period===key} onClick={()=>setPeriod(key)}>{label}</button>)}</div></div>
   <label className="sm-field"><span>Site</span><select value={site} onChange={e=>{setSite(e.target.value);setUnit("");setMachine("")}}>
    <option value="">Tous les sites</option>{siteOptions.filter(x=>data.units.some(u=>unitSite(u)===x)).map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="sm-field"><span>Unité</span><select value={unit} onChange={e=>{setUnit(e.target.value);setMachine("")}}><option value="">Toutes les unités</option>{units.map(u=><option key={u}>{u}</option>)}</select></label>
   <label className="sm-field"><span>Machine</span><select value={machine} onChange={e=>setMachine(e.target.value)}><option value="">Toutes les machines</option>{machines.map(m=><option value={m.tag} key={m.tag}>{m.tag} · {m.designation||""}</option>)}</select></label>
   <label className="sm-field sm-month"><span>Mois précis</span><select value={month} onChange={e=>setMonth(e.target.value)}><option value="">Tous les mois</option>{mOptions.map(x=><option value={x} key={x}>{x}</option>)}</select></label>
   <div className="sm-filterActions"><button className="sm-clear" title="Réinitialiser les filtres" onClick={reset}><RotateCcw size={15}/> Effacer</button>
    <button className="sm-refresh" onClick={load} disabled={loading}><RefreshCw size={15} className={loading?"sm-spinning":""}/> {loading?"Chargement":"Actualiser"}</button></div>
  </div>
  {error&&<div className="sm-alert" role="alert"><AlertCircle size={19}/><span>{error}</span><button onClick={load}>Réessayer</button></div>}
  <div className="sm-statusLine"><span className="sm-scopeBadge"><Filter size={13}/>{scopeText}</span>
    <span>{periodText}{month?" · "+month:""}</span><span className="sm-statusSpacer"/><button type="button" className="sm-export" onClick={exportReport} disabled={!stats.machineStats.length}><Download size={14}/> Export rapport CSV</button></div>
  <div className="sm-viewTabs" role="tablist" aria-label="Vues statistiques">{views.map(([key,label,Icon])=>
   <button type="button" role="tab" aria-selected={tab===key} key={key} onClick={()=>setTab(key)} className={tab===key?"active":""}><Icon size={17}/>{label}</button>)}</div>
  {tab==="overview"&&<>
   <div className="sm-sectionTitle"><div><span className="sm-eyebrow">EXECUTIVE SUMMARY</span><h2>Vue d’ensemble</h2></div><span className="sm-sectionCount">{stats.assets.length} équipements dans le périmètre</span></div>
   <div className="sm-kpiGrid">
    <KPI label="Total des pannes" value={loading?"—":number(stats.ps.length)} description="Ordres de travail sur la période" icon={ClipboardList} tone="cyan" badge="WO"/>
    <KPI label="Pannes ouvertes" value={loading?"—":number(stats.open.length)} description="Interventions en cours" icon={AlertCircle} tone="orange"/>
    <KPI label="Disponibilité" value={loading?"—":stats.availability===null?"—":number(stats.availability)+"%"} description="Heures de marche / planifiées" icon={Gauge} tone="green"/>
    <KPI label="Arrêt cumulé" value={loading?"—":number(stats.downtime/60)+" h"} description="Durée déclarée dans les pannes" icon={Clock3} tone="red"/>
    <KPI label="MTBF estimé" value={loading?"—":stats.mtbf===null?"—":number(stats.mtbf)+" h"} description="Heures de marche / nombre de pannes" icon={Target} tone="violet"/>
    <KPI label="MTTR moyen" value={loading?"—":stats.mttr===null?"—":number(stats.mttr)+" min"} description="Arrêt des WO clôturés / clôtures" icon={Timer} tone="blue"/>
    <KPI label="PM réalisées" value={loading?"—":number(stats.done.length)} description={stats.pmRate===null?"Aucune PM":"Taux : "+number(stats.pmRate)+"%"} icon={CheckCircle2} tone="green"/>
    <KPI label="PM en retard" value={loading?"—":number(stats.overdue.length)} description="Échéances échues non réalisées" icon={CalendarClock} tone="orange"/>
   </div>
   <div className="sm-visualGrid">
    <Panel title="Tendance des interventions" eyebrow="ÉVOLUTION SUR 12 MOIS" subtitle="Ordres de travail et préventif programmé" icon={LineIcon} className="sm-wide"
      extra={<div className="sm-miniToggle"><button onClick={()=>setGraphMode("line")} className={graphMode==="line"?"selected":""} aria-label="Courbes"><LineIcon size={15}/></button><button onClick={()=>setGraphMode("bars")} className={graphMode==="bars"?"selected":""} aria-label="Barres"><BarChart3 size={15}/></button></div>}>
      <TrendGraph mode={graphMode} labels={annual} series={[{name:"Pannes",values:stats.series.pannes,color:primary},{name:"PM",values:stats.series.pm,color:secondary}]}/></Panel>
    <Panel eyebrow="STATUT DES WO" title="Répartition des pannes" subtitle="Proportion ouvertes et clôturées" icon={PieChart}>
     <Donut centerLabel="PANNES" total={stats.ps.length} parts={[{label:"Clôturées",count:stats.closed.length,color:secondary},{label:"Ouvertes",count:stats.open.length,color:"#f4a261"}]}/>
     <div className="sm-trackRow"><span>Taux de clôture</span><strong>{stats.closureRate===null?"—":number(stats.closureRate)+"%"}</strong></div><div className="sm-track"><i style={{width:(stats.closureRate||0)+"%"}}/></div>
    </Panel>
    <Panel eyebrow="PARETO MACHINES" title="Équipements critiques" subtitle="Top machines selon le nombre de pannes" icon={Wrench}>
      <Ranking items={stats.pareto} suffix="WO" tone="cyan"/></Panel>
    <Panel eyebrow="PRÉVENTIF" title="Avancement du planning" subtitle="Statuts des interventions PM" icon={CalendarClock}>
      <div className="sm-statTiles"><div><strong>{stats.pm.length}</strong><span>Programmées</span></div><div><strong>{stats.done.length}</strong><span>Réalisées</span></div><div><strong>{scheduled}</strong><span>Restantes</span></div></div>
      <GaugeRing value={stats.pmRate} label="RÉALISATION" tone="green"/>
      <div className="sm-trackRow"><span>PM annulées</span><strong>{stats.cancelled.length}</strong></div>
    </Panel>
    <Panel eyebrow="DOWNTIME" title="Impact des arrêts" subtitle="Machines avec le plus d'heures d'arrêt" icon={Clock3} className="sm-wide">
      <Ranking items={stats.stopPareto} suffix="h" tone="orange" empty="Aucun arrêt déclaré sur la sélection."/></Panel>
   </div>
  </>}
  {tab==="reliability"&&<>
   <div className="sm-sectionTitle"><div><span className="sm-eyebrow">RELIABILITY ENGINEERING</span><h2>Fiabilité & disponibilité</h2></div></div>
   <div className="sm-kpiGrid sm-kpiGridSmall">
    <KPI label="Disponibilité moyenne pondérée" value={stats.availability===null?"—":number(stats.availability)+"%"} description="Sur les heures saisies" icon={Gauge} tone="green"/>
    <KPI label="MTBF estimé" value={stats.mtbf===null?"—":number(stats.mtbf)+" h"} description="Marche / pannes déclarées" icon={Target} tone="violet"/>
    <KPI label="MTTR moyen" value={stats.mttr===null?"—":number(stats.mttr)+" min"} description="WO clôturés" icon={Timer} tone="cyan"/>
    <KPI label="Heures de marche" value={number(stats.run)+" h"} description="Operating Time" icon={Activity} tone="blue"/>
   </div>
   <div className="sm-visualGrid">
    <Panel title="Disponibilité par mois" eyebrow="TENDANCE TECHNIQUE" subtitle="Ratio des heures de marche et planifiées enregistrées" className="sm-wide" icon={Gauge}>
      <TrendGraph labels={annual} series={[{name:"Disponibilité %",values:stats.series.availability,color:secondary}]}/></Panel>
    <Panel title="Machines par disponibilité" eyebrow="PERFORMANCE ÉQUIPEMENT" subtitle="Moyenne des relevés Operating Time" icon={Wrench}>
      <Ranking items={stats.machineStats.filter(x=>x.dispon!==null).sort((a,b)=>b.dispon-a.dispon).slice(0,7).map(x=>({name:x.tag,value:+x.dispon.toFixed(1)}))} suffix="%"/></Panel>
    <Panel title="MTBF estimé par machine" eyebrow="TEMPS ENTRE PANNES" subtitle="Heures de marche déclarées / WO" icon={Target}>
      <Ranking items={stats.machineStats.filter(x=>x.mtbf!==null).sort((a,b)=>b.mtbf-a.mtbf).slice(0,7).map(x=>({name:x.tag,value:+x.mtbf.toFixed(1)}))} suffix="h"/></Panel>
    <Panel title="MTTR par machine" eyebrow="TEMPS DE RÉPARATION" subtitle="Durée moyenne des pannes clôturées" icon={Timer}>
      <Ranking items={stats.machineStats.filter(x=>x.mttr!==null).sort((a,b)=>b.mttr-a.mttr).slice(0,7).map(x=>({name:x.tag,value:+x.mttr.toFixed(1)}))} suffix="min" tone="orange"/></Panel>
    <Panel title="Arrêts par mois" eyebrow="ÉVOLUTION DOWNTIME" subtitle="Heures d'arrêt déclarées dans les WO" icon={Clock3}>
      <TrendGraph mode="bars" labels={annual} series={[{name:"Arrêt (h)",values:stats.series.downtime,color:"#f4a261"}]}/></Panel>
   </div>
  </>}
  {tab==="pm"&&<>
   <div className="sm-sectionTitle"><div><span className="sm-eyebrow">PREVENTIVE MAINTENANCE</span><h2>Performance du préventif</h2></div></div>
   <div className="sm-kpiGrid sm-kpiGridSmall">
    <KPI label="PM programmées" value={stats.pm.length} description="Total sur la période" icon={CalendarClock} tone="cyan"/>
    <KPI label="PM réalisées" value={stats.done.length} description="Réalisées et non conformes" icon={CheckCircle2} tone="green"/>
    <KPI label="PM restantes" value={scheduled} description="Programmées hors annulation" icon={ClipboardList} tone="violet"/>
    <KPI label="PM en retard" value={stats.overdue.length} description="Retard actuellement constaté" icon={AlertCircle} tone="orange"/>
   </div>
   <div className="sm-visualGrid">
    <Panel eyebrow="SUIVI DES PM" title="Programmées vs réalisées" subtitle="Évolution sur 12 mois" icon={TrendingUp} className="sm-wide">
      <TrendGraph mode="bars" labels={annual} series={[{name:"Planifiées",values:stats.series.pm,color:primary},{name:"Réalisées",values:stats.series.done,color:secondary}]}/></Panel>
    <Panel eyebrow="TAUX DE RÉALISATION" title="Respect du programme" icon={Gauge}>
      <GaugeRing value={stats.pmRate} label="PM RÉALISÉES"/>
      <div className="sm-trackRow"><span>Annulées</span><strong>{stats.cancelled.length}</strong></div><div className="sm-track"><i style={{width:(stats.pm.length?stats.cancelled.length/stats.pm.length*100:0)+"%"}}/></div></Panel>
    <Panel eyebrow="RÉPARTITION PAR UNITÉ" title="Charge préventive" subtitle="Nombre de PM par unité" icon={Layers}>
      <Ranking items={[...stats.byUnit].sort((a,b)=>b.pm-a.pm).filter(x=>x.pm).slice(0,8).map(x=>({name:x.name,value:x.pm}))} suffix="PM"/></Panel>
    <Panel eyebrow="À SURVEILLER" title="Prochaines échéances en retard" icon={CalendarClock} className="sm-wide">
      <div className="sm-overdueList">{stats.overdue.length?[...stats.overdue].sort((a,b)=>iso(a.date_prevue).localeCompare(iso(b.date_prevue))).slice(0,12).map(p=><div key={p.id}>
       <span className="sm-overdueTag">RETARD</span><strong>{p.machine_tag||"Machine non renseignée"}</strong><span>{p.unite||"—"}</span><time>{dateFR(p.date_prevue)}</time></div>):
       <div className="sm-noData"><CheckCircle2 size={20}/>Aucune échéance PM en retard dans ce périmètre.</div>}</div></Panel>
   </div>
  </>}
  {tab==="team"&&<>
   <div className="sm-sectionTitle"><div><span className="sm-eyebrow">PERFORMANCE INDIVIDUELLE</span><h2>Activité des techniciens</h2></div></div>
   <div className="sm-kpiGrid sm-kpiGridSmall">
    <KPI label="Techniciens actifs sur WO" value={stats.technicians.length} description="Noms renseignés sur les pannes" icon={Users} tone="cyan"/>
    <KPI label="WO clôturés" value={stats.closed.length} description="Pannes clôturées dans le périmètre" icon={CheckCircle2} tone="green"/>
    <KPI label="Taux de clôture" value={stats.closureRate===null?"—":number(stats.closureRate)+"%"} description="Sur les WO sélectionnés" icon={Target} tone="violet"/>
    <KPI label="Durée d’arrêt des WO" value={number(stats.downtime/60)+" h"} description="Durée cumulée déclarée" icon={Clock3} tone="orange"/>
   </div>
   <div className="sm-visualGrid">
    <Panel eyebrow="CHARGE D'INTERVENTION" title="Top techniciens par WO" subtitle="Classement des interventions déclarées" className="sm-wide" icon={Users}>
     <Ranking items={stats.technicians.map(x=>({name:x.name,value:x.count}))} suffix="WO"/></Panel>
    <Panel eyebrow="PERFORMANCE DE CLÔTURE" title="Suivi individuel" subtitle="Basé sur les WO associés au technicien" className="sm-wide" icon={CheckCircle2}>
     {stats.technicians.length?<div className="sm-teamTableWrap"><table className="sm-teamTable"><thead><tr><th>Technicien</th><th>WO</th><th>Clôturés</th><th>Clôture</th><th>MTTR déclaré</th></tr></thead>
      <tbody>{stats.technicians.map(t=><tr key={t.name}><td>{t.name}</td><td>{t.count}</td><td>{t.closed}</td>
       <td><span className="sm-rateTag">{number(t.closed/t.count*100)} %</span></td><td>{t.closed?number(t.minutes/t.closed)+" min":"—"}</td></tr>)}</tbody></table></div>:
      <div className="sm-noData"><Users size={20}/>Aucun technicien identifié sur les WO de la sélection.</div>}
    </Panel>
   </div>
   <div className="sm-infoLine"><Info size={17}/> Ces indicateurs reflètent uniquement les interventions dont le champ technicien est renseigné, et non une évaluation RH du personnel.</div>
  </>}
  {!loading&&!hasData&&<div className="sm-noData sm-globalEmpty"><BarChart3 size={23}/>Aucune donnée sur la période et le périmètre sélectionnés. Choisissez une période plus large.</div>}
  <div className="sm-footnote"><span><Waves size={14}/> ENGINEERING · INDUSTRIAL INTELLIGENCE</span><span>MTBF estimé et MTTR calculés à partir des relevés disponibles. Aucun chiffre inventé.</span></div>
 </div>;
}
function getComputedStyleSafe(palette){
 return {
  ocean:{primary:"#43c6eb",secondary:"#36caaa"},
  emerald:{primary:"#47d3a4",secondary:"#8dbaf6"},
  royal:{primary:"#a798fc",secondary:"#54cfe6"}
 }[palette]||{primary:"#43c6eb",secondary:"#36caaa"};
}
