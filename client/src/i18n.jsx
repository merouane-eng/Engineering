import { useEffect, useState } from "react";
import { EXTRA_EN } from "./i18nExtra.js";

const EN = {
  "Accueil":"Home",
  "Machines":"Machines",
  "Effectif":"Staff",
  "Liste des pannes":"Breakdown list",
  "Maintenance préventive":"Preventive maintenance",
  "Statistiques":"Statistics",
  "Paramètres":"Settings",
  "Gestion de maintenance industrielle":"Industrial maintenance management",
  "Nom d'utilisateur":"Username",
  "Se connecter":"Sign in",
  "Déconnexion":"Sign out",
  "Centre de pilotage":"Control center",
  "Indicateurs clés":"Key indicators",
  "Actualiser":"Refresh",
  "Réessayer":"Try again",
  "Bonjour":"Hello",
  "Voici la situation de votre maintenance aujourd'hui.":"Here is your maintenance overview for today.",
  "CENTRE DE PILOTAGE · ENGINEERING":"ENGINEERING · CONTROL CENTER",
  "VUE GÉNÉRALE":"OVERVIEW",
  "Machines en service":"Machines in service",
  "Techniciens actifs":"Active technicians",
  "PM à réaliser":"PM due",
  "PM réalisées":"PM completed",
  "Parc autorisé":"Authorized equipment",
  "Effectif disponible":"Available staff",
  "À traiter":"To be handled",
  "Ce mois-ci":"This month",
  "En retard ou ce mois":"Overdue or due this month",
  "Base de données connectée":"Database connected",
  "Connexion à vérifier":"Connection needs checking",
  "SUIVI OPÉRATIONNEL":"OPERATIONAL MONITORING",
  "Dernières pannes":"Latest breakdowns",
  "Tout voir":"View all",
  "Machine non précisée":"Unspecified machine",
  "Intervention de maintenance":"Maintenance intervention",
  "Aucune panne récente à afficher":"No recent breakdowns to display",
  "Les nouvelles déclarations apparaîtront ici.":"New reports will appear here.",
  "ANTICIPER LES ARRÊTS":"PREVENT DOWNTIME",
  "Planning":"Schedule",
  "Aucune PM à venir":"No upcoming PM",
  "Le planning préventif est à jour.":"The preventive schedule is up to date.",
  "ACCÈS RAPIDE":"QUICK ACCESS",
  "Que souhaitez-vous faire ?":"What would you like to do?",
  "Déclarer une panne":"Report a breakdown",
  "Créer un nouvel ordre de travail":"Create a new work order",
  "Consulter les machines":"Browse machines",
  "Voir le parc et ses équipements":"View equipment and assets",
  "Planifier une PM":"Schedule preventive maintenance",
  "Organiser la maintenance préventive":"Organize preventive maintenance",
  "Voir les statistiques":"View statistics",
  "Analyser les indicateurs maintenance":"Analyze maintenance indicators",
  "Données actualisées à la demande":"Data refreshed on demand",
  "Performance & fiabilité":"Performance & reliability",
  "Analyse opérationnelle":"Operational analysis",
  "Période":"Period",
  "Unité":"Unit",
  "7 jours":"7 days",
  "30 jours":"30 days",
  "90 jours":"90 days",
  "12 mois":"12 months",
  "Tout":"All",
  "Toutes les périodes":"All periods",
  "12 derniers mois":"Last 12 months",
  "Derniers":"Last",
  "Chargement…":"Loading…",
  "Synthèse de performance":"PERFORMANCE SUMMARY",
  "TENDANCE":"TREND",
  "Évolution des pannes":"Breakdown trend",
  "Nombre de WO déclarés par mois · 6 derniers mois":"Work orders reported per month · last 6 months",
  "ÉTAT DES INTERVENTIONS":"WORK ORDER STATUS",
  "Répartition des pannes":"Breakdown distribution",
  "Ouvertes vs clôturées":"Open vs closed",
  "Ouvertes":"Open",
  "Clôturées":"Closed",
  "Taux de clôture":"Closure rate",
  "ANALYSE ÉQUIPEMENT":"EQUIPMENT ANALYSIS",
  "Machines les plus en panne":"Machines with most breakdowns",
  "Top 6 sur la période sélectionnée":"Top 6 for selected period",
  "Aucune panne sur cette sélection.":"No breakdowns for this selection.",
  "Respect du planning PM":"PM schedule compliance",
  "État des interventions préventives":"Preventive maintenance status",
  "PM planifiées":"PM scheduled",
  "Réalisées":"Completed",
  "En retard":"Overdue",
  "Taux de réalisation":"Completion rate",
  "À suivre":"To follow",
  "FIABILITÉ & DISPONIBILITÉ":"RELIABILITY & AVAILABILITY",
  "Lecture des indicateurs":"Understanding the indicators",
  "Rechercher...":"Search...",
  "Ajouter":"Add",
  "Modifier":"Edit",
  "Supprimer":"Delete",
  "Enregistrer":"Save",
  "Annuler":"Cancel",
  "Fermer":"Close",
  "Oui":"Yes",
  "Non":"No",
  "Actif":"Active",
  "Inactif":"Inactive",
  "Statut":"Status",
  "Date":"Date",
  "Machine":"Machine",
  "Désignation":"Description",
  "Tag":"Tag",
  "Groupe":"Group",
  "Marque":"Brand",
  "Modèle":"Model",
  "Matricule":"Employee ID",
  "Prénom":"First name",
  "Service":"Department",
  "Fonction":"Job title",
  "Téléphone":"Phone",
  "Email":"Email",
  "Commentaire":"Comment",
  "Commentaires":"Comments",
  "Techniciens":"Technicians",
  "Fréquence":"Frequency",
  "Date panne":"Breakdown date",
  "Problème":"Problem",
  "Pièces consommées":"Parts used",
  "WO":"WO",
  "Marche":"Running",
  "Arrêt":"Stopped",
  "Heures":"Hours",
  "Minutes":"Minutes",
  "Unités":"Units",
  "Réaliser":"Complete",
  "Programmer une PM":"Schedule preventive maintenance",
  "Réaliser la PM":"Complete preventive maintenance",
  "Date début":"Start date",
  "Date fin":"End date",
  "Sélectionner":"Select",
  "Sélectionner...":"Select...",
  "Sélectionner…":"Select…",
  "Aucune maintenance préventive":"No preventive maintenance",
  "Ajouter Operating Time":"Add Operating Time",
  "Saisie panne":"Breakdown report",
  "Toutes les unités":"All units",
  "Valider la réalisation":"Confirm completion",
  "Impossible de charger les statistiques. Vérifiez la connexion puis réessayez.":"Unable to load statistics. Check your connection and try again.",
  "Certaines données ne sont pas accessibles. Les indicateurs concernés peuvent être incomplets.":"Some data is unavailable. Related indicators may be incomplete.",
  "Chargement impossible":"Unable to load",
  "Erreur serveur":"Server error",
  "Aucun résultat":"No results",
  "Déclaration d'une intervention":"Intervention report",
  "Panne enregistrée avec succès.":"Breakdown saved successfully.",
  "Impossible de charger les unités autorisées":"Unable to load authorized units",
  "Identification":"Identification",
  "N° WO":"WO No.",
  "Date et heure de la panne":"Breakdown date and time",
  "Zone":"Area",
  "Zone de la machine ou saisir une zone":"Machine area or enter an area",
  "Description":"Description",
  "Intervention":"Intervention",
  "Début":"Start",
  "Fin":"End",
  "Downtime (minutes)":"Downtime (minutes)",
  "Pièces de rechange":"Spare parts",
  "Ajouter une pièce de rechange":"Add a spare part",
  "Pièce référencielle":"Reference part",
  "Saisir ou choisir une pièce...":"Enter or select a part...",
  "Quantité":"Quantity",
  "Référence":"Reference",
  "Référentiel de cette machine":"Machine parts reference",
  "Sans référence":"No reference",
  "Aucune pièce référentielle associée à cette machine pour le moment.":"No reference parts are linked to this machine yet.",
  "Associer cette pièce au référentiel de la machine":"Link this part to the machine reference",
  "Utiliser":"Use",
  "Retirer":"Remove",
  "Historique des pièces utilisées":"Used parts history",
  "Sélectionnez une machine pour afficher son historique.":"Select a machine to view its history.",
  "Aucun historique de pièce pour cette machine.":"No parts history for this machine.",
  "Enregistrer la panne":"Save breakdown",
  "Nouvelle pièce de rechange":"New spare part",
  "Ajouter la pièce":"Add part",
  "Nom":"Name",
  "Matricule, nom, service et fonction sont obligatoires.":"Employee ID, last name, department and job title are required.",
  "Nouvel élément":"New item",
  "Paramètres & accès":"Settings & access",
  "Gestion des rôles et comptes":"Manage roles and accounts",
  "Utilisateur":"Username",
  "Rôle":"Role",
  "Mot de passe":"Password",
  "Nouveau mot de passe (4 caractères minimum)":"New password (at least 4 characters)",
  "Mot de passe mis à jour.":"Password updated.",
  "Technicien":"Technician",
  "Superviseur":"Supervisor",
  "Administrateur":"Administrator",
  "saisie(s)":"entry/entries",
  "PM programmée(s)":"scheduled PM",
  "Ajouter une PM":"Add PM",
  "Date prévue":"Scheduled date",
  "Tolérance (jours)":"Tolerance (days)",
  "Responsable":"Responsible",
  "Planifiée":"Scheduled",
  "Aucune saisie Operating Time":"No Operating Time entries",
  "Heures planifiées":"Planned hours",
  "Heures marche":"Running hours",
  "Heures arrêt":"Downtime hours",
  "Operating Time enregistré":"Operating Time recorded",
  "Temps d’arrêt panne":"Breakdown downtime",
  "Disponibilité":"Availability",
  "Total des pannes":"Total breakdowns",
  "Pannes ouvertes":"Open breakdowns",
  "Pannes clôturées":"Closed breakdowns",
  "PM en retard":"Overdue PM",
  "Modifier l'effectif":"Edit staff",
  "Ajouter un technicien":"Add technician",
  "Date de recrutement":"Hire date",
  "Date de départ":"Departure date",
  "Saisi par":"Entered by",
  "Nom / Saisi par":"Name / Entered by",
  "Sélectionner une machine pour afficher son historique.":"Select a machine to view its history."
};

