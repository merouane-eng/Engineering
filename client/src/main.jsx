import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "./registerSW";
import {
  Activity, CalendarClock, Gauge, LayoutDashboard, LogOut, Menu,
  Settings, Siren, Users, Wrench, ClipboardPlus, ClipboardList, Search, Plus, Save, X,
  ArrowUpRight, CalendarDays, CheckCircle2, CircleAlert, Clock3, PlusCircle, ClipboardCheck,
  Filter, TrendingUp, BarChart3, PieChart, Layers, MapPin, Boxes, RotateCcw, Sun, Moon
} from "lucide-react";
import "./styles.css";
import Effectif from "./EffectifRH.jsx";
import DesktopSettings from "./DesktopSettings.jsx";
import AdminExcelBar from "./AdminExcelBar.jsx";
import { useLanguage, LanguageSwitch } from "./i18n.jsx";

const modules = [
  ["accueil", "Accueil", LayoutDashboard],
  ["machines", "Machines", Wrench],
  ["effectif", "Effectif", Users],
  ["saisie", "Saisie panne", ClipboardPlus],
  ["liste", "Liste des pannes", ClipboardList],
  ["pm", "Maintenance préventive", CalendarClock],
  ["operating", "Operating Time", Gauge],
  ["stats", "Statistiques", Activity],
  ["parametres", "Paramètres", Settings]
];

const fieldsByModule = {
  machines: [
    ["tag", "Tag"], ["designation", "Désignation"], ["unite", "Unité"], ["groupe", "Groupe"],
    ["zone", "Zone"], ["marque", "Marque"], ["modele", "Modèle"], ["actif", "Actif", true]
  ],
  effectif: [
    ["matricule", "Matricule"], ["nom", "Nom"], ["prenom", "Prénom"], ["service", "Service"],
    ["fonction", "Fonction"], ["telephone", "Téléphone"], ["email", "Email"], ["actif", "Actif", true]
  ],
  saisie: [
    ["wo", "WO"], ["date_panne", "Date panne", "date"], ["unite", "Unité"], ["machine", "Machine"],
    ["probleme", "Problème"], ["service", "Service"], ["statut", "Statut"], ["technicien", "Technicien"]
  ],
  liste: [
    ["wo", "WO"], ["date_panne", "Date panne", "date"], ["unite", "Unité"], ["service", "Département"], ["area", "Area"], ["machine", "Machine"],
    ["probleme", "Problème"], ["technicien", "Technicien"], ["statut", "Statut"], ["commentaire", "Commentaire"], ["pieces_consommees", "Pièces consommées"]
  ],
  pm: [
    ["machine_tag", "Machine"], ["machine_designation", "Désignation"], ["unite", "Unité"],
    ["frequence", "Fréquence"], ["date_prevue", "Date prévue", "date"], ["responsable", "Responsable"], ["statut", "Statut"]
  ],
  operating: [
    ["machine", "Machine"], ["date_jour", "Date", "date"], ["heures_planifiees", "Heures planifiées", "number"],
    ["heures_marche", "Heures marche", "number"], ["heures_arret", "Heures arrêt", "number"], ["commentaire", "Commentaire"]
  ],
  parametres: [
    ["type_liste", "Type"], ["valeur", "Valeur"], ["parent", "Parent"], ["ordre", "Ordre", "number"], ["actif", "Actif", true]
  ]
};

const tables = {
  machines: "machines", effectif: "techniciens", saisie: "pannes", liste: "pannes",
  pm: "pm_programmees", operating: "operating_time", parametres: "ref_listes"
};

async function api(path, options = {}) {
  const token = localStorage.getItem("engineering_token");
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem("engineering_token");
    localStorage.removeItem("engineering_user");
    window.location.reload();
  }
  if (!response.ok) throw new Error(body.error || "Erreur serveur");
  return body;
}

