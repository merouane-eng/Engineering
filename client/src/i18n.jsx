import { useEffect, useState } from "react";

const EN = {
  "Accueil":"Home","Machines":"Machines","Effectif":"Staff","Saisie panne":"Report a breakdown","Liste des pannes":"Breakdown list","Maintenance préventive":"Preventive maintenance","Statistiques":"Statistics","Paramètres":"Settings",
  "Gestion de maintenance industrielle":"Industrial maintenance management","Nom d'utilisateur":"Username","Mot de passe":"Password","Se connecter":"Sign in","Déconnexion":"Sign out",
  "Centre de pilotage":"Control center","Indicateurs clés":"Key indicators","Actualiser":"Refresh","Réessayer":"Try again","Bonjour":"Hello","Utilisateur":"User","Voici la situation de votre maintenance aujourd'hui.":"Here is your maintenance overview for today.",
  "CENTRE DE PILOTAGE · ENGINEERING":"ENGINEERING · CONTROL CENTER","VUE GÉNÉRALE":"OVERVIEW","Machines en service":"Machines in service","Techniciens actifs":"Active technicians","Pannes ouvertes":"Open breakdowns","Pannes clôturées":"Closed breakdowns","PM à réaliser":"PM due","PM réalisées":"PM completed","Parc autorisé":"Authorized equipment","Effectif disponible":"Available staff","À traiter":"To be handled","Ce mois-ci":"This month","En retard ou ce mois":"Overdue or due this month",
  "Base de données connectée":"Database connected","Connexion à vérifier":"Connection needs checking","SUIVI OPÉRATIONNEL":"OPERATIONAL MONITORING","Dernières pannes":"Latest breakdowns","Tout voir":"View all","Machine non précisée":"Unspecified machine","Intervention de maintenance":"Maintenance intervention","Aucune panne récente à afficher":"No recent breakdowns to display","Les nouvelles déclarations apparaîtront ici.":"New reports will appear here.",
  "ANTICIPER LES ARRÊTS":"PREVENT DOWNTIME","Planning":"Schedule","Aucune PM à venir":"No upcoming PM","Le planning préventif est à jour.":"The preventive schedule is up to date.","ACCÈS RAPIDE":"QUICK ACCESS","Que souhaitez-vous faire ?":"What would you like to do?","Déclarer une panne":"Report a breakdown","Créer un nouvel ordre de travail":"Create a new work order","Consulter les machines":"Browse machines","Voir le parc et ses équipements":"View equipment and assets","Planifier une PM":"Schedule preventive maintenance","Organiser la maintenance préventive":"Organize preventive maintenance","Voir les statistiques":"View statistics","Analyser les indicateurs maintenance":"Analyze maintenance indicators","Données actualisées à la demande":"Data refreshed on demand",
  "Performance & fiabilité":"Performance & reliability","Analyse opérationnelle":"Operational analysis","Période":"Period","Unité":"Unit","7 jours":"7 days","30 jours":"30 days","90 jours":"90 days","12 mois":"12 months","Tout":"All","Toutes les unités":"All units","Toutes les périodes":"All periods","12 derniers mois":"Last 12 months","Derniers":"Last","Chargement…":"Loading…","Synthèse de performance":"PERFORMANCE SUMMARY","TENDANCE":"TREND","Évolution des pannes":"Breakdown trend","Nombre de WO déclarés par mois · 6 derniers mois":"Work orders reported per month · last 6 months","ÉTAT DES INTERVENTIONS":"WORK ORDER STATUS","Répartition des pannes":"Breakdown distribution","Ouvertes vs clôturées":"Open vs closed","Ouvertes":"Open","Clôturées":"Closed","Taux de clôture":"Closure rate","ANALYSE ÉQUIPEMENT":"EQUIPMENT ANALYSIS","Machines les plus en panne":"Machines with most breakdowns","Top 6 sur la période sélectionnée":"Top 6 for selected period","Aucune panne sur cette sélection.":"No breakdowns for this selection.","Respect du planning PM":"PM schedule compliance","État des interventions préventives":"Preventive maintenance status","PM planifiées":"PM scheduled","Réalisées":"Completed","En retard":"Overdue","Taux de réalisation":"Completion rate","À suivre":"To follow","FIABILITÉ & DISPONIBILITÉ":"RELIABILITY & AVAILABILITY","Lecture des indicateurs":"Understanding the indicators",
  "Rechercher...":"Search...","Ajouter":"Add","Modifier":"Edit","Supprimer":"Delete","Enregistrer":"Save","Annuler":"Cancel","Fermer":"Close","Oui":"Yes","Non":"No","Actif":"Active","Inactif":"Inactive","Statut":"Status","Date":"Date","Machine":"Machine","Désignation":"Description","Tag":"Tag","Groupe":"Group","Zone":"Area","Marque":"Brand","Modèle":"Model","Matricule":"Employee ID","Nom":"Last name","Prénom":"First name","Service":"Department","Fonction":"Job title","Téléphone":"Phone","Email":"Email","Commentaire":"Comment","Commentaires":"Comments","Responsable":"Responsible person","Technicien":"Technician","Techniciens":"Technicians","Fréquence":"Frequency","Date prévue":"Scheduled date","Date panne":"Breakdown date","Problème":"Problem","Pièces consommées":"Parts used","WO":"WO","Marche":"Running","Arrêt":"Stopped","Heures":"Hours","Minutes":"Minutes","Saisi par":"Entered by","Toutes les unités":"All units","Unités":"Units","Toutes les unités":"All units","Administrateur":"Administrator",
  "Ajouter une PM":"Add preventive maintenance","Réaliser":"Complete","Programmer une PM":"Schedule preventive maintenance","Réaliser la PM":"Complete preventive maintenance","Date début":"Start date","Date fin":"End date","Tolérance (jours)":"Tolerance (days)","Sélectionner":"Select","Sélectionner...":"Select...","Sélectionner…":"Select…","Aucune maintenance préventive":"No preventive maintenance","Aucune saisie Operating Time":"No Operating Time entries","Ajouter Operating Time":"Add Operating Time","Saisie panne":"Breakdown report","Modifier l'effectif":"Edit staff member","Ajouter un technicien":"Add a technician","Date de recrutement":"Hire date","Date de départ":"Departure date","Toutes les unités":"All units","Valider la réalisation":"Confirm completion",
  "Impossible de charger les statistiques. Vérifiez la connexion puis réessayez.":"Unable to load statistics. Check your connection and try again.","Certaines données ne sont pas accessibles. Les indicateurs concernés peuvent être incomplets.":"Some data is unavailable. Related indicators may be incomplete.","Chargement impossible":"Unable to load","Erreur serveur":"Server error",
"Aucun résultat":"No results","Déclaration d'une intervention":"Intervention report","Panne enregistrée avec succès.":"Breakdown saved successfully.","Impossible de charger les unités autorisées":"Unable to load authorized units",
  "Identification":"Identification","N° WO":"WO No.","Date et heure de la panne":"Breakdown date and time","Zone":"Area","Zone de la machine ou saisir une zone":"Machine area or enter an area","Description":"Description","Intervention":"Intervention","Début":"Start","Fin":"End","Downtime (minutes)":"Downtime (minutes)","Pièces de rechange":"Spare parts","Ajouter une pièce de rechange":"Add a spare part","Pièce référencielle":"Reference part","Saisir ou choisir une pièce...":"Enter or select a part...","Quantité":"Quantity","Référence":"Reference","Référentiel de cette machine":"Machine parts reference","Sans référence":"No reference","Aucune pièce référentielle associée à cette machine pour le moment.":"No reference parts are linked to this machine yet.","Associer cette pièce au référentiel de la machine":"Link this part to the machine reference","Utiliser":"Use","Retirer":"Remove","Historique des pièces utilisées":"Used parts history","Sélectionnez une machine pour afficher son historique.":"Select a machine to view its history.","Aucun historique de pièce pour cette machine.":"No parts history for this machine.","Enregistrer la panne":"Save breakdown","Nouvelle pièce de rechange":"New spare part","Ajouter la pièce":"Add part","Nom":"Name","Matricule, nom, service et fonction sont obligatoires.":"Employee ID, last name, department and job title are required.",
  "Nouvel élément":"New item","Paramètres & accès":"Settings & access","Gestion des rôles et comptes":"Manage roles and accounts","Utilisateur":"Username","Rôle":"Role","Mot de passe":"Password","Nouveau mot de passe (4 caractères minimum)":"New password (at least 4 characters)","Mot de passe mis à jour.":"Password updated.","Technicien":"Technician","Superviseur":"Supervisor","Administrateur":"Administrator",
  "saisie(s)":"entry/entries","PM programmée(s)":"scheduled PM","Ajouter une PM":"Add PM","Date prévue":"Scheduled date","Tolérance (jours)":"Tolerance (days)","Responsable":"Responsible","Planifiée":"Scheduled","Aucune saisie Operating Time":"No Operating Time entries","Heures planifiées":"Planned hours","Heures marche":"Running hours","Heures arrêt":"Downtime hours","Operating Time enregistré":"Operating Time recorded","Temps d’arrêt panne":"Breakdown downtime","Disponibilité":"Availability","Total des pannes":"Total breakdowns","Pannes ouvertes":"Open breakdowns","Pannes clôturées":"Closed breakdowns","PM en retard":"Overdue PM",
  "Modifier l'effectif":"Edit staff","Ajouter un technicien":"Add technician","Date de recrutement":"Hire date","Date de départ":"Departure date","Saisi par":"Entered by","Nom / Saisi par":"Name / Entered by","Sélectionner une machine pour afficher son historique.":"Select a machine to view its history."
};