// All current UI strings and newer modules. Stored business values are unchanged.
const TRANSLATIONS={...EN,...EXTRA_EN};
const REVERSE=Object.entries(TRANSLATIONS).reduce((map,[source,destination])=>{
  if(!map.has(destination))map.set(destination,source);
  return map;
},new Map());
const ATTRS=["placeholder","title","aria-label","aria-description","alt"];
const normalize=value=>String(value||"").replace(/\s+/g," ").trim();
const patterns=[
  [/^(\d+)\s*\/\s*(\d+)\s+PM affichée\(s\)$/i,(a,b)=>a+" / "+b+" PM displayed"],
  [/^(\d+)\s*\/\s*(\d+)\s+collaborateur\(s\) affiché\(s\)$/i,(a,b)=>a+" / "+b+" employees displayed"],
  [/^(\d+)\s*\/\s*(\d+)\s+panne\(s\) affichée\(s\)$/i,(a,b)=>a+" / "+b+" breakdowns displayed"],
  [/^(\d+)\s+collaborateur\(s\)$/i,n=>n+" employee(s)"],
  [/^(\d+)\s+intervention\(s\)$/i,n=>n+" intervention(s)"],
  [/^(\d+)\s+erreur\(s\)/i,n=>n+" error(s)"],
  [/^(\d+)\s+ligne\(s\)/i,n=>n+" row(s)"],
  [/^Derniers\s+(\d+)\s+jours$/i,n=>"Last "+n+" days"],
  [/^(\d+)\s+derniers mois$/i,n=>"Last "+n+" months"],
  [/^Mois\s+(\d{4}-\d{2})$/i,n=>"Month "+n],
  [/^Unités?\s*:\s*(.+)$/i,v=>"Unit(s): "+v],
  [/^Machine\s*:\s*(.+)$/i,v=>"Machine: "+v],
  [/^Site\s*:\s*(.+)$/i,v=>"Site: "+v],
  [/^(\d+)\s+équipements? dans le périmètre$/i,n=>n+" assets in scope"],
  [/^Taux\s*:\s*(.+)$/i,v=>"Rate: "+v]
];
const reversePatterns=[
  [/^(\d+)\s*\/\s*(\d+)\s+PM displayed$/i,(a,b)=>a+" / "+b+" PM affichée(s)"],
  [/^(\d+)\s*\/\s*(\d+)\s+employees displayed$/i,(a,b)=>a+" / "+b+" collaborateur(s) affiché(s)"],
  [/^(\d+)\s*\/\s*(\d+)\s+breakdowns displayed$/i,(a,b)=>a+" / "+b+" panne(s) affichée(s)"],
  [/^(\d+)\s+employee\(s\)$/i,n=>n+" collaborateur(s)"],
  [/^(\d+)\s+intervention\(s\)$/i,n=>n+" intervention(s)"],
  [/^(\d+)\s+error\(s\)$/i,n=>n+" erreur(s)"],
  [/^(\d+)\s+row\(s\)$/i,n=>n+" ligne(s)"],
  [/^Last\s+(\d+)\s+days$/i,n=>"Derniers "+n+" jours"],
  [/^Last\s+(\d+)\s+months$/i,n=>n+" derniers mois"],
  [/^Month\s+(\d{4}-\d{2})$/i,n=>"Mois "+n],
  [/^Unit\(s\):\s*(.+)$/i,v=>"Unités : "+v],
  [/^Machine:\s*(.+)$/i,v=>"Machine : "+v],
  [/^Site:\s*(.+)$/i,v=>"Site : "+v],
  [/^(\d+)\s+assets in scope$/i,n=>n+" équipements dans le périmètre"],
  [/^Rate:\s*(.+)$/i,v=>"Taux : "+v]
];
function translateValue(value,language){
  const key=normalize(value);
  if(!key)return value;
  const mapped=language==="en"?TRANSLATIONS[key]:REVERSE.get(key);
  if(mapped&&mapped!==key)return String(value).replace(key,mapped);
  for(const [regex,fn] of (language==="en"?patterns:reversePatterns)){
    const match=key.match(regex);
    if(match)return String(value).replace(key,fn(...match.slice(1)));
  }
  return value;
}
function translateDOM(root,language){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      const parent=node.parentElement;
      if(!parent||parent.closest("script,style,textarea,[contenteditable='true'],[data-i18n-skip]"))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    const next=translateValue(node.nodeValue||"",language);
    if(next!==node.nodeValue)node.nodeValue=next;
  }
  root.querySelectorAll("*").forEach(element=>{
    if(element.closest("[data-i18n-skip]"))return;
    for(const attr of ATTRS){
      const original=element.getAttribute(attr);
      if(!original)continue;
      const translated=translateValue(original,language);
      if(translated!==original)element.setAttribute(attr,translated);
    }
  });
}
export function useLanguage(){
  const [language,setLanguage]=useState(()=>{
    try{return localStorage.getItem("engineering_language")==="en"?"en":"fr";}catch{return "fr";}
  });
  useEffect(()=>{
    try{localStorage.setItem("engineering_language",language);}catch{}
    document.documentElement.lang=language;
    document.title=language==="en"?"Engineering · Maintenance management":"Engineering · Gestion de maintenance";
    const root=document.getElementById("root");
    if(!root)return;
    let queued=false;
    const config={childList:true,characterData:true,attributes:true,attributeFilter:ATTRS,subtree:true};
    const observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      queueMicrotask(()=>{
        queued=false;
        observer.disconnect();
        translateDOM(root,language);
        observer.observe(root,config);
      });
    });
    translateDOM(root,language);
    observer.observe(root,config);
    return ()=>observer.disconnect();
  },[language]);
  return {language,setLanguage};
}

export function LanguageSwitch({ language, setLanguage, className = "" }) {
  return <div className={`languageSwitch ${className}`} role="group" aria-label="Language">
    <button type="button" className={language === "fr" ? "selected" : ""} aria-pressed={language === "fr"} onClick={() => setLanguage("fr")}>🇫🇷 FR</button>
    <button type="button" className={language === "en" ? "selected" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>🇬🇧 EN</button>
  </div>;
}