function Login({ onLogin, language, setLanguage }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [usernames, setUsernames] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    api("/api/auth/usernames").then(setUsernames).catch(() => setUsernames([]));
  }, []);

  const suggestions = usernames.filter(value =>
    value.toLowerCase().includes(username.trim().toLowerCase())
  ).slice(0, 5);

  const submit = async event => {
    event.preventDefault();
    setError("");
    try {
      const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      localStorage.setItem("engineering_token", result.token);
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    }
  };
  return <main className="loginPage">
    <LanguageSwitch language={language} setLanguage={setLanguage} className="loginLanguage" />
    <form className="loginCard" onSubmit={submit}>
      <div className="loginBrand"><img src="/engineering-logo.svg" alt="Engineering GMAO" /></div>
      <h1>Engineering</h1>
      <p>Gestion de maintenance industrielle</p>
      <label>Nom d'utilisateur</label>
      <div className="usernameField">
        <input
          value={username}
          onChange={e => { setUsername(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
          autoComplete="username"
          autoFocus
        />
        {showSuggestions && username && suggestions.length > 0 && <div className="usernameSuggestions">
          {suggestions.map(value => <button
            type="button"
            key={value}
            onMouseDown={() => { setUsername(value); setShowSuggestions(false); }}
          >{value}</button>)}
        </div>}
      </div>
      <label>Mot de passe</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div className="formError">{error}</div>}
      <button className="primary" type="submit">Se connecter</button>
    </form>
  </main>;
}

function Dashboard({ user, onNavigate }) {
  const [data,setData] = useState(null), [cloud,setCloud] = useState(null), [loading,setLoading] = useState(true), [error,setError] = useState("");
  const load = async () => { setLoading(true); setError(""); try { const r = await Promise.all([api("/api/dashboard"),api("/api/supabase/status").catch(() => ({linked:false}))]); setData(r[0]); setCloud(r[1]); } catch(e) { setError(e.message || "Chargement impossible"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const dateLabel = new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
  const formatDate = value => { if(!value) return "—"; const d=new Date(value); return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short"}).format(d); };
  const cards = [["Machines en service",data?.machines,Wrench,"blue","Parc autorisé"],["Techniciens actifs",data?.techniciens,Users,"violet","Effectif disponible"],["Pannes ouvertes",data?.pannesOuvertes,CircleAlert,"orange","À traiter"],["Pannes clôturées",data?.pannesFermees,CheckCircle2,"green","Ce mois-ci"],["PM à réaliser",data?.pmProgrammee,CalendarClock,"orange","En retard ou ce mois"],["PM réalisées",data?.pmRealisees,ClipboardCheck,"green","Ce mois-ci"]];
  return <div className="dashboard">
    <section className="dashboardHero"><div className="dashboardHeroText"><span className="eyebrow">CENTRE DE PILOTAGE · ENGINEERING</span><h1>Bonjour {user?.prenom || user?.nom || "Utilisateur"} <span>👋</span></h1><p>Voici la situation de votre maintenance aujourd'hui.</p><div className="dashboardHeroMeta"><CalendarDays/><span>{dateLabel}</span></div></div>
      <div className="dashboardHeroAside"><div className={cloud?.linked?"cloudState connected":"cloudState"}><span className="cloudDot"/>{cloud?.linked?"Base de données connectée":"Connexion à vérifier"}</div><div className="heroIllustration"><div className="heroRing heroRingOne"/><div className="heroRing heroRingTwo"/><div className="heroIcon"><Gauge/></div><span className="heroSpark heroSparkOne">✦</span><span className="heroSpark heroSparkTwo">＋</span></div></div>
    </section>
    <div className="dashboardSectionHead"><div><span className="eyebrow">VUE GÉNÉRALE</span><h2>Indicateurs clés</h2></div><button className="dashboardRefresh" onClick={load} disabled={loading}><Activity/> Actualiser</button></div>
    {error&&<div className="dashboardError">{error}<button onClick={load}>Réessayer</button></div>}
    <section className="dashboardKpis">{cards.map(([label,value,Icon,tone,note])=><article className="dashboardKpi" key={label}><div className="dashboardKpiTop"><span className={"dashboardKpiIcon "+tone}><Icon/></span><span className="dashboardKpiArrow"><ArrowUpRight/></span></div><strong>{loading&&!data?"—":value??0}</strong><span className="dashboardKpiLabel">{label}</span><small>{note}</small></article>)}</section>
    <section className="dashboardLower">
      <article className="dashboardPanel"><div className="dashboardPanelHead"><div><span className="eyebrow">SUIVI OPÉRATIONNEL</span><h3>Dernières pannes</h3></div><button onClick={()=>onNavigate("liste")}>Tout voir <ArrowUpRight/></button></div>
      {data?.recentPannes?.length?<div className="dashboardRows">{data.recentPannes.map((row,index)=><div className="dashboardRow" key={row.id||row.wo||index}><span className={row.statut==="Close"?"rowStatus closed":"rowStatus open"}>{row.statut==="Close"?<CheckCircle2/>:<CircleAlert/>}</span><div className="dashboardRowMain"><strong>{row.machine||"Machine non précisée"}</strong><span>{row.wo?"WO "+row.wo+" · ":""}{row.probleme||"Intervention de maintenance"}</span></div><div className="dashboardRowMeta"><span>{formatDate(row.date_panne)}</span><small>{row.unite||"—"}</small></div></div>)}</div>:<div className="dashboardEmpty"><ClipboardList/><strong>Aucune panne récente à afficher</strong><span>Les nouvelles déclarations apparaîtront ici.</span></div>}</article>
      <article className="dashboardPanel"><div className="dashboardPanelHead"><div><span className="eyebrow">ANTICIPER LES ARRÊTS</span><h3>Maintenance préventive</h3></div><button onClick={()=>onNavigate("pm")}>Planning <ArrowUpRight/></button></div>
      {data?.upcomingPM?.length?<div className="dashboardRows">{data.upcomingPM.map((row,index)=><div className="dashboardRow" key={row.id||row.machine_tag||index}><span className="pmDate"><strong>{new Date(row.date_prevue+"T00:00:00").getDate()}</strong><small>{new Intl.DateTimeFormat("fr-FR",{month:"short"}).format(new Date(row.date_prevue+"T00:00:00"))}</small></span><div className="dashboardRowMain"><strong>{row.machine_tag||"Machine"}</strong><span>{row.frequence||"Maintenance préventive"} · {row.unite||"—"}</span></div><span className="pmBadge">{row.statut||"Planifiée"}</span></div>)}</div>:<div className="dashboardEmpty"><CalendarClock/><strong>Aucune PM à venir</strong><span>Le planning préventif est à jour.</span></div>}</article>
    </section>
    <section className="dashboardQuick"><div className="dashboardQuickTitle"><span className="eyebrow">ACCÈS RAPIDE</span><h3>Que souhaitez-vous faire ?</h3></div><div className="dashboardQuickGrid">
      <button onClick={()=>onNavigate("saisie")}><span className="quickIcon orange"><PlusCircle/></span><span><strong>Déclarer une panne</strong><small>Créer un nouvel ordre de travail</small></span><ArrowUpRight/></button>
      <button onClick={()=>onNavigate("machines")}><span className="quickIcon blue"><Wrench/></span><span><strong>Consulter les machines</strong><small>Voir le parc et ses équipements</small></span><ArrowUpRight/></button>
      <button onClick={()=>onNavigate("pm")}><span className="quickIcon green"><CalendarClock/></span><span><strong>Planifier une PM</strong><small>Organiser la maintenance préventive</small></span><ArrowUpRight/></button>
      <button onClick={()=>onNavigate("stats")}><span className="quickIcon violet"><Activity/></span><span><strong>Voir les statistiques</strong><small>Analyser les indicateurs maintenance</small></span><ArrowUpRight/></button>
    </div></section>
    <div className="dashboardFooter"><span>ENGINEERING · Gestion de maintenance industrielle</span><span><Clock3/> Données actualisées à la demande</span></div>
  </div>;
}
function Stats() {
  const [dataset,setDataset]=useState({pannes:[],pm:[],operating:[],machines:[],units:[]});
  const [period,setPeriod]=useState("30"),[unit,setUnit]=useState("Toutes les unités"),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=async()=>{
    setLoading(true);setError("");
    const names=["liste","pm","operating","machines","operating/context"],keys=["pannes","pm","operating","machines","units"];
    const results=await Promise.allSettled(names.map(name=>api("/api/modules/"+name)));
    const next={pannes:[],pm:[],operating:[],machines:[],units:[]};
    results.forEach((r,i)=>{if(r.status!=="fulfilled")return;if(keys[i]==="units")next.units=Array.isArray(r.value?.units)?r.value.units:[];else if(Array.isArray(r.value))next[keys[i]]=r.value;});
    if(results.every(r=>r.status==="rejected"))setError("Impossible de charger les statistiques. Vérifiez la connexion puis réessayez.");
    else if(results.some(r=>r.status==="rejected"))setError("Certaines données ne sont pas accessibles. Les indicateurs concernés peuvent être incomplets.");
    setDataset(next);setLoading(false);
  };
  useEffect(()=>{load();},[]);
  const today=new Date(),todayKey=today.toISOString().slice(0,10);
  const dateOf=value=>{if(!value)return null;const d=new Date(String(value).slice(0,10)+"T00:00:00");return Number.isNaN(d.getTime())?null:d;};
  const cutoff=new Date(today);cutoff.setHours(0,0,0,0);
  if(period!=="all")cutoff.setDate(cutoff.getDate()-(period==="year"?364:Number(period)-1));
  const inPeriod=value=>{const d=dateOf(value);return d&&d<=new Date(todayKey+"T23:59:59")&&(period==="all"||d>=cutoff);};
  const inUnit=row=>unit==="Toutes les unités"||row.unite===unit;
  const pannes=dataset.pannes.filter(row=>inUnit(row)&&inPeriod(row.date_panne));
  const pm=dataset.pm.filter(row=>inUnit(row)&&inPeriod(row.date_prevue));
  const operating=dataset.operating.filter(row=>inPeriod(row.date_jour)&&dataset.machines.some(machine=>machine.tag===row.machine&&dataset.units.includes(machine.unite)&&(unit==="Toutes les unités"||machine.unite===unit)));
  const open=pannes.filter(row=>String(row.statut||"").toLowerCase()!=="close");
  const closed=pannes.filter(row=>String(row.statut||"").toLowerCase()==="close");
  const realized=["réalisée","realisee","non conforme"];
  const completedPM=pm.filter(row=>realized.includes(String(row.statut||"").toLowerCase()));
  const overduePM=dataset.pm.filter(row=>inUnit(row)&&dateOf(row.date_prevue)&&dateOf(row.date_prevue)<new Date(todayKey+"T00:00:00")&&!realized.includes(String(row.statut||"").toLowerCase()));
  const totalDowntime=pannes.reduce((sum,row)=>sum+Math.max(0,Number(row.downtime||0)),0);
  const operatingHours=operating.reduce((sum,row)=>sum+Math.max(0,Number(row.heures_marche||0)),0);
  const plannedHours=operating.reduce((sum,row)=>sum+Math.max(0,Number(row.heures_planifiees||0)),0);
  const stopHours=operating.reduce((sum,row)=>sum+Math.max(0,Number(row.heures_arret||0)),0);
  const closedDowntime=closed.reduce((sum,row)=>sum+Math.max(0,Number(row.downtime||0)),0);
  const availability=plannedHours>0?Math.max(0,Math.min(100,operatingHours/plannedHours*100)):null;
  const closureRate=pannes.length?closed.length/pannes.length*100:0;
  const pmRate=pm.length?completedPM.length/pm.length*100:0;
  const mttr=closed.length?closedDowntime/closed.length:null;
  const mtbf=pannes.length?operatingHours/pannes.length:null;
  const fmt=value=>new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(value);
  const units=["Toutes les unités",...dataset.units].sort((a,b)=>a.localeCompare(b,"fr"));
  const months=Array.from({length:6},(_,i)=>{const d=new Date(today.getFullYear(),today.getMonth()-5+i,1);return {key:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),label:new Intl.DateTimeFormat("fr-FR",{month:"short"}).format(d)};});
  const monthly=months.map(m=>({...m,count:dataset.pannes.filter(r=>inUnit(r)&&String(r.date_panne||"").slice(0,7)===m.key).length}));
  const maxMonth=Math.max(1,...monthly.map(m=>m.count));
  const topMachines=Object.entries(pannes.reduce((acc,r)=>{const k=r.machine||"Non renseignée";acc[k]=(acc[k]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxMachine=Math.max(1,...topMachines.map(r=>r[1]));
  const cards=[
    ["Total des pannes",pannes.length,"Ordres de travail sur la période",ClipboardList,"blue"],
    ["Pannes ouvertes",open.length,"Interventions encore en cours",Siren,"orange"],
    ["Pannes clôturées",closed.length,fmt(closureRate)+" % de clôture",CheckCircle2,"green"],
    ["Temps d’arrêt panne",fmt(totalDowntime/60)+" h","Durée cumulée des WO",Clock3,"red"],
    ["MTTR",mttr===null?"—":fmt(mttr)+" min","Moyenne par panne clôturée",Activity,"violet"],
    ["MTBF estimé",mtbf===null?"—":fmt(mtbf)+" h","Marche / nombre de pannes",Gauge,"cyan"],
    ["Disponibilité",availability===null?"—":fmt(availability)+" %","Marche / heures planifiées saisies",TrendingUp,"green"],
    ["Heures de marche",fmt(operatingHours)+" h","Operating Time enregistré",Gauge,"blue"],
    ["Heures d’arrêt OT",fmt(stopHours)+" h","Heures d’arrêt saisies dans Operating Time",Clock3,"orange"],
    ["PM planifiées",pm.length,"Préventif prévu sur la période",CalendarClock,"cyan"],
    ["PM réalisées",completedPM.length,fmt(pmRate)+" % du planning",CheckCircle2,"green"],
    ["PM en retard",overduePM.length,"À réaliser avant aujourd’hui",CircleAlert,"red"]
  ];
  return <div className="statsPage">
    <div className="statsHero"><div><span className="eyebrow">ENGINEERING · PERFORMANCE & FIABILITÉ</span><h1>Centre de pilotage</h1><p>Une vision consolidée de la performance de maintenance, des arrêts et du préventif.</p><div className="statsHeroMeta"><span><Activity/> Analyse opérationnelle</span><span><CalendarDays/> {new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"long",year:"numeric"}).format(today)}</span></div></div><div className="statsHeroMark"><div className="statsHeroOrbit"/><div className="statsHeroIcon"><BarChart3/></div><span>ENGINEERING</span></div></div>
    <div className="statsToolbar"><div className="statsFilterGroup"><label><CalendarDays/> Période</label><div className="statsPeriod">{[["7","7 jours"],["30","30 jours"],["90","90 jours"],["year","12 mois"],["all","Tout"]].map(([v,l])=><button key={v} className={period===v?"active":""} onClick={()=>setPeriod(v)}>{l}</button>)}</div></div><div className="statsFilterGroup statsUnitFilter"><label><Filter/> Unité</label><select value={unit} onChange={e=>setUnit(e.target.value)}>{units.map(v=><option key={v}>{v}</option>)}</select></div><button className="statsReload" onClick={load} disabled={loading}><Activity/> {loading?"Chargement…":"Actualiser"}</button></div>
    {error&&<div className="statsNotice"><CircleAlert/>{error}<button onClick={load}>Réessayer</button></div>}
    <div className="statsSectionTitle"><div><span className="eyebrow">SYNTHÈSE DE PERFORMANCE</span><h2>Indicateurs clés</h2></div><span className="statsScope">{unit} · {period==="all"?"Toutes les périodes":period==="year"?"12 derniers mois":"Derniers "+period+" jours"}</span></div>
    <section className="statsKpiGrid">{cards.map(([label,value,detail,Icon,tone])=><article className="statsKpi" key={label}><div className="statsKpiTop"><span className={"statsKpiIcon "+tone}><Icon/></span><span className="statsKpiTag">KPI</span></div><strong>{loading?"—":value}</strong><b>{label}</b><small>{detail}</small></article>)}</section>
    <section className="statsChartsGrid">
      <article className="statsPanel"><div className="statsPanelHead"><div><span className="eyebrow">TENDANCE</span><h3>Évolution des pannes</h3><p>Nombre de WO déclarés par mois · 6 derniers mois</p></div><span className="statsPanelIcon"><TrendingUp/></span></div><div className="statsBarChart">{monthly.map(m=><div className="statsBarColumn" key={m.key}><strong>{m.count}</strong><div className="statsBarTrack"><span style={{height:Math.max(m.count?5:0,m.count/maxMonth*100)+"%"}}/></div><small>{m.label}</small></div>)}</div></article>
      <article className="statsPanel"><div className="statsPanelHead"><div><span className="eyebrow">ÉTAT DES INTERVENTIONS</span><h3>Répartition des pannes</h3><p>Ouvertes vs clôturées</p></div><span className="statsPanelIcon"><PieChart/></span></div><div className="statsStatusContent"><div className="statsDonut" style={{"--closed":(pannes.length?closed.length/pannes.length*100:0)+"%"}}><div><strong>{pannes.length}</strong><small>Total WO</small></div></div><div className="statsLegend"><div><span className="statsLegendDot open"/><span>Ouvertes</span><strong>{open.length}</strong></div><div><span className="statsLegendDot closed"/><span>Clôturées</span><strong>{closed.length}</strong></div></div></div><div className="statsProgress"><div><span>Taux de clôture</span><strong>{fmt(closureRate)}%</strong></div><span className="statsProgressTrack"><i style={{width:closureRate+"%"}}/></span></div></article>
      <article className="statsPanel"><div className="statsPanelHead"><div><span className="eyebrow">ANALYSE ÉQUIPEMENT</span><h3>Machines les plus en panne</h3><p>Top 6 sur la période sélectionnée</p></div><span className="statsPanelIcon"><Wrench/></span></div>{topMachines.length?<div className="statsRanking">{topMachines.map(([name,value],i)=><div className="statsRankRow" key={name}><span className="statsRankNumber">{String(i+1).padStart(2,"0")}</span><div className="statsRankBody"><div><strong>{name}</strong><b>{value}</b></div><span className="statsRankTrack"><i style={{width:value/maxMachine*100+"%"}}/></span></div></div>)}</div>:<div className="statsEmpty">Aucune panne sur cette sélection.</div>}</article>
      <article className="statsPanel"><div className="statsPanelHead"><div><span className="eyebrow">MAINTENANCE PRÉVENTIVE</span><h3>Respect du planning PM</h3><p>État des interventions préventives</p></div><span className="statsPanelIcon"><CalendarClock/></span></div><div className="statsPmSummary"><div><strong>{pm.length}</strong><span>PM planifiées</span></div><div><strong>{completedPM.length}</strong><span>Réalisées</span></div><div><strong>{overduePM.length}</strong><span>En retard</span></div></div><div className="statsProgress"><div><span>Taux de réalisation</span><strong>{fmt(pmRate)}%</strong></div><span className="statsProgressTrack"><i className="pm" style={{width:Math.min(100,pmRate)+"%"}}/></span></div><div className="statsPmFoot"><span><span className="statsLegendDot closed"/> Réalisées</span><span><span className="statsLegendDot open"/> À suivre</span></div></article>
    </section>
    <section className="statsBottomGrid"><article className="statsPanel statsInsight"><span className="statsInsightIcon"><Gauge/></span><div><span className="eyebrow">FIABILITÉ & DISPONIBILITÉ</span><h3>Lecture des indicateurs</h3><p>{availability===null?"La disponibilité sera calculée dès que des heures planifiées et des heures de marche seront enregistrées dans Operating Time.":"La disponibilité calculée sur les relevés Operating Time est de "+fmt(availability)+" %. Elle repose sur les heures de marche et les heures planifiées renseignées."}</p><p>{mttr===null?"Le MTTR sera disponible après clôture des premiers ordres de travail avec une durée d’arrêt renseignée.":"Le MTTR moyen observé est de "+fmt(mttr)+" minutes sur "+closed.length+" panne(s) clôturée(s)."}</p></div></article><article className="statsPanel"><div className="statsPanelHead"><div><span className="eyebrow">PÉRIMÈTRE</span><h3>Ressources suivies</h3></div><span className="statsPanelIcon"><Users/></span></div><div className="statsResourceRows"><div><Wrench/><span>Machines actives</span><strong>{dataset.machines.filter(r=>dataset.units.includes(r.unite)&&Number(r.actif)===1&&(unit==="Toutes les unités"||r.unite===unit)).length}</strong></div><div><CalendarClock/><span>Relevés Operating Time</span><strong>{operating.length}</strong></div></div></article></section>
    <div className="statsFooter"><span>ENGINEERING · Tableau de bord statistique</span><span>Indicateurs calculés à partir des enregistrements disponibles</span></div>
  </div>;
}
function PageTitle({ title, subtitle }) {
  return <header className="pageTitle"><div><span className="eyebrow">ENGINEERING</span><h2>{title}</h2><p>{subtitle}</p></div></header>;
}

function MachinePage({ user }) {
  const [rows,setRows]=useState([]),[query,setQuery]=useState(""),[unit,setUnit]=useState(""),[group,setGroup]=useState(""),[area,setArea]=useState(""),[editing,setEditing]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const defs=fieldsByModule.machines;
  const load=async()=>{setLoading(true);setError("");try{const data=await api("/api/modules/machines");setRows(Array.isArray(data)?data:[]);}catch(e){setError(e.message||"Chargement impossible");}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const unique=values=>[...new Set(values.map(v=>String(v||"").trim()).filter(Boolean))].sort((x,y)=>x.localeCompare(y,"fr"));
  const units=unique(rows.map(r=>r.unite));
  const groups=unique(rows.filter(r=>!unit||r.unite===unit).map(r=>r.groupe));
  const areas=unique(rows.filter(r=>(!unit||r.unite===unit)&&(!group||r.groupe===group)).map(r=>r.zone));
  const active=v=>v===true||v===1||v==="1"||String(v).toLowerCase()==="true";
  const filtered=rows.filter(r=>[r.tag,r.designation,r.unite,r.groupe,r.zone,r.marque,r.modele].join(" ").toLowerCase().includes(query.toLowerCase())&&(!unit||r.unite===unit)&&(!group||r.groupe===group)&&(!area||r.zone===area));
  const activeCount=rows.filter(r=>active(r.actif)).length, inactiveCount=rows.length-activeCount;
  const unitCount=units.length, groupCount=unique(rows.map(r=>r.groupe)).length, areaCount=unique(rows.map(r=>r.zone)).length;
  const byUnit=units.map(name=>({name,count:rows.filter(r=>r.unite===name).length})).sort((x,y)=>y.count-x.count), maxUnit=Math.max(1,...byUnit.map(x=>x.count));
  const save=async values=>{await api(editing?.id?"/api/tables/machines/"+editing.id:"/api/tables/machines",{method:editing?.id?"PUT":"POST",body:JSON.stringify(values)});setEditing(null);load();};
  const remove=async id=>{if(!window.confirm("Supprimer cette machine ?"))return;try{await api("/api/tables/machines/"+id,{method:"DELETE"});load();}catch(e){setError(e.message);}};
  const reset=()=>{setUnit("");setGroup("");setArea("");setQuery("");};
  return <div className="machineMaster">
    <style>{`
      .machineMaster{color:#1b3150;padding-bottom:28px}.machineMaster .mm-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:27px 30px;margin:4px 0 19px;border-radius:20px;color:#fff;background:linear-gradient(115deg,#102b54,#174b87 62%,#2874bd);box-shadow:0 12px 30px #163b681f}.machineMaster .mm-eyebrow{font-size:10px;font-weight:800;letter-spacing:1.6px;color:#b9d7ff}.machineMaster .mm-hero h1{font-size:26px;margin:9px 0 6px;color:#fff}.machineMaster .mm-hero p{margin:0;color:#d7e7fb;font-size:13px}.machineMaster .mm-heroIcon{width:62px;height:62px;display:grid;place-items:center;border:1px solid #ffffff38;border-radius:18px;background:#ffffff18}.machineMaster .mm-heroIcon svg{width:30px;height:30px}
      .machineMaster .mm-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.machineMaster .mm-kpi{padding:15px 17px;border:1px solid #e7edf5;border-radius:15px;background:#fff;box-shadow:0 5px 18px #183b6408;min-width:0}.machineMaster .mm-kpiTop{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.machineMaster .mm-kpiIcon{width:35px;height:35px;display:grid;place-items:center;border-radius:11px;background:#edf4ff;color:#2866c5}.machineMaster .mm-kpiIcon svg{width:18px;height:18px}.machineMaster .mm-kpi:nth-child(2) .mm-kpiIcon{background:#eaf8f0;color:#15945b}.machineMaster .mm-kpi:nth-child(3) .mm-kpiIcon{background:#f2edff;color:#7654c7}.machineMaster .mm-kpi:nth-child(4) .mm-kpiIcon{background:#fff4e8;color:#d47a22}.machineMaster .mm-kpi strong{display:block;font-size:27px;color:#1c3558;font-weight:850}.machineMaster .mm-kpi span:last-child{display:block;margin-top:5px;color:#7c8ba0;font-size:11px;font-weight:650}
      .machineMaster .mm-toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:13px}.machineMaster .mm-sectionTitle h2{margin:3px 0 0;font-size:17px;color:#203958}.machineMaster .mm-filters{display:grid;grid-template-columns:minmax(190px,1.5fr) repeat(3,minmax(130px,1fr)) auto;gap:9px;padding:13px;margin-bottom:16px;border:1px solid #e6edf5;border-radius:14px;background:#fff}.machineMaster .mm-field{display:flex;flex-direction:column;gap:6px;min-width:0}.machineMaster .mm-field label{font-size:10px;font-weight:800;color:#687b94}.machineMaster .mm-field input,.machineMaster .mm-field select{box-sizing:border-box;width:100%;height:39px;min-width:0;border:1px solid #dfe7f0;border-radius:9px;background:#fbfcfe;color:#29415f;padding:0 10px;font:inherit;font-size:11px;outline:none}.machineMaster .mm-reset{height:39px;display:flex;align-items:center;gap:6px;padding:0 11px;border:1px solid #dfe7f0;border-radius:9px;background:#f7f9fc;color:#60748e;font-size:10px;font-weight:750;cursor:pointer;white-space:nowrap}.machineMaster .mm-reset svg{width:14px;height:14px}
      .machineMaster .mm-content{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:14px;align-items:start}.machineMaster .mm-listPanel,.machineMaster .mm-sidePanel{border:1px solid #e6edf5;border-radius:15px;background:#fff;box-shadow:0 5px 18px #183b6408;min-width:0}.machineMaster .mm-listHead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:15px 17px;border-bottom:1px solid #edf1f6}.machineMaster .mm-listHead h3{margin:0;font-size:13px;color:#29415f}.machineMaster .mm-listHead span{font-size:10px;color:#8291a5}.machineMaster .mm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:13px}.machineMaster .mm-machine{padding:13px;border:1px solid #e9eef5;border-radius:12px;background:linear-gradient(145deg,#fff,#fbfcff);min-width:0}.machineMaster .mm-machineTop{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.machineMaster .mm-tag{display:inline-flex;padding:5px 8px;border-radius:7px;background:#edf4ff;color:#245da9;font-size:10px;font-weight:850}.machineMaster .mm-status{display:inline-flex;align-items:center;gap:5px;font-size:9px;font-weight:750;color:#15945b}.machineMaster .mm-status.off{color:#9a6b39}.machineMaster .mm-status i{width:6px;height:6px;border-radius:50%;background:currentColor}.machineMaster .mm-machine h4{margin:10px 0 4px;font-size:13px;color:#213a5a;line-height:1.35;overflow-wrap:anywhere}.machineMaster .mm-machineMeta{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.machineMaster .mm-machineMeta span{display:inline-flex;align-items:center;gap:5px;padding:6px 7px;border-radius:7px;background:#f3f6fa;color:#647790;font-size:9px;font-weight:650}.machineMaster .mm-machineMeta svg{width:12px;height:12px}.machineMaster .mm-machineFoot{display:flex;justify-content:flex-end;gap:6px;margin-top:11px;padding-top:9px;border-top:1px solid #edf1f6}.machineMaster .mm-machineFoot button{padding:6px 8px;border:1px solid #e2e9f1;border-radius:7px;background:#fff;color:#47617f;font-size:9px;font-weight:750;cursor:pointer}.machineMaster .mm-machineFoot button.dangerText{color:#bd4c4c}
      .machineMaster .mm-sidePanel{padding:15px}.machineMaster .mm-sidePanel h3{margin:0 0 4px;font-size:12px;color:#29415f}.machineMaster .mm-sidePanel>p{margin:0 0 15px;font-size:9px;color:#8a98aa}.machineMaster .mm-unitRow{margin:12px 0}.machineMaster .mm-unitLabel{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:10px;color:#5c718b}.machineMaster .mm-unitLabel strong{color:#29415f}.machineMaster .mm-track{height:6px;overflow:hidden;border-radius:9px;background:#edf1f6}.machineMaster .mm-track i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#3478d4,#63a3ed)}.machineMaster .mm-sideStats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px;padding-top:13px;border-top:1px solid #edf1f6}.machineMaster .mm-sideStats div{padding:9px;border-radius:9px;background:#f7f9fc}.machineMaster .mm-sideStats strong{display:block;font-size:18px;color:#27466c}.machineMaster .mm-sideStats span{font-size:9px;color:#8391a4}.machineMaster .mm-empty{padding:35px 15px;text-align:center;color:#8291a5;font-size:11px}.machineMaster .mm-empty svg{display:block;width:25px;height:25px;margin:0 auto 9px;color:#9aabc0}.machineMaster .mm-notice{margin-bottom:12px;padding:10px 12px;border:1px solid #f2d7d7;border-radius:9px;background:#fff7f7;color:#a34242;font-size:11px}
      @media(max-width:1100px){.machineMaster .mm-content{grid-template-columns:1fr}.machineMaster .mm-sidePanel{display:none}}@media(max-width:850px){.machineMaster .mm-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.machineMaster .mm-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.machineMaster .mm-search{grid-column:1/-1}}@media(max-width:600px){.machineMaster .mm-hero{padding:21px 17px}.machineMaster .mm-hero h1{font-size:21px}.machineMaster .mm-grid{grid-template-columns:1fr}.machineMaster .mm-filters{grid-template-columns:1fr}.machineMaster .mm-search{grid-column:auto}.machineMaster .mm-toolbar{align-items:stretch;flex-direction:column}}
    `}</style>
    <section className="mm-hero"><div><span className="mm-eyebrow">ENGINEERING · ASSET MANAGEMENT</span><h1>Parc machines</h1><p>Explorez vos équipements, filtrez par unité, groupe et zone, et suivez votre parc en un coup d'œil.</p></div><div className="mm-heroIcon"><Wrench/></div></section>
    <section className="mm-kpis">
      <article className="mm-kpi"><div className="mm-kpiTop"><span className="mm-kpiIcon"><Wrench/></span><span className="eyebrow">PARC TOTAL</span></div><strong>{loading?"—":rows.length}</strong><span>Machines référencées</span></article>
      <article className="mm-kpi"><div className="mm-kpiTop"><span className="mm-kpiIcon"><Activity/></span><span className="eyebrow">EN SERVICE</span></div><strong>{loading?"—":activeCount}</strong><span>Machines actives</span></article>
      <article className="mm-kpi"><div className="mm-kpiTop"><span className="mm-kpiIcon"><Layers/></span><span className="eyebrow">ORGANISATION</span></div><strong>{loading?"—":unitCount}</strong><span>Unités couvertes</span></article>
      <article className="mm-kpi"><div className="mm-kpiTop"><span className="mm-kpiIcon"><MapPin/></span><span className="eyebrow">LOCALISATION</span></div><strong>{loading?"—":areaCount}</strong><span>Areas / zones</span></article>
    </section>
    <div className="mm-toolbar"><div className="mm-sectionTitle"><span className="eyebrow">EXPLORATEUR DU PARC</span><h2>Équipements</h2></div><button className="primary" onClick={()=>setEditing({})}><Plus/> Ajouter une machine</button></div>
    <section className="mm-filters">
      <div className="mm-field mm-search"><label>RECHERCHE RAPIDE</label><input placeholder="Tag, désignation, marque…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className="mm-field"><label>UNITÉ</label><select value={unit} onChange={e=>{setUnit(e.target.value);setGroup("");setArea("");}}><option value="">Toutes les unités</option>{units.map(v=><option key={v}>{v}</option>)}</select></div>
      <div className="mm-field"><label>GROUPE</label><select value={group} onChange={e=>{setGroup(e.target.value);setArea("");}}><option value="">Tous les groupes</option>{groups.map(v=><option key={v}>{v}</option>)}</select></div>
      <div className="mm-field"><label>AREA / ZONE</label><select value={area} onChange={e=>setArea(e.target.value)}><option value="">Toutes les zones</option>{areas.map(v=><option key={v}>{v}</option>)}</select></div>
      <button className="mm-reset" onClick={reset}><RotateCcw/> Effacer</button>
    </section>
    {error&&<div className="mm-notice">{error}</div>}
    <section className="mm-content"><article className="mm-listPanel">
      <div className="mm-listHead"><h3>Liste des équipements</h3><span>{filtered.length} / {rows.length} machine(s)</span></div>
      {loading?<div className="mm-empty">Chargement du parc machines…</div>:filtered.length?<div className="mm-grid">{filtered.map(row=><article className="mm-machine" key={row.id||row.tag}>
        <div className="mm-machineTop"><span className="mm-tag">{row.tag||"SANS TAG"}</span><span className={active(row.actif)?"mm-status":"mm-status off"}><i/>{active(row.actif)?"En service":"Inactive"}</span></div>
        <h4>{row.designation||"Machine sans désignation"}</h4><div className="mm-machineMeta"><span><Layers/>{row.unite||"Unité non définie"}</span><span><Boxes/>{row.groupe||"Sans groupe"}</span><span><MapPin/>{row.zone||"Zone non définie"}</span></div>
        {(row.marque||row.modele)&&<div className="mm-machineMeta"><span>{[row.marque,row.modele].filter(Boolean).join(" · ")}</span></div>}
        <div className="mm-machineFoot"><button onClick={()=>setEditing(row)}>Modifier</button><button className="dangerText" onClick={()=>remove(row.id)}>Supprimer</button></div>
      </article>)}</div>:<div className="mm-empty"><Wrench/>Aucune machine ne correspond à ces filtres.</div>}
    </article><aside className="mm-sidePanel"><h3>Répartition par unité</h3><p>Nombre d'équipements dans chaque unité</p>
      {byUnit.length?byUnit.map(item=><div className="mm-unitRow" key={item.name}><div className="mm-unitLabel"><span>{item.name}</span><strong>{item.count}</strong></div><div className="mm-track"><i style={{width:(item.count/maxUnit*100)+"%"}}/></div></div>):<div className="mm-empty">Aucune donnée</div>}
      <div className="mm-sideStats"><div><strong>{groupCount}</strong><span>Groupes</span></div><div><strong>{inactiveCount}</strong><span>Inactives</span></div></div>
    </aside></section>
    {editing&&<Editor fields={defs} values={editing} onClose={()=>setEditing(null)} onSave={save}/>}
  </div>;
}

function DataPage({ module, user }) {
  const defs = fieldsByModule[module];
  const [rows,setRows]=useState([]), [query,setQuery]=useState(""), [editing,setEditing]=useState(null);
  const [context,setContext]=useState({units:[],services:[],zones:[],technicians:[]});
  const [unitFilter,setUnitFilter]=useState(""), [departmentFilter,setDepartmentFilter]=useState(""), [areaFilter,setAreaFilter]=useState(""), [technicianFilter,setTechnicianFilter]=useState(""), [monthFilter,setMonthFilter]=useState("");
  const load=()=>api("/api/modules/"+module).then(setRows);
  useEffect(()=>{load().catch(()=>setRows([]));if(module==="liste")api("/api/saisie/context").then(setContext).catch(()=>setContext({units:[],services:[],zones:[],technicians:[]}));},[module]);
  const filtered=rows.filter(row=>{if(!JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))return false;if(module!=="liste")return true;const date=String(row.date_panne||"").slice(0,10);return(!unitFilter||row.unite===unitFilter)&&(!departmentFilter||row.service===departmentFilter)&&(!areaFilter||(row.area||row.zone)===areaFilter)&&(!technicianFilter||row.technicien===technicianFilter)&&(!monthFilter||date.startsWith(monthFilter));});
  const save=async values=>{const table=tables[module];await api(editing?.id?"/api/tables/"+table+"/"+editing.id:"/api/tables/"+table,{method:editing?.id?"PUT":"POST",body:JSON.stringify(values)});setEditing(null);load();};
  const remove=async id=>{if(!window.confirm("Supprimer cet élément ?"))return;await api("/api/tables/"+tables[module]+"/"+id,{method:"DELETE"});load();};
  const title=modules.find(item=>item[0]===module)?.[1]||module;
  const unique=values=>[...new Set(values.filter(value=>value&&String(value).trim()).map(value=>String(value).trim()))].sort((a,b)=>a.localeCompare(b,"fr"));
  const units=unique([...(context.units||[]),...rows.map(r=>r.unite)]), departments=unique([...(context.services||[]),...rows.map(r=>r.service)]), areas=unique([...(context.zones||[]),...rows.map(r=>r.area||r.zone)]), technicians=unique([...(context.technicians||[]).map(t=>typeof t==="string"?t:t.name),...rows.map(r=>r.technicien)]);
  const isOpen=value=>["open","opened","ouvert","ouverte","en cours","pending"].includes(String(value||"").toLowerCase());
  const openCount=rows.filter(r=>isOpen(r.statut)).length, closedCount=rows.length-openCount, currentMonth=new Date().toISOString().slice(0,7), monthCount=rows.filter(r=>String(r.date_panne||"").slice(0,7)===currentMonth).length;
  const reset=()=>{setQuery("");setUnitFilter("");setDepartmentFilter("");setAreaFilter("");setTechnicianFilter("");setMonthFilter("");};
  return <div className={module==="liste"?"breakdownListMaster":""}>
    <PageTitle title={title} subtitle={filtered.length+" / "+rows.length+" enregistrement(s)"} />
    {module==="liste"&&<>
      <section className="bl-kpis">
        <article className="bl-kpi"><div className="bl-kpiTop"><span>TOTAL DES PANNES</span><span className="bl-kpiIcon bl-blue"><ClipboardList/></span></div><strong>{rows.length}</strong><small>Toutes les déclarations enregistrées</small></article>
        <article className="bl-kpi"><div className="bl-kpiTop"><span>OUVERTES</span><span className="bl-kpiIcon bl-orange"><CircleAlert/></span></div><strong>{openCount}</strong><small>Interventions à traiter / en cours</small></article>
        <article className="bl-kpi"><div className="bl-kpiTop"><span>CLÔTURÉES</span><span className="bl-kpiIcon bl-green"><CheckCircle2/></span></div><strong>{closedCount}</strong><small>Interventions terminées</small></article>
        <article className="bl-kpi"><div className="bl-kpiTop"><span>CE MOIS-CI</span><span className="bl-kpiIcon bl-violet"><CalendarDays/></span></div><strong>{monthCount}</strong><small>Pannes déclarées ce mois</small></article>
      </section>
      <section className="bl-filters">
        <div className="bl-search"><Search/><input placeholder="Rechercher WO, machine, problème..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <div className="bl-filter"><label>Unité</label><select value={unitFilter} onChange={e=>setUnitFilter(e.target.value)}><option value="">Toutes les unités</option>{units.map(v=><option key={v}>{v}</option>)}</select></div>
        <div className="bl-filter"><label>Département</label><select value={departmentFilter} onChange={e=>setDepartmentFilter(e.target.value)}><option value="">Tous les départements</option>{departments.map(v=><option key={v}>{v}</option>)}</select></div>
        <div className="bl-filter"><label>Area / Zone</label><select value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}><option value="">Toutes les areas</option>{areas.map(v=><option key={v}>{v}</option>)}</select></div>
        <div className="bl-filter"><label>Technicien</label><select value={technicianFilter} onChange={e=>setTechnicianFilter(e.target.value)}><option value="">Tous les techniciens</option>{technicians.map(v=><option key={v}>{v}</option>)}</select></div>
        <div className="bl-filter"><label>Mois</label><input type="month" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)}/></div><button className="bl-reset" onClick={reset}>Réinitialiser</button>
      </section>
      <div className="bl-count"><span><strong>{filtered.length}</strong> panne(s) affichée(s) sur {rows.length}</span><span>Filtres cumulables · Données inchangées</span></div>
    </>}
    {module!=="liste"&&<section className="toolbar"><div className="search"><Search/><input placeholder="Rechercher..." value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="primary" onClick={()=>setEditing({})}><Plus/> Ajouter</button></section>}
    <div className="tableWrap"><table><thead><tr>{defs.map(([key,label])=><th key={key}>{label}</th>)}<th/></tr></thead><tbody>{filtered.map(row=><tr key={row.id}>{defs.map(([key])=><td key={key} className={key==="technicien"?"bl-technician-cell":""}>{key==="actif"?(row[key]?"Oui":"Non"):key==="technicien"?<span className="bl-tech"><i>{String(row[key]||"—").slice(0,1).toUpperCase()}</i>{row[key]||"—"}</span>:key==="wo"?<span className="bl-wo">{row[key]??"—"}</span>:row[key]??"—"}</td>)}<td className="actions"><button onClick={()=>setEditing(row)}>Modifier</button>{module!=="liste"&&<button className="dangerText" onClick={()=>remove(row.id)}>Supprimer</button>}</td></tr>)}</tbody></table>{!filtered.length&&<div className="empty">Aucun résultat</div>}</div>
    {editing&&<Editor fields={defs} values={editing} onClose={()=>setEditing(null)} onSave={save}/>}
  </div>;
}
function FailureEntry({ user }) {
  const empty = { wo: "", statut: "Open", service: "", technicien: "", unite: "", machine: "", area: "", probleme: "", commentaire: "", date_panne: "", date_debut: "", date_fin: "", downtime: "" };
  const [context, setContext] = useState({ units: [], machines: [], services: [], zones: [], technicians: [], technician: "", service: "" });
  const [pieceContext, setPieceContext] = useState({ catalog: [], machineParts: [], history: [] });
  const [pieces, setPieces] = useState([]);
  const [pieceDraft, setPieceDraft] = useState({ selected: "", nom_piece: "", reference_piece: "", quantite: 1 });
  const [pieceFormOpen, setPieceFormOpen] = useState(false);
  const [newPiece, setNewPiece] = useState({ reference: "", nom: "", description: "" });
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api("/api/saisie/context").then(data => {
      setContext(data);
      setDraft(current => ({ ...current, unite: data.units[0] || "", technicien: data.technician, service: data.service }));
    }).catch(() => setError("Impossible de charger les unités autorisées"));
  }, []);
  useEffect(() => {
    api(`/api/pieces/context${draft.machine ? `?machine=${encodeURIComponent(draft.machine)}` : ""}`)
      .then(setPieceContext).catch(() => setPieceContext({ catalog: [], machineParts: [], history: [] }));
  }, [draft.machine]);
  const machines = context.machines.filter(row => !draft.unite || row.unite === draft.unite);
  const calculatedDowntime = () => {
    if (!draft.date_debut || !draft.date_fin) return "";
    const start = new Date(draft.date_debut);
    const end = new Date(draft.date_fin);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "";
    return Math.round((end - start) / 60000);
  };
  const downtime = calculatedDowntime();
  const selectPiece = id => {
    const selected = pieceContext.catalog.find(piece => String(piece.id) === String(id));
    setPieceDraft({ ...pieceDraft, selected: id, nom_piece: selected?.nom || "", reference_piece: selected?.reference || "" });
  };
  const addPiece = () => {
    if (!pieceDraft.nom_piece.trim()) return;
    setPieces(current => [...current, {
      piece_id: pieceDraft.selected ? Number(pieceDraft.selected) : null,
      nom_piece: pieceDraft.nom_piece.trim(),
      reference_piece: pieceDraft.reference_piece.trim(),
      quantite: Math.max(1, Number(pieceDraft.quantite || 1))
    }]);
    setPieceDraft({ selected: "", nom_piece: "", reference_piece: "", quantite: 1 });
  };
  const createPiece = async event => {
    event.preventDefault();
    if (!newPiece.nom.trim()) return;
    const piece = await api("/api/pieces", { method: "POST", body: JSON.stringify({ ...newPiece, machine: draft.machine }) });
    await api(`/api/pieces/context${draft.machine ? `?machine=${encodeURIComponent(draft.machine)}` : ""}`).then(setPieceContext);
    setPieceDraft({ selected: String(piece.id), nom_piece: piece.nom, reference_piece: piece.reference || "", quantite: 1 });
    setPieceFormOpen(false);
    setNewPiece({ reference: "", nom: "", description: "" });
  };
  const selectTechnician = name => {
    const selected = context.technicians.find(item => item.name === name);
    setDraft(current => ({ ...current, technicien: name, service: selected?.service || current.service }));
  };
  const submit = async event => {
    event.preventEvent?.();
    event.preventDefault();
    setError(""); setSaved(false);
    try {
      const splitDateTime = value => {
        if (!value) return { date: "", time: "" };
        const [date, timeWithSeconds = ""] = String(value).replace("T", " ").split(" ");
        return { date, time: timeWithSeconds.slice(0, 5) };
      };
      const formatDesktopDateTime = value => {
        if (!value) return "";
        const { date, time } = splitDateTime(value);
        return date && time ? `${date} ${time}` : date;
      };
      const panneDateTime = splitDateTime(draft.date_panne);
      await api("/api/pannes", {
        method: "POST",
        body: JSON.stringify({
          ...draft,
          date_panne: panneDateTime.date,
          heure_panne: panneDateTime.time,
          date_debut: formatDesktopDateTime(draft.date_debut),
          date_fin: formatDesktopDateTime(draft.date_fin),
          wo: draft.wo.trim(),
          service: user.role === "admin" ? draft.service : context.service,
          technicien: user.role === "admin" ? draft.technicien : context.technician,
          downtime: downtime !== "" ? Number(downtime) : Number(draft.downtime || 0),
          pieces
        })
      });
      setSaved(true);
      setDraft({ ...empty, unite: context.units[0] || "", technicien: context.technician, service: context.service });
    } catch (err) { setError(err.message); }
  };
  return <div className="failureMaster">
    <style>{`
      .failureMaster{color:#1b3150;padding-bottom:28px}.failureMaster .fm-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:27px 30px;margin:4px 0 20px;border-radius:20px;color:white;background:linear-gradient(115deg,#102b54,#174b87 62%,#2874bd);box-shadow:0 12px 30px #163b681f}.failureMaster .fm-eyebrow{font-size:10px;font-weight:800;letter-spacing:1.6px;color:#b9d7ff}.failureMaster .fm-hero h1{font-size:26px;margin:9px 0 6px;color:white}.failureMaster .fm-hero p{margin:0;color:#d7e7fb;font-size:13px}.failureMaster .fm-heroIcon{width:62px;height:62px;display:grid;place-items:center;border:1px solid #ffffff38;border-radius:18px;background:#ffffff18}.failureMaster .fm-heroIcon svg{width:30px;height:30px}.failureMaster .fm-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:18px}.failureMaster .fm-step{display:flex;align-items:center;gap:9px;padding:11px;border:1px solid #e7edf5;border-radius:12px;background:#fff}.failureMaster .fm-step b{width:29px;height:29px;flex:0 0 29px;display:grid;place-items:center;border-radius:9px;background:#eaf2ff;color:#2461bd;font-size:11px}.failureMaster .fm-step strong{display:block;font-size:11px;color:#29405f}.failureMaster .fm-step small{display:block;margin-top:3px;font-size:9px;color:#8795a8}.failureMaster .failureForm{display:grid;gap:15px}.failureMaster .fm-card{padding:20px 22px;border:1px solid #e7edf5;border-radius:16px;background:white;box-shadow:0 5px 18px #183b640d}.failureMaster .fm-head{display:flex;align-items:center;gap:11px;margin-bottom:17px;padding-bottom:13px;border-bottom:1px solid #edf1f6}.failureMaster .fm-icon{width:37px;height:37px;display:grid;place-items:center;border-radius:11px;background:#edf4ff;color:#2866c5}.failureMaster .fm-icon svg{width:19px}.failureMaster .fm-head h3{margin:0;font-size:14px;color:#1d3557}.failureMaster .fm-head p{margin:3px 0 0;font-size:10px;color:#8492a6}.failureMaster .failureForm .formGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 17px}.failureMaster .failureForm label{display:flex;flex-direction:column;gap:7px;min-width:0;font-size:11px;font-weight:750;color:#435671}.failureMaster .failureForm label input,.failureMaster .failureForm label select,.failureMaster .failureForm label textarea{box-sizing:border-box;width:100%;min-width:0;border:1px solid #dfe6ef;border-radius:9px;background:#fbfcfe;color:#1e3554;padding:10px 11px;font:inherit;font-weight:500;font-size:12px;outline:none}.failureMaster .failureForm label input,.failureMaster .failureForm label select{height:40px}.failureMaster .failureForm label textarea{min-height:88px;resize:vertical}.failureMaster .failureForm label input:focus,.failureMaster .failureForm label select:focus,.failureMaster .failureForm label textarea:focus{border-color:#6b9ce8;background:#fff;box-shadow:0 0 0 3px #2f75dc16}.failureMaster .failureForm label input:disabled{background:#f1f4f8}.failureMaster .failureForm .fullField{grid-column:1/-1}.failureMaster .fm-hint{font-size:9px;color:#8795a8;font-weight:500}.failureMaster .fm-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}.failureMaster .fm-meta span{padding:7px 10px;border-radius:8px;background:#f3f7fd;color:#5a6d86;font-size:10px}.failureMaster .fm-meta b{color:#245da9}.failureMaster .failurePartsToolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.failureMaster .failurePartsToolbar p{margin:0;font-size:10px;color:#8290a4}.failureMaster .piecePicker{display:grid;grid-template-columns:2fr 1.2fr 1.2fr .7fr auto;gap:9px;align-items:end;padding:13px;border:1px solid #e8eef6;border-radius:12px;background:#f8faff}.failureMaster .piecePicker .secondary{height:40px;white-space:nowrap}.failureMaster .machineParts{margin-top:13px;padding:13px;border:1px solid #e8eef6;border-radius:11px;background:#fbfcff}.failureMaster .machineParts h4{margin:0 0 10px;font-size:11px;color:#344b69}.failureMaster .usedParts{display:grid;gap:7px;margin-top:11px}.failureMaster .usedParts>div{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border:1px solid #e8edf4;border-radius:9px;background:#fff}.failureMaster .usedParts strong{font-size:11px;color:#304766}.failureMaster .usedParts span{font-size:10px;color:#8492a6}.failureMaster .fm-history{margin-top:13px;border:1px solid #e8edf4;border-radius:10px;overflow:auto}.failureMaster .fm-submit{position:sticky;bottom:10px;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 15px;border:1px solid #dfe8f5;border-radius:13px;background:#ffffffed;backdrop-filter:blur(10px);box-shadow:0 8px 25px #183b641c}.failureMaster .fm-submit span{font-size:10px;color:#7c8ba0}.failureMaster .fm-submit .primary{min-height:42px;padding:0 20px;border-radius:9px;font-weight:750}.failureMaster .fm-alert{margin-bottom:13px}@media(max-width:900px){.failureMaster .fm-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.failureMaster .piecePicker{grid-template-columns:repeat(2,minmax(0,1fr))}.failureMaster .piecePicker>label:first-child{grid-column:1/-1}}@media(max-width:600px){.failureMaster .fm-hero{padding:21px 17px}.failureMaster .fm-hero h1{font-size:21px}.failureMaster .fm-heroIcon{width:48px;height:48px}.failureMaster .fm-step{padding:8px 7px;gap:6px}.failureMaster .fm-step small{display:none}.failureMaster .fm-card{padding:15px 12px}.failureMaster .failureForm .formGrid{grid-template-columns:1fr;gap:12px}.failureMaster .failureForm .fullField{grid-column:auto}.failureMaster .piecePicker{grid-template-columns:1fr}.failureMaster .piecePicker>label:first-child{grid-column:auto}.failureMaster .failurePartsToolbar,.failureMaster .fm-submit{align-items:stretch;flex-direction:column}.failureMaster .fm-submit .primary{width:100%;justify-content:center}}
    `}</style>
    <div className="fm-hero"><div><span className="fm-eyebrow">ENGINEERING · WORK ORDER MANAGEMENT</span><h1>Déclaration d'une panne</h1><p>De la détection à la clôture, assurez une traçabilité complète de l'intervention.</p></div><div className="fm-heroIcon"><ClipboardPlus/></div></div>
    <div className="fm-steps"><div className="fm-step"><b>01</b><span><strong>Identification</strong><small>WO · Machine · Zone</small></span></div><div className="fm-step"><b>02</b><span><strong>Description</strong><small>Symptômes · Commentaire</small></span></div><div className="fm-step"><b>03</b><span><strong>Intervention</strong><small>Équipe · Downtime</small></span></div><div className="fm-step"><b>04</b><span><strong>Pièces & validation</strong><small>Consommation · Historique</small></span></div></div>
    {saved&&<div className="success fm-alert">Panne enregistrée avec succès.</div>}{error&&<div className="formError fm-alert">{error}</div>}
    <form className="failureForm" onSubmit={submit}>
      <section className="fm-card"><div className="fm-head"><span className="fm-icon"><ClipboardList/></span><div><h3>Identification de la panne</h3><p>Informations essentielles sur l'équipement concerné.</p></div></div>
        <div className="formGrid">
          <label>N° WO <span className="fm-hint">Référence de l'ordre de travail</span><input required value={draft.wo||""} onChange={e=>setDraft({...draft,wo:e.target.value})} placeholder="Ex. WO-2026-001"/></label>
          <label>Date et heure de la panne<input type="datetime-local" required value={draft.date_panne||""} onChange={e=>setDraft({...draft,date_panne:e.target.value})}/></label>
          <label>Unité<select required value={draft.unite} onChange={e=>setDraft({...draft,unite:e.target.value,machine:""})}><option value="">Sélectionner...</option>{context.units.map(unit=><option key={unit} value={unit}>{unit}</option>)}</select></label>
          <label>Machine<select required value={draft.machine} onChange={e=>{const tag=e.target.value;const selectedMachine=machines.find(item=>item.tag===tag);setDraft(current=>({...current,machine:tag,area:selectedMachine?.zone||""}));}}><option value="">Sélectionner une machine...</option>{machines.map(machine=><option key={machine.tag} value={machine.tag}>{machine.tag} — {machine.designation||""}</option>)}</select></label>
          <label className="fullField">Zone<input required list="failure-zones" value={draft.area} onChange={e=>setDraft({...draft,area:e.target.value})} placeholder="Zone de la machine ou saisir une zone"/><datalist id="failure-zones">{context.zones.map(zone=><option key={zone} value={zone}/>)}</datalist></label>
        </div><div className="fm-meta"><span>Unité : <b>{draft.unite||"En attente"}</b></span><span>Machine : <b>{draft.machine||"Non sélectionnée"}</b></span></div>
      </section>
      <section className="fm-card"><div className="fm-head"><span className="fm-icon"><CircleAlert/></span><div><h3>Description de l'anomalie</h3><p>Décrivez le défaut constaté et les circonstances.</p></div></div><div className="formGrid">
        <label className="fullField">Problème<textarea required value={draft.probleme} onChange={e=>setDraft({...draft,probleme:e.target.value})} placeholder="Décrivez le symptôme, l'anomalie ou le défaut observé..."/></label>
        <label className="fullField">Commentaire<textarea required value={draft.commentaire} onChange={e=>setDraft({...draft,commentaire:e.target.value})} placeholder="Informations complémentaires utiles..."/></label>
      </div></section>
      <section className="fm-card"><div className="fm-head"><span className="fm-icon"><Wrench/></span><div><h3>Suivi de l'intervention</h3><p>Affectation de l'équipe et suivi chronologique.</p></div></div><div className="formGrid">
        <label>Service de maintenance<select required value={user.role==="admin"?draft.service:context.service} disabled={user.role!=="admin"} onChange={e=>setDraft({...draft,service:e.target.value})}><option value="">Sélectionner...</option>{context.services.map(service=><option key={service} value={service}>{service}</option>)}</select></label>
        <label>Technicien{user.role==="admin"?<select required value={draft.technicien} onChange={e=>selectTechnician(e.target.value)}><option value="">Sélectionner...</option>{context.technicians.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select>:<input value={context.technician} disabled/>}</label>
        <label>Début de l'intervention<input required type="datetime-local" value={draft.date_debut||""} onChange={e=>setDraft({...draft,date_debut:e.target.value})}/></label>
        <label>Fin de l'intervention<input required type="datetime-local" value={draft.date_fin||""} onChange={e=>setDraft({...draft,date_fin:e.target.value})}/></label>
        <label>Downtime <span className="fm-hint">Calcul automatique en minutes</span><input type="number" min="0" readOnly value={draft.downtime||downtime} placeholder="Calcul automatique"/></label>
        <label>Statut<select value={draft.statut} onChange={e=>setDraft({...draft,statut:e.target.value})}><option value="Open">Open</option><option value="Close">Close</option></select></label>
      </div><div className="fm-meta"><span>Durée calculée : <b>{downtime!==""?downtime+" min":"À déterminer"}</b></span><span>État : <b>{draft.statut==="Close"?"Clôturé":"Ouvert"}</b></span></div></section>
      <section className="fm-card"><div className="fm-head"><span className="fm-icon"><Wrench/></span><div><h3>Pièces de rechange</h3><p>Sélectionnez les pièces consommées ou ajoutez une nouvelle référence.</p></div></div>
        <div className="failurePartsToolbar"><p>Les pièces ajoutées seront associées à cet ordre de travail.</p><button className="secondary" type="button" onClick={()=>setPieceFormOpen(true)}><Plus/> Nouvelle pièce au catalogue</button></div>
        <div className="piecePicker">
          <label>Catalogue de pièces<select value={pieceDraft.selected} onChange={e=>selectPiece(e.target.value)}><option value="">Saisir ou choisir une pièce...</option>{pieceContext.catalog.map(piece=><option key={piece.id} value={piece.id}>{piece.reference?piece.reference+" — ":""}{piece.nom}</option>)}</select></label>
          <label>Nom de la pièce<input value={pieceDraft.nom_piece} onChange={e=>setPieceDraft({...pieceDraft,nom_piece:e.target.value})} placeholder="Désignation"/></label>
          <label>Référence<input value={pieceDraft.reference_piece} onChange={e=>setPieceDraft({...pieceDraft,reference_piece:e.target.value})} placeholder="Référence"/></label>
          <label>Quantité<input type="number" min="1" value={pieceDraft.quantite} onChange={e=>setPieceDraft({...pieceDraft,quantite:e.target.value})}/></label>
          <button className="secondary" type="button" onClick={addPiece}><Plus/> Ajouter</button>
        </div>
        {draft.machine&&<div className="machineParts"><h4>Référentiel de la machine — {draft.machine}</h4>{pieceContext.machineParts.length>0?<div className="usedParts">{pieceContext.machineParts.map(piece=><div key={piece.id}><strong>{piece.nom}</strong><span>{piece.reference||"Sans référence"}</span><button type="button" className="secondary" onClick={()=>setPieceDraft({selected:String(piece.id),nom_piece:piece.nom,reference_piece:piece.reference||"",quantite:1})}>Utiliser</button></div>)}</div>:<p className="hint">Aucune pièce référentielle associée à cette machine pour le moment.</p>}{pieceDraft.selected&&!pieceContext.machineParts.some(piece=>String(piece.id)===String(pieceDraft.selected))&&<button type="button" className="secondary" onClick={async()=>{try{await api("/api/pieces/"+pieceDraft.selected+"/machines",{method:"POST",body:JSON.stringify({machine:draft.machine})});const refreshed=await api("/api/pieces/context?machine="+encodeURIComponent(draft.machine));setPieceContext(refreshed);}catch(err){setError(err.message);}}}>Associer cette pièce au référentiel de la machine</button>}</div>}
        {pieces.length>0?<div className="usedParts">{pieces.map((piece,index)=><div key={piece.reference_piece+"-"+index}><strong>{piece.nom_piece}</strong><span>{piece.reference_piece||"Sans référence"} · Qté {piece.quantite}</span><button type="button" className="dangerText" onClick={()=>setPieces(current=>current.filter((_,itemIndex)=>itemIndex!==index))}>Retirer</button></div>)}</div>:<div className="empty">Aucune pièce ajoutée à cet ordre de travail.</div>}
      </section>
      <section className="fm-card"><div className="fm-head"><span className="fm-icon"><ClipboardCheck/></span><div><h3>Historique des pièces utilisées</h3><p>Traçabilité des consommations précédentes pour cette machine.</p></div></div>
        <div className="fm-history"><table><thead><tr><th>Date</th><th>WO</th><th>Machine</th><th>Pièce</th><th>Référence</th><th>Quantité</th></tr></thead><tbody>{pieceContext.history.slice(0,50).map(piece=><tr key={piece.id}><td>{piece.date_utilisation||"—"}</td><td>{piece.wo||"—"}</td><td>{piece.machine}</td><td>{piece.nom}</td><td>{piece.reference||"—"}</td><td>{piece.quantite}</td></tr>)}</tbody></table></div>
        {!draft.machine&&<div className="empty">Sélectionnez une machine pour afficher son historique.</div>}{draft.machine&&!pieceContext.history.length&&<div className="empty">Aucun historique de pièce pour cette machine.</div>}
      </section>
      <div className="fm-submit"><span>Vérifiez les informations avant de valider la déclaration.</span><button className="primary" type="submit"><Save/> Enregistrer la panne</button></div>
    </form>
    {pieceFormOpen&&<div className="modalBack"><form className="modal" onSubmit={createPiece}><div className="modalHead"><h3>Nouvelle pièce de rechange</h3><button className="iconButton" type="button" onClick={()=>setPieceFormOpen(false)}><X/></button></div><div className="formGrid"><label>Nom<input required value={newPiece.nom} onChange={e=>setNewPiece({...newPiece,nom:e.target.value})}/></label><label>Référence<input value={newPiece.reference} onChange={e=>setNewPiece({...newPiece,reference:e.target.value})}/></label><label>Description<input value={newPiece.description} onChange={e=>setNewPiece({...newPiece,description:e.target.value})}/></label></div><div className="modalActions"><button type="button" onClick={()=>setPieceFormOpen(false)}>Annuler</button><button className="primary" type="submit"><Save/> Ajouter la pièce</button></div></form></div>}
  </div>;
}

function Editor({ fields, values, onClose, onSave }) {
  const [draft, setDraft] = useState(values);
  const submit = event => { event.preventDefault(); onSave(draft); };
  return <div className="modalBack">
    <form className="modal" onSubmit={submit}>
      <div className="modalHead"><h3>{values.id ? "Modifier" : "Nouvel élément"}</h3><button type="button" className="iconButton" onClick={onClose}><X /></button></div>
      <div className="formGrid">{fields.map(([key, label, kind]) => <label key={key}>{label}
        {kind === true ? <select value={draft[key] ?? 1} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })}><option value={1}>Oui</option><option value={0}>Non</option></select>
          : kind === "date" ? <input type="date" value={draft[key] || ""} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
          : kind === "number" ? <input type="number" step="0.1" value={draft[key] ?? ""} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })} />
          : <input value={draft[key] ?? ""} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />}
      </label>)}</div>
      <div className="modalActions"><button type="button" onClick={onClose}>Annuler</button><button className="primary" type="submit"><Save /> Enregistrer</button></div>
    </form>
  </div>;
}

