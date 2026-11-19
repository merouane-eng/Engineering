/* Référentiels desktop partagés avec Supabase.
 * Accès mutation / sauvegarde strictement administrateur, vérification du rôle en base.
 * Les données métier ne sont jamais supprimées ni renommées silencieusement. */
import crypto from "node:crypto";
import {makeXlsx,readXlsx,makeMultiSheetXlsx} from "./excel.js";
import {localisationCode,localisationSite} from "../client/src/locationModel.js";

export const REFERENCE_TABS = [
  ["service","Services"],["fonction","Fonctions"],["zone","Zones"],
  ["unite","Localisations"],["frequence_pm","Fréquences PM"],
  ["statut_pm","Statuts PM"],["statut_panne","Statuts panne"],
  ["area_SG01","Areas — Services généraux Site 01"],
  ["equipement_SG01","Équipements — Services généraux Site 01"],
  ["area_SG02","Areas — Services généraux Site 02"],
  ["equipement_SG02","Équipements — Services généraux Site 02"]
];
const VALID = new Set(REFERENCE_TABS.map(t=>t[0]));
const escapeCsv = value=>String(value||"").trim();
const norm = value=>String(value||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const fileLimit = 3*1024*1024;
const maxRows = 300;
export function createSettingsHandlers({supabaseRequest,remoteEffectifWithUnits}){
  async function rpc(action,more={}){
    const secret=process.env.ENGINEERING_REFERENCES_SECRET;
    if(!secret)throw new Error("Stockage des paramètres non configuré sur ce déploiement.");
    return supabaseRequest("rpc/engineering_references_rpc",{
      method:"POST",body:{p_secret:secret,p_action:action,p_type:null,p_id:null,p_valeur:null,p_parent:null,...more}
    });
  }
  async function admin(req,res,next){
    if(req.user?.role!=="admin")return res.status(403).json({error:"Réservé aux administrateurs."});
    try{
      const id=req.user.supabase_id||req.user.id;
      if(!id) return res.status(403).json({error:"Compte administrateur non vérifié."});
      const rows=await supabaseRequest("effectif",{query:"?select=id,role,actif&id=eq."+encodeURIComponent(id)+"&limit=1"});
      if(rows[0]?.role!=="admin"||rows[0]?.actif!==true)
        return res.status(403).json({error:"Ce compte n'a plus les droits administrateur."});
      return next();
    }catch{
      return res.status(503).json({error:"Vérification du compte administrateur indisponible."});
    }
  }
  async function list(){
    const refs=await rpc("list");
    return Array.isArray(refs)?refs:[];
  }
  async function getUsage(){
    const sources=[
      ["effectif",["service","fonction"]],
      ["effectif_unites",["unite"]],
      ["machines",["unite","zone","groupe"]],
      ["pannes",["unite","area","service","statut","machine"]],
      ["pm_programmees",["unite","groupe","frequence","statut","service_intervenant"]],
      ["pm_realisees",["unite","statut"]]
    ];
    const groups={};
    await Promise.all(sources.map(async([table,fields])=>{
      // Important : ne jamais envoyer les noms, mots de passe ou données personnelles.
      let rows=[];
      for(let offset=0;offset<10000;offset+=1000){
        const batch=await supabaseRequest(table,{
          query:"?select="+fields.join(",")+"&limit=1000&offset="+offset
        });
        rows.push(...batch);
        if(batch.length<1000)break;
      }
      for(const row of rows){
        const mapped={
          effectif:{service:"service",fonction:"fonction"},
          effectif_unites:{unite:"unite"},
          machines:{unite:"unite",zone:"zone",groupe:"groupe"},
          pannes:{unite:"unite",area:"zone",service:"service",statut:"statut_panne"},
          pm_programmees:{unite:"unite",groupe:"groupe",frequence:"frequence_pm",statut:"statut_pm",service_intervenant:"service"},
          pm_realisees:{unite:"unite",statut:"statut_pm"}
        }[table]||{};
        for(const [field,type] of Object.entries(mapped)){
          const val=norm(row[field]);
          if(!val)continue;
          const k=type+"|"+val;
          groups[k]=(groups[k]||0)+1;
        }
        if(table==="pannes"){
          for(const [value,type] of [[row.area,"area_"+row.unite],[row.machine,"equipement_"+row.unite]]){
            const val=norm(value);if(!val||!VALID.has(type))continue;
            const k=type+"|"+val;groups[k]=(groups[k]||0)+1;
          }
        }
      }
    }));
    return groups;
  }
  const safe = f=>(req,res)=>Promise.resolve().then(()=>f(req,res)).catch(e=>
    res.status(400).json({error:"Paramètres : "+String(e.message||"Erreur inconnue").slice(0,400)}));
  function checkInput(req){
    const type=String(req.body?.type_liste||"");
    const valeur=escapeCsv(req.body?.valeur);
    const parent=escapeCsv(req.body?.parent)||null;
    if(!VALID.has(type))throw new Error("Type de liste non autorisé.");
    if(!valeur||valeur.length>120)throw new Error("Valeur obligatoire (120 caractères maximum).");
    if(type==="unite")return {type,valeur:localisationCode(valeur,String(req.body?.site||"").trim()),parent:null};
    if(parent&&parent.length>120)throw new Error("Valeur associée trop longue.");
    return {type,valeur,parent};
  }
  function getFile(req){
    const encoded=req.body?.file;
    if(typeof encoded!=="string"||encoded.length>4_200_000||!/^[A-Za-z0-9+/=\r\n]+$/.test(encoded))
      throw new Error("Fichier Excel manquant ou trop volumineux.");
    const buffer=Buffer.from(encoded,"base64");
    if(buffer.length<100||buffer.length>fileLimit||buffer.subarray(0,2).toString()!=="PK")
      throw new Error("Fichier .xlsx invalide (maximum 3 Mo).");
    return {buffer,hash:crypto.createHash("sha256").update(buffer).digest("hex")};
  }
  async function preview(req){
    const {buffer,hash}=getFile(req);
    const matrix=readXlsx(buffer);
    const names=matrix[0].map(s=>norm(s));
    const required=["type_liste","valeur","parent","ordre","actif"];
    if(!required.every(name=>names.includes(name)))throw new Error("Utiliser le template Paramètres : colonnes type_liste, valeur, parent, ordre, actif.");
    const rows=matrix.slice(1).filter(line=>line.some(cell=>cell!==""&&cell!==undefined&&cell!==null));
    if(rows.length>maxRows)throw new Error("300 références maximum par import.");
    const existing=await list(),refs=new Set(existing.map(r=>r.type_liste+"|"+norm(r.valeur)));
    const seen=new Set(),actions=[],errors=[];let duplicates=0;
    for(const [i,raw] of rows.entries()){
      try{
        const row=Object.fromEntries(names.map((n,j)=>[n,raw[j]]));
        const type=escapeCsv(row.type_liste),value=escapeCsv(row.valeur);
        if(!VALID.has(type)||!value||value.length>120)throw new Error("Type ou valeur invalide.");
        const parent=escapeCsv(row.parent)||null;
        const key=type+"|"+norm(value);
        if(seen.has(key))throw new Error("Doublon dans le fichier.");
        seen.add(key);
        if(refs.has(key)){duplicates++;continue;}
        if(type==="unite"&&parent&&parent!=="Site 01"&&parent!=="Site 02")throw new Error("Le site doit être Site 01 ou Site 02.");
        actions.push({type,value,parent:type==="unite"?null:parent,line:i+2});
      }catch(e){errors.push({line:i+2,message:e.message});}
    }
    // Les codes de localisation sont uniques par site : aucun groupe nécessaire.
    return {hash,total:rows.length,creations:actions.length,duplicates,errors,actions};
  }
  return {
    rpc,admin,list,getUsage,safe,checkInput,preview,
    register(app,requireAuth){
      app.get("/api/references/active",requireAuth,safe(async(req,res)=>{
        const refs=(await list()).filter(r=>r.actif&&r.type_liste!=="groupe");
        res.json(refs.map(r=>({type_liste:r.type_liste,valeur:r.valeur,parent:r.parent,ordre:r.ordre})));
      }));
      app.get("/api/settings/references",requireAuth,admin,safe(async(req,res)=>{
        const [refs,usage]=await Promise.all([list(),getUsage()]);
        res.json(refs.filter(r=>r.type_liste!=="groupe").map(r=>({...r,site:r.type_liste==="unite"?localisationSite(r.valeur):null,usage:usage[r.type_liste+"|"+norm(r.valeur)]||0})));
      }));
      app.post("/api/settings/references",requireAuth,admin,safe(async(req,res)=>{
        const {type,valeur,parent}=checkInput(req);
        const result=await rpc("add",{p_type:type,p_valeur:valeur,p_parent:parent});
        res.status(201).json(result);
      }));
      app.put("/api/settings/references/:id",requireAuth,admin,safe(async(req,res)=>{
        const id=Number(req.params.id);
        if(!Number.isSafeInteger(id)||id<=0)throw new Error("Identifiant invalide.");
        const {type,valeur,parent}=checkInput(req);
        const refs=await list(),found=refs.find(r=>Number(r.id)===id);
        if(!found||found.type_liste!==type)throw new Error("Référence introuvable.");
        res.json(await rpc("edit",{p_id:id,p_valeur:valeur,p_parent:parent}));
      }));
      app.delete("/api/settings/references/:id",requireAuth,admin,safe(async(req,res)=>{
        const id=Number(req.params.id);
        if(!Number.isSafeInteger(id)||id<=0)throw new Error("Identifiant invalide.");
        res.json(await rpc("delete",{p_id:id}));
      }));

      // Sauvegarde GLOBALE, lecture seule, 11 tables métier + références.
      // Jamais d'identifiants de connexion ni password_hash dans le fichier.
      app.get("/api/settings/backup/global",requireAuth,admin,safe(async(req,res)=>{
        const schema=[
          ["machines","Machines",["tag","designation","site","unite","zone","marque","modele","numero_serie","date_mise_service","actif","commentaire"]],
          ["effectif","Effectif",["matricule","nom","prenom","initiale","service","fonction","telephone","email","role","actif","toutes_unites","date_recrutement","date_depart","site","type_contrat","date_fin_contrat"]],
          ["effectif_unites","Affectations",["effectif_id","unite"]],
          ["pannes","Pannes",["wo","date_panne","heure_panne","date_debut","date_fin","unite","machine","probleme","area","service","mois","technicien","downtime","statut","commentaire","pieces_consommees"]],
          ["pm_programmees","PM programmees",["machine_tag","machine_designation","unite","frequence","tolerance_jours","date_prevue","mois","annee","statut","responsable","service_intervenant","commentaire","motif_report"]],
          ["pm_realisees","PM realisees",["id_pm_prog","machine_tag","machine_designation","unite","date_prevue","date_debut","date_fin","downtime","technicien","ponctualite","commentaire","statut"]],
          ["operating_time","Operating Time",["machine","date_jour","heures_planifiees","heures_marche","heures_arret","commentaire","saisi_par"]],
          ["pieces","Pieces catalogue",["reference","nom","description","actif"]],
          ["machine_pieces","Pieces machines",["machine","piece_id","reference","nom"]],
          ["panne_pieces","Pieces utilisees",["panne_id","piece_id","machine","wo","reference","nom","quantite","date_utilisation","technicien"]],
          ["sop","SOP",["code","titre","version","machine","unite","date_application","date_revision","validateur","chemin_fichier","commentaire","actif"]]
        ];
        const datasets=await Promise.all(schema.map(async([table,name,fields])=>{
          const rows=[];let complete=false;
          for(let offset=0;offset<10000;offset+=1000){
            const page=await supabaseRequest(table,{
              query:"?select="+fields.join(",")+"&limit=1000&offset="+offset+
                "&order="+(table==="effectif_unites"?"unite":"id")+".asc"
            });
            rows.push(...page);
            if(page.length<1000){complete=true;break;}
          }
          if(!complete)throw new Error("La table "+table+" dépasse la limite de sauvegarde ; aucune archive partielle ne sera fournie.");
          return {name,headers:fields,rows:rows.map(r=>fields.map(f=>r[f]??""))};
        }));
        const refs=(await list()).filter(r=>r.type_liste!=="groupe"),refFields=["type_liste","valeur","parent","ordre","actif"];
        datasets.push({name:"Parametres",headers:refFields,rows:refs.map(r=>refFields.map(f=>r[f]??""))});
        datasets.unshift({name:"Informations",headers:["Champ","Valeur"],rows:[
          ["Application","Engineering — sauvegarde globale"],
          ["Date export",new Date().toISOString()],
          ["Modules",String(schema.length)+" modules métier + références"],
          ["Type","Archive en lecture seule : aucune donnée supprimée ou modifiée."],
          ["Sécurité","Mots de passe, hashes et secrets volontairement exclus."],
          ["Restauration","Utiliser les imports Excel par module (fusion non destructive)."]
        ]});
        const bytes=makeMultiSheetXlsx(datasets);
        res.set("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition",'attachment; filename="Engineering_Sauvegarde_Globale.xlsx"');
        res.set("Cache-Control","private,no-store");
        res.send(bytes);
      }));
      app.get("/api/settings/backup",requireAuth,admin,safe(async(req,res)=>{
        const refs=(await list()).filter(r=>r.type_liste!=="groupe");
        const cols=["type_liste","valeur","parent","ordre","actif"];
        const bytes=makeXlsx(cols,refs.map(r=>[r.type_liste,r.valeur,r.parent||"",r.ordre,r.actif?"Oui":"Non"]),{
          name:"Parametres",instructions:[
            ["Sauvegarde","Engineering — sauvegarde des listes de référence."],
            ["Fusion","Import : seules les références absentes sont ajoutées."],
            ["Sécurité","Aucun effacement, aucun renommage en masse lors de l'import."],
            ["Remplacement total","Non disponible sur la base centralisée : utiliser les exports de chaque module pour archiver toutes les données."]]
        });
        res.set("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition",'attachment; filename="Engineering_Parametres_Sauvegarde.xlsx"');
        res.set("Cache-Control","private,no-store");
        res.send(bytes);
      }));
      app.post("/api/settings/restore/:action",requireAuth,admin,safe(async(req,res)=>{
        if(!["preview","fusion"].includes(req.params.action))return res.status(404).json({error:"Action inconnue."});
        const result=await preview(req);
        if(req.params.action==="preview")
          return res.json(Object.fromEntries(Object.entries(result).filter(([k])=>k!=="actions")));
        if(result.hash!==req.body.hash)throw new Error("Le fichier a changé depuis l'aperçu.");
        if(result.errors.length)return res.status(422).json({error:"Corriger le fichier avant la fusion.",errors:result.errors});
        let imported=0;const errors=[];
        for(const row of result.actions){
          try{await rpc("add",{p_type:row.type,p_valeur:row.value,p_parent:row.parent});imported++;}
          catch(e){errors.push({line:row.line,message:String(e.message||"Erreur").slice(0,180)});}
        }
        return res.json({total:result.total,imported,duplicates:result.duplicates,errors});
      }));
    }
  };
}
