/* Import/export Excel administrateur pour Engineering PC/mobile.
   Aucun remplacement silencieux des données existantes. */
import crypto from "node:crypto";
import { readXlsx, makeXlsx } from "./excel.js";
import {localisationSite,SITES} from "../client/src/locationModel.js";

export const EXCEL_MODULES = {
  machines: {
    title:"Machines",table:"machines",key:["tag"],
    fields:["tag","designation","site","unite","zone","marque","modele","numero_serie","date_mise_service","actif","commentaire"],
    required:["tag","designation","unite"],
    help:["Une machine existante (même tag) est ignorée.","Site 01 ou Site 02. Actif : Oui ou Non.","Localisations Microbiologie et QC : code interne distinct par site (ex : QC__S02)."]
  },
  effectif:{
    title:"Effectif",table:"effectif",key:["matricule"],
    fields:["matricule","nom","prenom","initiale","service","fonction","telephone","email","date_recrutement","date_depart","unites","toutes_unites","site","type_contrat","date_debut_contrat","date_fin_contrat","commentaire_depart","actif"],
    required:["matricule"],
    help:["Matricule existant : seuls site, initiale et contrat peuvent être complétés ; aucun rôle, nom ou compte n'est remplacé.",
      "Nouveau salarié : nom, prénom, service et fonction obligatoires ; compte désactivé pour la connexion jusqu'à configuration par l'administrateur.",
      "CDI sans date de fin ; CDD avec date de fin obligatoire ; Apprentissage et Autre autorisés avec une fin facultative.","Initiale facultative ; les cellules vides ne suppriment pas les valeurs existantes.",
      "Localisations séparées par ; (exemple U3-1;QC__S02). Site calculé selon les localisations."]
  },
  pannes:{
    title:"Pannes / Work Orders",table:"pannes",key:["wo"],
    fields:["wo","date_panne","heure_panne","date_debut","date_fin","site","unite","machine","area","service","probleme","technicien","downtime","statut","commentaire","pieces_consommees"],
    required:["wo","date_panne","unite","machine","probleme"],
    help:["Le numéro WO identifie les doublons.","Les dates et les heures d'intervention restent dans les colonnes dédiées.",
      "Durée d'arrêt (downtime) en minutes.","Les pièces consommées sont conservées sous forme de texte."]
  },
  pm:{
    title:"Maintenance préventive",table:"pm_programmees",key:["machine_tag","date_prevue"],
    fields:["machine_tag","machine_designation","site","unite","frequence","tolerance_jours","date_prevue","statut","responsable","service_intervenant","commentaire","motif_report"],
    required:["machine_tag","unite","frequence","date_prevue"],
    help:["Une PM existante (machine + date prévue) est ignorée.","Les PM réalisées ne sont jamais modifiées.",
      "Service intervenant : Électricité, Mécanique, etc. Si vide, la PM reste non attribuée."]
  },
  operating:{
    title:"Operating Time",table:"operating_time",key:["machine","date_jour"],
    fields:["machine","date_jour","heures_planifiees","heures_marche","heures_arret","commentaire","saisi_par"],
    required:["machine","date_jour","heures_marche"],
    help:["Un relevé déjà existant (machine + jour) est ignoré.","Heures planifiées, de marche et d'arrêt exprimées en heures.",
      "Le total ne peut pas dépasser 24 h par jour."]
  }
};
const MAX_ROWS=1000;
const FORBIDDEN=new Set(["id","uuid","role","username","password","password_hash","created_at","updated_at","date_creation","date_modification"]);
const coerce = value => String(value??"").trim();
const cleanHeader = value => String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
  .replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const aliases = {
  type_de_contrat:"type_contrat",date_de_debut_de_contrat:"date_debut_contrat",date_debut_de_contrat:"date_debut_contrat",date_de_fin_de_contrat:"date_fin_contrat",date_fin_contrat:"date_fin_contrat",motif_de_sortie:"commentaire_depart",commentaire_de_depart:"commentaire_depart",
  fin_de_contrat:"date_fin_contrat",unite_s:"unites",unit_s:"unites",
  localisation:"unite",localisations:"unites",location:"unite",
  date_de_panne:"date_panne",date_d_intervention:"date_debut",numero_wo:"wo",
  work_order:"wo",initiales:"initiale",initials:"initiale",
  heures_de_marche:"heures_marche",
  machine_tag:"machine_tag",site_01_ou_02:"site"
};
const num = value => {
  if(value===""||value==null)return null;
  const n=Number(String(value).replace(",","."));
  return Number.isFinite(n)?n:null;
};
const bool = (value,def=false) => {
  const x=coerce(value).toLowerCase();
  if(!x)return def;
  if(["oui","yes","1","true","vrai","actif"].includes(x))return true;
  if(["non","no","0","false","faux","inactif"].includes(x))return false;
  throw new Error("booléen invalide : utiliser Oui ou Non");
};
function dateValue(value) {
  if(value===null||value===undefined||value==="")return null;
  const str=coerce(value);
  if(typeof value==="number" || /^\d{5}$/.test(str)) {
    const day=new Date(Date.UTC(1899,11,30)+Number(value)*86400000);
    if(Number.isNaN(day.getTime()))throw new Error("Date Excel invalide.");
    return day.toISOString().slice(0,10);
  }
  let result=str.match(/^(\d{4}-\d{2}-\d{2})/);
  if(!result){
    const fr=str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if(fr)result=[str,fr[3]+"-"+fr[2]+"-"+fr[1]];
  }
  if(!result) throw new Error("Date invalide : AAAA-MM-JJ attendu.");
  const date=result[1],d=new Date(date+"T12:00:00Z");
  if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==date)throw new Error("Date calendrier invalide.");
  return date;
}
const dateFields = new Set(["date_mise_service","date_recrutement","date_depart","date_debut_contrat","date_fin_contrat","date_panne","date_jour","date_prevue"]);
function normalizeRow(row,fields){
  const payload={};
  for(const field of fields){
    const value=row[field];
    if(value===undefined||value===null||value==="")continue;
    payload[field]=dateFields.has(field)?dateValue(value):typeof value==="string"?value.trim():value;
  }
  return payload;
}
const monthNames=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const siteForUnit = localisationSite;
const siteBoth="Site 01; Site 02";
function normalizeSite(value){
  const s=coerce(value);
  if(!s)return null;
  if(s===siteBoth||s==="Site 01"||s==="Site 02")return s;
  throw new Error("Site invalide (Site 01, Site 02 ou Site 01; Site 02).");
}
function contract(type,start,end,recruitment,existing=null){
  const t=coerce(type||existing?.type_contrat).toUpperCase()||null;
  const began=start?dateValue(start):existing?.date_debut_contrat||null;
  let finished=end?dateValue(end):existing?.date_fin_contrat||null;
  if(t&&!["CDI","CDD","APPRENTISSAGE","AUTRE"].includes(t))throw new Error("Type de contrat invalide.");
  if(t==="CDD"&&!finished)throw new Error("Date de fin obligatoire pour CDD.");
  if(t==="CDI"&&finished)throw new Error("Un CDI ne peut pas avoir de date de fin.");
  if(began&&finished&&finished<began)throw new Error("Fin du contrat antérieure à son début.");
  if(finished&&recruitment&&finished<dateValue(recruitment))throw new Error("Fin du contrat antérieure au recrutement.");
  return {type_contrat:t,date_debut_contrat:began,date_fin_contrat:finished};
}
function normalizeForSave(module,row,context,existing){
  const now=new Date().toISOString();
  const common={uuid:crypto.randomUUID(),date_creation:now.replace("T"," ").slice(0,19),source:"web-import"};
  if(module==="machines"){
    const site=coerce(row.site)||localisationSite(row.unite);
    if(!SITES.includes(site)||site!==localisationSite(row.unite))
      throw new Error("Site incohérent avec la localisation.");
    const data=Object.fromEntries(Object.entries(row).filter(([k])=>EXCEL_MODULES.machines.fields.includes(k)));
    return {...common,...data,site,actif:bool(row.actif,true)?1:0};
  }
  if(module==="effectif"){
    const unitCodes=coerce(row.unites).split(/[;,]/).map(s=>s.trim()).filter(Boolean);
    const all=bool(row.toutes_unites,false);
    const siteDerived=all?siteBoth:[...new Set(unitCodes.map(siteForUnit))].sort().join("; ");
    const s=normalizeSite(row.site);
    if(siteDerived&&s&&s!==siteDerived)throw new Error("Site incohérent avec les localisations affectées.");
    const desiredSite=siteDerived||s||null;
    const contractData=contract(row.type_contrat,row.date_debut_contrat,row.date_fin_contrat,row.date_recrutement,existing);
    if(existing) {
      const changed={};
      if(coerce(row.initiale))changed.initiale=coerce(row.initiale);
      if(row.site||unitCodes.length||all)changed.site=desiredSite;
      if(row.type_contrat||row.date_debut_contrat||row.date_fin_contrat)Object.assign(changed,contractData);
      if(coerce(row.commentaire_depart)&&coerce(row.commentaire_depart)!=="/")changed.commentaire_depart=coerce(row.commentaire_depart).slice(0,2000);
      return {update:changed,units:[]};
    }
    for(const f of ["nom","prenom","service","fonction"])if(!coerce(row[f]))throw new Error(f+" obligatoire pour un nouveau collaborateur.");
    // Ne pas fabriquer des identifiants ou secrets de connexion pendant un import Excel.
    return {insert:{matricule:coerce(row.matricule),nom:coerce(row.nom),prenom:coerce(row.prenom),
      initiale:coerce(row.initiale)||null,service:coerce(row.service),fonction:coerce(row.fonction),
      telephone:coerce(row.telephone)||null,email:coerce(row.email)||null,
      date_recrutement:row.date_recrutement||null,date_depart:row.date_depart||null,
      role:"technicien",actif:false,commentaire_depart:coerce(row.commentaire_depart)&&coerce(row.commentaire_depart)!=="/"?coerce(row.commentaire_depart).slice(0,2000):null,
      toutes_unites:all,site:desiredSite, ...contractData},
      units:unitCodes};
  }
  if(module==="pannes"){
    if(coerce(row.site)&&coerce(row.site)!==localisationSite(row.unite))throw new Error("Site incompatible avec la localisation.");
    const machine=context.machines.get(coerce(row.machine));
    if(machine&&machine.unite!==coerce(row.unite))throw new Error("Machine affectée à une autre localisation.");
    if(!machine&&!["SG01","SG02"].includes(coerce(row.unite)))
      throw new Error("Machine inconnue : importer le parc Machines d'abord.");
    const downtime=num(row.downtime??0);
    if(downtime===null||downtime<0||downtime>1440)throw new Error("Downtime invalide (minutes, 0 à 1440).");
    return {...common,wo:coerce(row.wo),date_panne:dateValue(row.date_panne),heure_panne:coerce(row.heure_panne)||null,
      date_debut:coerce(row.date_debut)||null,date_fin:coerce(row.date_fin)||null,
      unite:coerce(row.unite),machine:coerce(row.machine),area:coerce(row.area)||machine?.zone||null,
      service:coerce(row.service)||null,probleme:coerce(row.probleme),technicien:coerce(row.technicien)||null,
      downtime,statut:coerce(row.statut)||"Open",commentaire:coerce(row.commentaire)||null,
      pieces_consommees:coerce(row.pieces_consommees)||null,
      mois:monthNames[Number(dateValue(row.date_panne).slice(5,7))-1]||null};
  }
  if(module==="pm"){
    if(coerce(row.site)&&coerce(row.site)!==localisationSite(row.unite))throw new Error("Site incompatible avec la localisation.");
    const machine=context.machines.get(coerce(row.machine_tag));
    if(!machine||machine.unite!==coerce(row.unite))throw new Error("Machine inconnue ou localisation incohérente.");
    const date=dateValue(row.date_prevue),tol=num(row.tolerance_jours??7);
    if(tol===null||tol<0||tol>365)throw new Error("Tolérance PM invalide.");
    if(coerce(row.statut).toLowerCase().includes("réalis"))throw new Error("Une PM réalisée ne peut pas être importée comme PM programmée.");
    return {...common,machine_tag:coerce(row.machine_tag),machine_designation:coerce(row.machine_designation)||machine.designation,
      unite:coerce(row.unite),
      frequence:coerce(row.frequence),tolerance_jours:tol,date_prevue:date,
      annee:Number(date.slice(0,4)),mois:monthNames[Number(date.slice(5,7))-1],
      statut:coerce(row.statut)||"Planifiée",responsable:coerce(row.responsable)||null,
      service_intervenant:coerce(row.service_intervenant)||null,commentaire:coerce(row.commentaire)||null,
      motif_report:coerce(row.motif_report)||null};
  }
  if(module==="operating"){
    const machine=context.machines.get(coerce(row.machine));
    if(!machine)throw new Error("Machine inconnue.");
    const date=dateValue(row.date_jour),run=num(row.heures_marche),planned=num(row.heures_planifiees??24),stop=num(row.heures_arret??0);
    if(run===null||stop===null||planned===null||[run,planned,stop].some(n=>n<0||n>24)||run+stop>24.001)
      throw new Error("Heures hors plage de 0 à 24 heures.");
    return {...common,machine:coerce(row.machine),date_jour:date,heures_planifiees:planned,
      heures_marche:run,heures_arret:stop,commentaire:coerce(row.commentaire)||null,saisi_par:coerce(row.saisi_par)||null};
  }
  throw new Error("Module non importable.");
}
function keyOf(module,row){
  return EXCEL_MODULES[module].key.map(key=>coerce(row[key]).toLowerCase()).join("\u001f");
}
async function getRows(module,supabaseRequest,remoteEffectifWithUnits,user){
  if(module==="effectif"){
    const employees=await remoteEffectifWithUnits(user);
    return employees.map(e=>({...e,unites:(e.units||[]).join("; "),actif:e.actif?"Oui":"Non",
      toutes_unites:e.toutes_unites?"Oui":"Non"}));
  }
  const rows=[];
  for(let offset=0;offset<10000;offset+=1000){
    const page=await supabaseRequest(EXCEL_MODULES[module].table,{
      query:"?select=*&order=id.asc&limit=1000&offset="+offset
    });
    rows.push(...page);
    if(page.length<1000)return rows;
  }
  throw new Error("Export de plus de 10 000 lignes : contacter l'administrateur.");
}
function spreadsheet(module,rows,template=false) {
  const schema=EXCEL_MODULES[module];
  const values=template?[]:rows.map(row=>schema.fields.map(key=>{
    const value=key==="site"&&row.site===undefined?localisationSite(row.unite):row[key];
    if(typeof value==="boolean")return value?"Oui":"Non";
    return value===null||value===undefined?"":value;
  }));
  const notes=[["Usage","Gabarit compatible avec le module "+schema.title],
    ["Import","Contrôle préalable obligatoire ; doublons ignorés ; aucune suppression automatique."],
    ["Lignes","1 000 maximum par import. Les fichiers sont traités par petits lots pour éviter les délais d'attente."],
    ...schema.required.map(field=>[field,"Obligatoire pour un nouvel enregistrement."]),
    ...schema.help.map((s,i)=>["Note "+(i+1),s])];
  return makeXlsx(schema.fields.map(key=>key==="unite"?"Localisation":key==="unites"?"Localisations":key),values,{name:schema.title.replace(/\//g,"-"),instructions:notes});
}
function filename(module,suffix){
  const day=new Date().toISOString().slice(0,10);
  return "Engineering_"+module+"_"+suffix+"_"+day+".xlsx";
}
async function parseValidated(module,encoded,deps){
  if(typeof encoded!=="string"||encoded.length>4_200_000||!/^[a-z0-9+/=\r\n]+$/i.test(encoded))
    throw new Error("Fichier XLSX manquant ou trop volumineux.");
  const bytes=Buffer.from(encoded,"base64");
  if(bytes.length<100||bytes.subarray(0,2).toString()!=="PK")throw new Error("Sélectionner un véritable fichier .xlsx.");
  const cells=readXlsx(bytes);
  const schema=EXCEL_MODULES[module],headers=cells[0].map(value=>aliases[cleanHeader(value)]||cleanHeader(value));
  if(headers.some(h=>FORBIDDEN.has(h)))throw new Error("Colonnes de connexion ou système interdites : utiliser le template Excel.");
  const unknown=headers.filter(h=>h&&!schema.fields.includes(h)&&h!=="groupe");
  if(unknown.length)throw new Error("Colonnes non reconnues : "+unknown.slice(0,5).join(", ")+". Télécharger le template.");
  if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new Error("Colonnes en double.");
  for(const required of schema.required)if(!headers.includes(required))throw new Error("Colonne obligatoire absente : "+required);
  const list=cells.slice(1).filter(row=>row.some(c=>c!==""&&c!==undefined&&c!==null));
  if(list.length>MAX_ROWS)throw new Error("Maximum "+MAX_ROWS+" lignes par import.");
  const [existing, machines]=await Promise.all([
    getRows(module,deps.supabaseRequest,deps.remoteEffectifWithUnits,deps.user),
    module==="machines"||module==="effectif"?Promise.resolve([]):deps.supabaseRequest("machines",{query:"?select=tag,unite,designation,groupe,zone&limit=5000"})
  ]);
  const keys=new Map(existing.map(row=>[keyOf(module,row),row]));
  const context={machines:new Map(machines.map(m=>[m.tag,m]))};
  const seen=new Set(),actions=[],errors=[];let duplicates=0,updates=0,creations=0;
  list.forEach((cells,i)=>{
    const line=i+2;
    try{
      const raw=Object.fromEntries(headers.map((key,j)=>[key,cells[j]]).filter(([key])=>key));
      const row=normalizeRow(raw,schema.fields);
      const key=keyOf(module,row);
      if(!key||key.split("\u001f").some(x=>!x))throw new Error("Clé unique manquante ("+schema.key.join("+")+").");
      if(seen.has(key))throw new Error("Doublon de clé dans le fichier.");
      seen.add(key);
      for(const required of schema.required)if(!coerce(row[required]))throw new Error(required+" obligatoire.");
      const found=keys.get(key);
      const payload=normalizeForSave(module,row,context,found);
      if(found && module!=="effectif"){duplicates++;return;}
      if(found && module==="effectif"){
        if(Object.keys(payload.update).length){updates++;actions.push({kind:"update",id:found.id,values:payload.update,line});}
        else duplicates++;
        return;
      }
      creations++;actions.push({kind:"insert",values:module==="effectif"?payload.insert:payload,
        units:module==="effectif"?payload.units:[],line});
    }catch(e){errors.push({line,message:e.message});}
  });
  return {module,total:list.length,creations,updates,duplicates,errors,actions,hash:crypto.createHash("sha256").update(bytes).digest("hex")};
}
export function registerExcelRoutes(app,{requireAuth,supabaseRequest,remoteEffectifWithUnits,localTimestamp}){
  // Contrôle côté serveur : le client ne peut pas débloquer ces routes.
  const admin=async(req,res,next)=>{
    if(req.user.role!=="admin")return res.status(403).json({error:"Fonction réservée aux administrateurs."});
    try{
      const id=req.user.supabase_id || req.user.id;
      if(!id)return res.status(403).json({error:"Administrateur non vérifié."});
      const rows=await supabaseRequest("effectif",{
        query:"?select=id,role,actif&id=eq."+encodeURIComponent(id)+"&limit=1"
      });
      if(rows[0]?.role!=="admin" || rows[0]?.actif!==true)
        return res.status(403).json({error:"Accès administrateur révoqué ou compte inactif."});
      return next();
    }catch(e){return res.status(503).json({error:"Vérification administrateur indisponible."});}
  };
  app.get("/api/excel/catalogue",requireAuth,admin,(_req,res)=>{
    res.json(Object.entries(EXCEL_MODULES).map(([id,s])=>({id,label:s.title})));
  });
  app.get("/api/excel/:module/:action",requireAuth,admin,async(req,res)=>{
    try{
      const {module,action}=req.params;
      if(!EXCEL_MODULES[module]||!["export","template"].includes(action))return res.status(404).json({error:"Module Excel introuvable."});
      const rows=action==="export"?await getRows(module,supabaseRequest,remoteEffectifWithUnits,req.user):[];
      const buffer=spreadsheet(module,rows,action==="template");
      res.set("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.set("Content-Disposition","attachment; filename=\""+filename(module,action)+"\"");
      res.set("Cache-Control","private, no-store");
      return res.send(buffer);
    }catch(e){return res.status(502).json({error:"Excel : "+e.message});}
  });
  app.post("/api/excel/:module/:action",requireAuth,admin,async(req,res)=>{
    const {module,action}=req.params;
    if(!EXCEL_MODULES[module]||!["preview","import"].includes(action))
      return res.status(404).json({error:"Module ou opération Excel introuvable."});
    try{
      const preview=await parseValidated(module,req.body.file,{supabaseRequest,remoteEffectifWithUnits,user:req.user});
      if(action==="preview")return res.json(Object.fromEntries(Object.entries(preview).filter(([k])=>k!=="actions")));
      if(preview.errors.length)return res.status(422).json({error:"Corriger les erreurs indiquées avant import.",...Object.fromEntries(Object.entries(preview).filter(([k])=>k!=="actions"))});
      if(preview.hash!==req.body.hash)return res.status(409).json({error:"Le fichier a changé depuis la prévisualisation."});
      // Import par plages : limite le temps d'exécution de chaque fonction Vercel.
      const hasBatch=req.body.batchStart!==undefined||req.body.batchSize!==undefined;
      let selected=preview.actions;
      if(hasBatch){
        const start=req.body.batchStart,size=req.body.batchSize;
        if(!Number.isInteger(start)||!Number.isInteger(size)||start<0||start>=preview.total||size<1||size>100)
          return res.status(400).json({error:"Lot d'import invalide (100 lignes maximum par requête)."});
        selected=selected.filter(a=>a.line>=start+2&&a.line<start+size+2);
      }
      let imported=0,updated=0;const failures=[];
      for(const action of selected){
        try{
          if(action.kind==="update"){
            const result=await supabaseRequest("effectif",{
              method:"PATCH",query:"?id=eq."+encodeURIComponent(action.id)+"&select=id",
              prefer:"return=representation",body:{...action.values,updated_at:new Date().toISOString()}
            });
            if(!result?.length)throw new Error("Collaborateur introuvable.");
            updated++;continue;
          }
          if(module==="effectif"){
            const data={...action.values};
            const created=await supabaseRequest("effectif",{
              method:"POST",query:"?select=id",prefer:"return=representation",body:[data]
            });
            if(!created?.[0]?.id)throw new Error("Création collaborateur non confirmée.");
            if(action.units.length){
              try{
                await supabaseRequest("effectif_unites",{method:"POST",
                  body:action.units.map(unite=>({effectif_id:created[0].id,unite}))});
              }catch(e){
                failures.push({line:action.line,message:"Collaborateur créé, mais localisations non associées : "+e.message});
              }
            }
            imported++;continue;
          }
          await supabaseRequest(EXCEL_MODULES[module].table,{method:"POST",body:[action.values]});
          imported++;
        }catch(e){failures.push({line:action.line,message:e.message});}
      }
      return res.json({imported,updated,duplicates:preview.duplicates,errors:failures,total:preview.total,
        message:failures.length?"Import partiel : vérifier les erreurs de lignes.":"Import terminé."});
    }catch(e){return res.status(400).json({error:"Import impossible : "+e.message});}
  });
}