function AccessSettings({ user }) {
  const [users, setUsers] = useState([]);
  const load = () => api("/api/modules/effectif").then(setUsers);
  useEffect(() => { load().catch(() => setUsers([])); }, []);
  const changeRole = async (id, role) => { await api(`/api/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }); load(); };
  const changePassword = async id => {
    const password = window.prompt("Nouveau mot de passe (4 caractères minimum)");
    if (!password) return;
    await api(`/api/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) });
    alert("Mot de passe mis à jour.");
  };
  return <div>
    <PageTitle title="Paramètres & accès" subtitle="Gestion des rôles et comptes" />
    <div className="tableWrap"><table><thead><tr><th>Nom</th><th>Utilisateur</th><th>Fonction</th><th>Rôle</th><th /></tr></thead><tbody>
      {users.map(row => {
        const role = row.is_admin ? "admin" : /superviseur|supervisor/i.test(row.fonction || "") ? "superviseur" : "technicien";
        return <tr key={row.id}><td>{row.nom} {row.prenom || ""}</td><td>{row.username}</td><td>{row.fonction}</td>
          <td><select value={role} disabled={row.id === user.id} onChange={e => changeRole(row.id, e.target.value)}>
            <option value="technicien">Technicien</option><option value="superviseur">Superviseur</option><option value="admin">Administrateur</option>
          </select></td><td><button onClick={() => changePassword(row.id)}>Mot de passe</button></td></tr>;
      })}
    </tbody></table></div>
    <DesktopSettings />
  </div>;
}