const ATTRS = ["placeholder", "title", "aria-label"];
const normalize = value => value.replace(/\\s+/g, " ").trim();

function translateDOM(root, language) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const original = node.nodeValue || "";
    const key = normalize(original);
    if (!key) return;
    const translated = EN[key];
    if (language === "en" && translated && key !== translated) {
      node.nodeValue = original.replace(key, translated);
    } else if (language === "fr") {
      const french = Object.keys(EN).find(source => EN[source] === key);
      if (french) node.nodeValue = original.replace(key, french);
    }
  });
  root.querySelectorAll("*").forEach(element => ATTRS.forEach(attribute => {
    const value = element.getAttribute(attribute);
    if (!value) return;
    const key = normalize(value);
    if (language === "en") {
      const translated = EN[key];
      // Avoid generating another mutation when the attribute is already translated.
      if (translated && value !== translated) element.setAttribute(attribute, translated);
    } else {
      const french = Object.keys(EN).find(source => EN[source] === key);
      // Avoid MutationObserver feedback loops from writing an unchanged value.
      if (french && value !== french) element.setAttribute(attribute, french);
    }
  }));
}

export function useLanguage() {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem("engineering_language");
    return saved === "en" ? "en" : "fr";
  });
  useEffect(() => {
    localStorage.setItem("engineering_language", language);
    document.documentElement.lang = language;
    document.title = language === "en" ? "Engineering · Maintenance management" : "Engineering · Gestion de maintenance";
    const root = document.getElementById("root");
    if (!root) return;
    let scheduled = false;
    const apply = () => {
      scheduled = false;
      translateDOM(root, language);
    };
    apply();
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(apply);
    });
    observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ATTRS });
    return () => observer.disconnect();
  }, [language]);
  return { language, setLanguage };
}

export function LanguageSwitch({ language, setLanguage, className = "" }) {
  return <div className={`languageSwitch ${className}`} role="group" aria-label="Language">
    <button type="button" className={language === "fr" ? "selected" : ""} aria-pressed={language === "fr"} onClick={() => setLanguage("fr")}>🇫🇷 FR</button>
    <button type="button" className={language === "en" ? "selected" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>🇬🇧 EN</button>
  </div>;
}