function EffectifAncien({ user }) {
  const [rows, setRows] = useState([]);
  const [context, setContext] = useState({ units: [], services: [], functions: [] });
  const [form, setForm] = useState(null), [query, setQuery] = useState(""), [error, setError] = useState("");
  const [unitFilter, setUnitFilter] = useState(""), [functionFilter, setFunctionFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(""), [statusFilter, setStatusFilter] = useState("all");
  const load = () => api("/api/modules/effectif").then(setRows);
  useEffect(() => {
    load().catch(() => setRows([]));
    api("/api/effectif/context").then(setContext).catch(() => setContext({ units: [], services: [], functions: [] }));
  }, []);
  const openNew = () => setForm({ matricule:"",nom:"",prenom:"",service:"",fonction:"",telephone:"",email:"",date_recrutement:"",date_depart:"",actif:true,is_admin:false,toutes_unites:false,units:[] });
  const openEdit = row => setForm({ ...row, actif:Boolean(row.actif), is_admin:Boolean(row.is_admin), toutes_unites:Boolean(row.toutes_unites), units:Array.isArray(row.units)?row.units:[] });
  const save = async event => {
    event.preventDefault(); setError("");
    if (!form.matricule || !form.nom || !form.service || !form.fonction) { setError("Matricule, nom, département et fonction sont obligatoires."); return; }
    try {
      await api(form.id ? "/api/effectif/" + form.id : "/api/effectif", { method:form.id?"PUT":"POST", body:JSON.stringify(form) });
      setForm(null); load();
    } catch(err) { setError(err.message); }
  };
  const toggleUnit = unite => setForm(current => ({ ...current, units:current.units.includes(unite)?current.units.filter(value=>value!==unite):[...current.units,unite] }));
  const active = value => value===true || value===1 || value==="1" || value==="true";
  const rowUnits = row => Array.isArray(row.units)?row.units:(row.unite?[row.unite]:[]);
  const unique = values => [...new Set(values.filter(value=>value&&String(value).trim()).map(value=>String(value).trim()))].sort((a,b)=>a.localeCompare(b,"fr"));
  const unitOptions = unique([...(context.units||[]),...rows.flatMap(rowUnits)]);
  const departmentOptions = unique([...(context.services||[]),...rows.map(row=>row.service)]);
  const functionOptions = unique([...(context.functions||[]),...rows.map(row=>row.fonction)]);
  const filtered = rows.filter(row =>
    JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase()) &&
    (!unitFilter || active(row.toutes_unites) || rowUnits(row).includes(unitFilter)) &&
    (!functionFilter || row.fonction===functionFilter) &&
    (!departmentFilter || row.service===departmentFilter) &&
    (statusFilter==="all" || (statusFilter==="active"?active(row.actif):!active(row.actif)))
  );
  const activeCount=rows.filter(row=>active(row.actif)).length, inactiveCount=rows.length-activeCount;
  const resetFilters=()=>{setQuery("");setUnitFilter("");setFunctionFilter("");setDepartmentFilter("");setStatusFilter("all");};
  return <div className="effectifMaster">
    <section className="ef-hero"><div><span className="ef-eyebrow">ENGINEERING · HUMAN RESOURCES</span><h1>Gestion des effectifs</h1><p>Une vue claire des équipes, des affectations et des compétences par unité.</p></div><div className="ef-heroIcon"><Users /></div></section>
    <section className="ef-kpis">
      <article className="ef-kpi"><div className="ef-kpiTop"><span className="ef-kpiIcon blue"><Users /></span><span className="ef-kpiTag">EFFECTIF</span></div><strong>{rows.length}</strong><small>Collaborateurs enregistrés</small></article>
      <article className="ef-kpi"><div className="ef-kpiTop"><span className="ef-kpiIcon green"><CheckCircle2 /></span><span className="ef-kpiTag">DISPONIBILITÉ</span></div><strong>{activeCount}</strong><small>Collaborateurs actifs</small></article>
      <article className="ef-kpi"><div className="ef-kpiTop"><span className="ef-kpiIcon violet"><Layers /></span><span className="ef-kpiTag">ORGANISATION</span></div><strong>{departmentOptions.length}</strong><small>Départements représentés</small></article>
      <article className="ef-kpi"><div className="ef-kpiTop"><span className="ef-kpiIcon orange"><MapPin /></span><span className="ef-kpiTag">COUVERTURE</span></div><strong>{unitOptions.length}</strong><small>Unités référencées · {inactiveCount} inactif(s)</small></article>
    </section>
    <section className="ef-toolbar">
      <div className="ef-search"><Search /><input placeholder="Rechercher un nom, matricule, email..." value={query} onChange={e=>setQuery(e.target.value)} /></div>
      <div className="ef-filter"><label><MapPin /> Unité</label><select value={unitFilter} onChange={e=>setUnitFilter(e.target.value)}><option value="">Toutes les unités</option>{unitOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></div>
      <div className="ef-filter"><label><Users /> Fonction</label><select value={functionFilter} onChange={e=>setFunctionFilter(e.target.value)}><option value="">Toutes les fonctions</option>{functionOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></div>
      <div className="ef-filter"><label><Layers /> Département</label><select value={departmentFilter} onChange={e=>setDepartmentFilter(e.target.value)}><option value="">Tous les départements</option>{departmentOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></div>
      <div className="ef-filter"><label><Filter /> Statut</label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Tous les statuts</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select></div>
      <button className="ef-reset" onClick={resetFilters}><RotateCcw /> Réinitialiser</button>
      {user.role==="admin" && <button className="primary ef-add" onClick={openNew}><Plus /> Ajouter</button>}
    </section>
    <div className="ef-results"><span><strong>{filtered.length}</strong> résultat(s) affiché(s) sur {rows.length}</span><span>Filtres combinables · Mise à jour à la demande</span></div>
    {error && <div className="formError">{error}</div>}
    {filtered.length ? <section className="ef-grid">{filtered.map(row=>{
      const units=rowUnits(row), initials=((row.prenom||"").trim().slice(0,1)+(row.nom||"").trim().slice(0,1)).toUpperCase()||"—";
      return <article className="ef-person" key={row.id||row.matricule}>
        <div className="ef-personHead"><span className="ef-avatar">{initials}</span><div className="ef-personName"><strong>{[row.prenom,row.nom].filter(Boolean).join(" ")||"Nom non renseigné"}</strong><small>Matricule : {row.matricule||"—"}</small></div><span className={"ef-status "+(active(row.actif)?"on":"off")}>{active(row.actif)?"ACTIF":"INACTIF"}</span></div>
        <div className="ef-personRole"><Users /> {row.fonction||"Fonction non renseignée"}</div>
        <div className="ef-personMeta">
          <div className="ef-metaRow"><span>Département</span><strong>{row.service||"—"}</strong></div>
          <div className="ef-metaRow"><span>Unités</span><div className="ef-unitTags">{active(row.toutes_unites)?<span>Toutes les unités</span>:units.length?units.map(value=><span key={value}>{value}</span>):<span>Non affecté</span>}</div></div>
          <div className="ef-metaRow"><span>Téléphone</span><strong>{row.telephone||"—"}</strong></div>
          <div className="ef-metaRow"><span>Email</span><strong>{row.email||"—"}</strong></div>
        </div>
        {user.role==="admin" && <div className="ef-personFoot"><button onClick={()=>openEdit(row)}><Save /> Modifier</button></div>}
      </article>;
    })}</section>:<div className="ef-empty"><Users /><strong>Aucun collaborateur ne correspond aux filtres.</strong><span>Modifiez les critères ou réinitialisez les filtres.</span></div>}
    {form && <div className="modalBack"><form className="modal" onSubmit={save}>
      <div className="modalHead"><h3>{form.id?"Modifier l'effectif":"Ajouter un technicien"}</h3><button type="button" className="iconButton" onClick={()=>setForm(null)}><X /></button></div>
      <div className="formGrid">
        <label>Matricule *<input required value={form.matricule} onChange={e=>setForm({...form,matricule:e.target.value})}/></label>
        <label>Nom *<input required value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})}/></label>
        <label>Prénom<input value={form.prenom||""} onChange={e=>setForm({...form,prenom:e.target.value})}/></label>
        <label>Département *<select required value={form.service||""} onChange={e=>setForm({...form,service:e.target.value})}><option value="">Sélectionner</option>{context.services.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Fonction *<select required value={form.fonction||""} onChange={e=>setForm({...form,fonction:e.target.value})}><option value="">Sélectionner</option>{context.functions.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Téléphone<input value={form.telephone||""} onChange={e=>setForm({...form,telephone:e.target.value})}/></label>
        <label>Email<input type="email" value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label>Date de recrutement<input type="date" value={form.date_recrutement||""} onChange={e=>setForm({...form,date_recrutement:e.target.value})}/></label>
        <label>Date de départ<input type="date" value={form.date_depart||""} onChange={e=>setForm({...form,date_depart:e.target.value})}/></label>
      </div>
      <fieldset className="unitPicker"><legend>Unités</legend><label><input type="checkbox" checked={Boolean(form.toutes_unites)} onChange={e=>setForm({...form,toutes_unites:e.target.checked})}/> Toutes les unités</label>
        {!form.toutes_unites && <div className="unitGrid">{context.units.map(unite=><label key={unite}><input type="checkbox" checked={form.units.includes(unite)} onChange={()=>toggleUnit(unite)}/> {unite}</label>)}</div>}
      </fieldset>
      <div className="formGrid"><label><input type="checkbox" checked={Boolean(form.actif)} onChange={e=>setForm({...form,actif:e.target.checked})}/> Actif</label><label><input type="checkbox" checked={Boolean(form.is_admin)} onChange={e=>setForm({...form,is_admin:e.target.checked})}/> Administrateur</label></div>
      {error && <div className="formError">{error}</div>}
      <div className="modalActions"><button type="button" onClick={()=>setForm(null)}>Annuler</button><button className="primary" type="submit"><Save /> Enregistrer</button></div>
    </form></div>}
  </div>;
}
function PreventiveMaintenance({ user }) {
  const [rows, setRows] = useState([]);
  const [context, setContext] = useState({ units: [], machines: [], technicians: [], technician: "", frequencies: [] });
  const [query, setQuery] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [serviceDrafts, setServiceDrafts] = useState({});
  const [form, setForm] = useState(null);
  const [realization, setRealization] = useState(null);
  const [error, setError] = useState("");
  const [realizationDraft, setRealizationDraft] = useState({ date_debut: "", date_fin: "", commentaire: "", technicien: "" });

  const load = () => api("/api/modules/pm").then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
    api("/api/pm/context").then(data => {
      setContext(data);
      setRealizationDraft(current => ({ ...current, technicien: data.technician }));
    }).catch(() => setContext({ units: [], machines: [], technicians: [], technician: "", frequencies: [] }));
  }, []);

  const filteredMachines = context.machines.filter(machine => !form?.unite || machine.unite === form.unite);
  const units = [...new Set([...(context.units || []), ...rows.map(r => r.unite)].filter(Boolean))].sort((a,b) => a.localeCompare(b,"fr"));
  const done = r => ["réalisée","realisee","réalisé","realise","done","completed"].includes(String(r.statut || "").trim().toLowerCase());
  const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()) && (!filterUnit || r.unite === filterUnit) && (!filterMonth || String(r.date_prevue || "").slice(0,7) === filterMonth) && (!filterStatus || (filterStatus === "done" ? done(r) : !done(r))));
  const realizedCount = filtered.filter(done).length;
  const plannedCount = filtered.length - realizedCount;
  const completion = filtered.length ? Math.round(realizedCount / filtered.length * 100) : 0;
  const resetFilters = () => {setQuery("");setFilterUnit("");setFilterStatus("");setFilterMonth("");};
  const canPlan = user.role === "admin" || user.role === "superviseur";
  const servicesPM = [...new Set([...(context.services||[]), "Électricité"].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
  const assignService = async row => {
    setError("");
    try {
      await api("/api/pm/"+row.id+"/service",{method:"PUT",body:JSON.stringify({service_intervenant:serviceDrafts[row.id] ?? row.service_intervenant ?? ""})});
      await load();
    } catch(err){setError(err.message);}
  };

  const openForm = () => setForm({
    unite: context.units[0] || "",
    machine_tag: "",
    frequence: context.frequencies[0] || "",
    tolerance_jours: 7,
    date_prevue: "",
    responsable: [user.nom, user.prenom].filter(Boolean).join(" ").trim(),
    service_intervenant: user.role==="admin"?"":(user.service||""),
    commentaire: ""
  });

  const save = async event => {
    event.preventEvent?.();
    event.preventDefault();
    setError("");
    try {
      await api("/api/pm", { method: "POST", body: JSON.stringify(form) });
      setForm(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const openRealization = row => {
    setRealization(row);
    setRealizationDraft({ date_debut: "", date_fin: "", commentaire: "", technicien: context.technician });
  };

  const realize = async event => {
    event.preventEvent?.();
    event.preventDefault();
    setError("");
    try {
      await api(`/api/pm/${realization.id}/realiser`, {
        method: "POST",
        body: JSON.stringify(realizationDraft)
      });
      setRealization(null);
      load();
    } catch (err) { setError(err.message); }
  };

  return <div className="breakdownListMaster operationsMaster">
    <PageTitle title="Maintenance préventive" subtitle={filtered.length + " / " + rows.length + " PM affichée(s)"} />
    {user.role!=="admin" && String(user.service||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()==="electricite" &&
      <div className="pm-electricScope"><Wrench size={16}/> Vue Électricité — seules les PM attribuées à votre service sont visibles.</div>}
    {error && <div className="formError">{error}</div>}
    <section className="bl-kpis">
      <article className="bl-kpi"><div className="bl-kpiTop"><span>TOTAL PM</span><span className="bl-kpiIcon bl-blue"><CalendarClock /></span></div><strong>{filtered.length}</strong><small>Maintenances filtrées</small></article>
      <article className="bl-kpi"><div className="bl-kpiTop"><span>PLANIFIÉES</span><span className="bl-kpiIcon bl-orange"><Clock3 /></span></div><strong>{plannedCount}</strong><small>PM restant à réaliser</small></article>
      <article className="bl-kpi"><div className="bl-kpiTop"><span>RÉALISÉES</span><span className="bl-kpiIcon bl-green"><CheckCircle2 /></span></div><strong>{realizedCount}</strong><small>PM terminées</small></article>
      <article className="bl-kpi"><div className="bl-kpiTop"><span>TAUX DE RÉALISATION</span><span className="bl-kpiIcon bl-violet"><TrendingUp /></span></div><strong>{completion} %</strong><small>{realizedCount} réalisées sur {filtered.length}</small></article>
    </section>
    <section className="bl-filters">
      <div className="bl-search"><Search /><input aria-label="Rechercher une PM" placeholder="Rechercher machine, responsable..." value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="bl-filter"><label>Unité</label><select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}><option value="">Toutes les unités</option>{units.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
      <div className="bl-filter"><label>Statut</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">Tous les statuts</option><option value="planned">Planifiées</option><option value="done">Réalisées</option></select></div>
      <div className="bl-filter"><label>Mois prévu</label><input aria-label="Filtrer par mois prévu" type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} /></div>
      <button className="bl-reset" onClick={resetFilters}><RotateCcw /> Réinitialiser</button>
    </section>
    <div className="bl-count"><span><strong>{filtered.length}</strong> PM sur {rows.length}</span><span>Cartes et liste synchronisées avec les filtres</span></div>
    <div className="operationsActions">{canPlan && <button className="primary" onClick={openForm}><Plus /> Ajouter une PM</button>}</div>
    <div className="tableWrap">
      <table>
        <thead><tr><th>Date prévue</th><th>Unité</th><th>Machine</th><th>Fréquence</th><th>Responsable</th><th>Service intervenant</th><th>Statut</th><th /></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}>
          <td>{row.date_prevue}</td><td>{row.unite}</td>
          <td>{row.machine_tag} — {row.machine_designation || ""}</td><td>{row.frequence}</td>
          <td>{row.responsable || "—"}</td>
          <td>{user.role==="admin" ? <div className="pm-serviceAssign"><select aria-label={"Service de la PM "+row.id} value={serviceDrafts[row.id] ?? row.service_intervenant ?? ""} onChange={e=>setServiceDrafts(old=>({...old,[row.id]:e.target.value}))}><option value="">Non attribuée</option>{[...new Set([...servicesPM,row.service_intervenant].filter(Boolean))].map(s=><option key={s} value={s}>{s}</option>)}</select><button type="button" onClick={()=>assignService(row)} title="Enregistrer le service intervenant">Valider</button></div> : (row.service_intervenant||"—")}</td><td>{row.statut}</td>
          <td className="actions">{row.statut === "Planifiée" &&
            <button className="primary" onClick={() => openRealization(row)}>Réaliser</button>}</td>
        </tr>)}</tbody>
      </table>
      {!filtered.length && <div className="empty">Aucune maintenance préventive</div>}
    </div>
    {form && <div className="modalBack"><form className="modal" onSubmit={save}>
      <div className="modalHead"><h3>Programmer une PM</h3><button type="button" className="iconButton" onClick={() => setForm(null)}><X /></button></div>
      <div className="formGrid">
        <label>Unité<select required value={form.unite} onChange={e => setForm({ ...form, unite: e.target.value, machine_tag: "" })}><option value="">Sélectionner...</option>{context.units.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
        <label>Machine<select required value={form.machine_tag} onChange={e => {
          const machine = filteredMachines.find(item => item.tag === e.target.value);
          setForm(current => ({ ...current, machine_tag: e.target.value, unite: machine?.unite || current.unite }));
        }}><option value="">Sélectionner...</option>{filteredMachines.map(machine => <option key={machine.tag} value={machine.tag}>{machine.tag} — {machine.designation || ""}</option>)}</select></label>
        <label>Date prévue<input required type="date" value={form.date_prevue} onChange={e => setForm({ ...form, date_prevue: e.target.value })} /></label>
        <label>Fréquence<select required value={form.frequence} onChange={e => setForm({ ...form, frequence: e.target.value })}><option value="">Sélectionner...</option>{context.frequencies.map(frequency => <option key={frequency} value={frequency}>{frequency}</option>)}</select></label>
        <label>Tolérance (jours)<input required type="number" min="0" value={form.tolerance_jours} onChange={e => setForm({ ...form, tolerance_jours: Number(e.target.value) })} /></label>
        <label>Responsable<input required value={form.responsable} disabled /></label>
        {user.role==="admin"&&<label>Service intervenant<select value={form.service_intervenant||""} onChange={e=>setForm({...form,service_intervenant:e.target.value})}><option value="">Non attribué</option>{servicesPM.map(s=><option key={s} value={s}>{s}</option>)}</select></label>}
        <label className="fullField">Commentaire<textarea value={form.commentaire} onChange={e => setForm({ ...form, commentaire: e.target.value })} /></label>
      </div>
      <div className="modalActions"><button type="button" onClick={() => setForm(null)}>Annuler</button><button className="primary" type="submit"><Save /> Enregistrer</button></div>
    </form></div>}
    {realization && <div className="modalBack"><form className="modal" onSubmit={realize}>
      <div className="modalHead"><h3>Réaliser la PM — {realization.machine_tag}</h3><button type="button" className="iconButton" onClick={() => setRealization(null)}><X /></button></div>
      <div className="formGrid">
        <label>Unité<input value={realization.unite} disabled /></label>
        <label>Machine<input value={`${realization.machine_tag} — ${realization.machine_designation || ""}`} disabled /></label>
        <label>Technicien{user.role === "admin"
          ? <select required value={realizationDraft.technicien} onChange={e => setRealizationDraft({ ...realizationDraft, technicien: e.target.value })}><option value="">Sélectionner...</option>{context.technicians.map(technician => <option key={technician.id} value={technician.name}>{technician.name}</option>)}</select>
          : <input value={context.technician} disabled />}</label>
        <label>Date début<input required type="datetime-local" value={realizationDraft.date_debut} onChange={e => setRealizationDraft({ ...realizationDraft, date_debut: e.target.value })} /></label>
        <label>Date fin<input required type="datetime-local" value={realizationDraft.date_fin} onChange={e => setRealizationDraft({ ...realizationDraft, date_fin: e.target.value })} /></label>
        <label className="fullField">Commentaire<textarea value={realizationDraft.commentaire} onChange={e => setRealizationDraft({ ...realizationDraft, commentaire: e.target.value })} /></label>
      </div>
      <div className="modalActions"><button type="button" onClick={() => setRealization(null)}>Annuler</button><button className="primary" type="submit"><Save /> Valider la réalisation</button></div>
    </form></div>}
  </div>;
}

function OperatingTime({ user }) {
  const [rows, setRows] = useState([]);
  const [context, setContext] = useState({ units: [], machines: [], operator: "" });
  const [query, setQuery] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterMachine, setFilterMachine] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ unite: "", machine: "", date_jour: "", hours: 0, minutes: 0, commentaire: "" });
  const [error, setError] = useState("");

  const load = () => api("/api/modules/operating").then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
    api("/api/operating/context").then(data => {
      setContext(data);
      setDraft(current => ({ ...current, unite: data.units[0] || "" }));
    }).catch(() => setContext({ units: [], machines: [], operator: "" }));
  }, []);

  const machineUnits = new Map(context.machines.map(m => [m.tag, m.unite]));
  const units = [...new Set([...context.units, ...context.machines.map(m=>m.unite)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
  const machines = [...new Set([...rows.map(r=>r.machine), ...context.machines.map(m=>m.tag)].filter(tag=>tag && (!filterUnit || machineUnits.get(tag)===filterUnit)))].sort((a,b)=>a.localeCompare(b,"fr"));
  const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()) && (!filterUnit || machineUnits.get(r.machine)===filterUnit) && (!filterMachine || r.machine===filterMachine) && (!filterMonth || String(r.date_jour || "").slice(0,7)===filterMonth));
  const running = filtered.reduce((sum,r)=>sum+(Number(r.heures_marche)||0),0);
  const stopped = filtered.reduce((sum,r)=>sum+(Number(r.heures_arret)||0),0);
  const planned = filtered.reduce((sum,r)=>sum+(Number(r.heures_planifiees)||0),0);
  const availability = planned ? Math.round(running / planned * 1000) / 10 : 0;
  const hours = n => n.toLocaleString("fr-FR",{maximumFractionDigits:1})+" h";
  const resetFilters = () => {setQuery("");setFilterUnit("");setFilterMachine("");setFilterMonth("");};
  const unitMachines = context.machines.filter(machine => !draft.unite || machine.unite === draft.unite);
  const save = async event => {
    event.preventEvent?.();
    event.preventDefault();
    setError("");
    try {
      const hours = Number(draft.hours || 0);
      const minutes = Number(draft.minutes || 0);
      await api("/api/operating", {
        method: "POST",
        body: JSON.stringify({
          unite: draft.unite,
          machine: draft.machine,
          date_jour: draft.date_jour,
          heures_marche: hours + minutes / 60,
          commentaire: draft.commentaire,
          saisi_par: context.operator
        })
      });
      setEditing(null);
      setDraft({ unite: context.units[0] || "", machine: "", date_jour: "", hours: 0, minutes: 0, commentaire: "" });
      load();
    } catch (err) { setError(err.message); }
  };

  const openEditor = () => {
    setError("");
    setDraft({ unite: context.units[0] || "", machine: "", date_jour: "", hours: 0, minutes: 0, commentaire: "" });
    setEditing(true);
  };

  return <div className="breakdownListMaster operationsMaster">
    <PageTitle title="Operating Time" subtitle={filtered.length + " / " + rows.length + " saisie(s)"} />
    {error && <div className="formError">{error}</div>}
    <section className="bl-kpis">
      <article className="bl-kpi"><div className="bl-kpiTop"><span>SAISIES</span><span className="bl-kpiIcon bl-blue"><ClipboardList /></span></div><strong>{filtered.length}</strong><small>Enregistrements sélectionnés</small></article>
      <article className="bl-kpi"><div className="bl-kpiTop"><span>HEURES DE MARCHE</span><span className="bl-kpiIcon bl-green"><Gauge /></span></div><strong>{hours(running)}</strong><small>Temps de fonctionnement</small></article>
      <article className="bl-kpi"><div className="bl-kpiTop"><span>HEURES D'ARRÊT</span><span className="bl-kpiIcon bl-orange"><Clock3 /></span></div><strong>{hours(stopped)}</strong><small>Arrêts enregistrés</small></article>
      <article className="bl-kpi"><div className="bl-kpiTop"><span>DISPONIBILITÉ</span><span className="bl-kpiIcon bl-violet"><TrendingUp /></span></div><strong>{availability} %</strong><small>Marche / heures planifiées</small></article>
    </section>
    <section className="bl-filters">
      <div className="bl-search"><Search /><input aria-label="Rechercher une saisie" placeholder="Rechercher machine, commentaire..." value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="bl-filter"><label>Unité</label><select value={filterUnit} onChange={e => {setFilterUnit(e.target.value);setFilterMachine("");}}><option value="">Toutes les unités</option>{units.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
      <div className="bl-filter"><label>Machine</label><select value={filterMachine} onChange={e => setFilterMachine(e.target.value)}><option value="">Toutes les machines</option>{machines.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
      <div className="bl-filter"><label>Mois</label><input aria-label="Filtrer par mois" type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} /></div>
      <button className="bl-reset" onClick={resetFilters}><RotateCcw /> Réinitialiser</button>
    </section>
    <div className="bl-count"><span><strong>{filtered.length}</strong> saisie(s) sur {rows.length}</span><span>Indicateurs calculés sur la sélection</span></div>
    <div className="operationsActions"><button className="primary" onClick={openEditor}><Plus /> Ajouter Operating Time</button></div>
    <div className="tableWrap">
      <table><thead><tr><th>Date</th><th>Machine</th><th>Marche</th><th>Arrêt</th><th>Commentaire</th><th>Saisi par</th><th /></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}><td>{row.date_jour}</td><td>{row.machine}</td><td>{Number(row.heures_marche || 0).toFixed(2)} h</td><td>{Number(row.heures_arret || 0).toFixed(2)} h</td><td>{row.commentaire || "—"}</td><td>{row.saisi_par || "—"}</td><td /></tr>)}</tbody>
      </table>
      {!filtered.length && <div className="empty">Aucune saisie Operating Time</div>}
    </div>
    {editing && <div className="modalBack"><form className="modal" onSubmit={save}>
      <div className="modalHead"><h3>Ajouter Operating Time</h3><button type="button" className="iconButton" onClick={() => setEditing(null)}><X /></button></div>
      <div className="formGrid">
        <label>Unité<select required value={draft.unite} onChange={e => setDraft({ ...draft, unite: e.target.value, machine: "" })}><option value="">Sélectionner...</option>{context.units.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
        <label>Machine<select required value={draft.machine} onChange={e => setDraft({ ...draft, machine: e.target.value })}><option value="">Sélectionner...</option>{unitMachines.map(machine => <option key={machine.tag} value={machine.tag}>{machine.tag} — {machine.designation || ""}</option>)}</select></label>
        <label>Date<input required type="date" value={draft.date_jour} onChange={e => setDraft({ ...draft, date_jour: e.target.value })} /></label>
        <label>Heures<input required type="number" min="0" max="24" value={draft.hours} onChange={e => setDraft({ ...draft, hours: e.target.value })} /></label>
        <label>Minutes<input required type="number" min="0" max="59" value={draft.minutes} onChange={e => setDraft({ ...draft, minutes: e.target.value })} /></label>
        <label>Nom / Saisi par<input value={context.operator} disabled /></label>
        <label className="fullField">Commentaire<textarea value={draft.commentaire} onChange={e => setDraft({ ...draft, commentaire: e.target.value })} /></label>
      </div>
      <div className="modalActions"><button type="button" onClick={() => setEditing(null)}>Annuler</button><button className="primary" type="submit"><Save /> Enregistrer</button></div>
    </form></div>}
  </div>;
}

function App() {
  const { language, setLanguage } = useLanguage();
  const [theme, setTheme] = useState(() => localStorage.getItem("engineering_theme") === "light" ? "light" : "dark");
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("engineering_theme", theme); }, [theme]);
  // Afficher immédiatement l'écran de connexion ou l'application.
  const saved = localStorage.getItem("engineering_user");
  const [user, setUser] = useState(saved ? JSON.parse(saved) : null);
  const [module, setModule] = useState("accueil");
  const [menuOpen, setMenuOpen] = useState(false);
  const [excelRefreshKey,setExcelRefreshKey] = useState(0);
  const login = value => { localStorage.setItem("engineering_user", JSON.stringify(value)); setUser(value); };
  const logout = async () => { try { await api("/api/auth/logout", { method: "POST" }); } catch {} localStorage.removeItem("engineering_token"); localStorage.removeItem("engineering_user"); setUser(null); };
  if (!user) return <Login onLogin={login} language={language} setLanguage={setLanguage} />;
  const allowed = item => item === "parametres" ? user.role === "admin" : true;
  const content = module === "accueil" ? <Dashboard user={user} onNavigate={setModule} /> : module === "stats" ? <Stats /> : module === "machines" ? <MachinePage user={user} /> : module === "saisie" ? <FailureEntry user={user} /> : module === "pm" ? <PreventiveMaintenance user={user} /> : module === "operating" ? <OperatingTime user={user} /> : module === "effectif" ? <Effectif user={user} api={api} /> :
    module === "parametres" ? <AccessSettings user={user} /> : <DataPage key={module} module={module} user={user} />;
  return <div className="appShell">
    <aside id="engineering-sidebar" className={menuOpen ? "sidebar open" : "sidebar"}>
      <div className="brand"><img src="/engineering-logo.svg" alt="" /><span><strong>Engineering</strong><small>GMAO · Maintenance</small></span></div>
      <nav>{modules.filter(([id]) => allowed(id)).map(([id, label, Icon]) => <button key={id} className={`moduleNav module-${id} ${module === id ? "active" : ""}`} onClick={() => { setModule(id); setMenuOpen(false); }}><span className="moduleNavIcon"><Icon /></span><span>{label}</span></button>)}</nav>
      <div className="themePicker" role="group" aria-label="Thème de l’application"><span className="themePickerLabel">APPARENCE</span><div className="themePickerOptions"><button type="button" className={theme === "dark" ? "selected" : ""} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><Moon /> Sombre</button><button type="button" className={theme === "light" ? "selected" : ""} aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Sun /> Clair</button></div></div>
      <div className="userBlock"><div className="avatar">{user.nom?.[0]}{user.prenom?.[0]}</div><div><strong>{user.nom} {user.prenom || ""}</strong><small>{user.role}</small></div><button title="Déconnexion" onClick={logout}><LogOut /></button></div>
    </aside>
    {menuOpen && <button className="backdrop" aria-label="Fermer" onClick={() => setMenuOpen(false)} />}
    <main className="main"><header className="mobileTopbar"><button type="button" className="mobileMenu" aria-label="Ouvrir le menu" aria-expanded={menuOpen} aria-controls="engineering-sidebar" onClick={() => setMenuOpen(true)}><Menu /></button><div className="mobileTopbarBrand"><img src="/engineering-logo.svg" alt="" /><span><strong>Engineering</strong><small>{modules.find(item => item[0] === module)?.[1] || "GMAO"}</small></span></div><LanguageSwitch language={language} setLanguage={setLanguage} className="appLanguage" /></header><div className="mainContent">{user.role === "admin" && <AdminExcelBar module={module} onSuccess={()=>setExcelRefreshKey(x=>x+1)} />}<div key={excelRefreshKey}>{content}</div></div></main>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);

// Enregistrement du Service Worker PWA
registerSW();
