// Politique d'accès partagée entre React et l'API.
// Les autorisations sont toujours recalculées côté serveur depuis Supabase.
export const normAccess=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
export const nameAccess=value=>normAccess(value).replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
export const isAdmin=user=>user?.role==="admin";
export const isLead=user=>isAdmin(user)||user?.role==="superviseur"||
 /(?:^|\b)(?:superviseur|supervisor|manager)(?:\b|$)|shift[\s-]*leader/.test(normAccess(user?.fonction));

export const ACCESS_MODULES=[
  ["accueil","Accueil",["view"]],
  ["machines","Machines",["view","create","edit"]],
  ["effectif","Effectif RH",["view","create","edit"]],
  ["saisie","Déclaration de panne",["view","create"]],
  ["liste","Liste des pannes",["view","edit"]],
  ["pm","Maintenance préventive",["view","create","edit"]],
  ["operating","Operating Time",["view","create","edit"]],
  ["sop","SOP",["view","create","edit"]],
  ["stats","Statistiques",["view"]],
  ["parametres","Paramètres",["view"]]
];
export const ACCESS_ACTIONS=["view","create","edit"];
const CATALOG=new Map(ACCESS_MODULES.map(([id,,actions])=>[id,new Set(actions)]));

export function defaultPermission(user,module,action="view"){
  if(!CATALOG.get(module)?.has(action))return false;
  // Les paramètres et la gestion des comptes restent strictement réservés aux admins.
  if(module==="parametres")return isAdmin(user);
  if(isAdmin(user))return true;
  const lead=isLead(user);
  if(action==="view")return ["effectif","stats"].includes(module)?lead:true;
  if(module==="machines"||module==="sop")return lead;
  if(module==="effectif")return false;
  if(module==="saisie")return action==="create";
  if(module==="liste")return action==="edit"; // Les règles d'auteur et de département s'appliquent aussi.
  if(module==="pm")return action==="edit"||lead;
  if(module==="operating")return action==="create";
  return false;
}

export function resolvePermissions(user,rules=[]){
  const result={};
  for(const [module,,actions] of ACCESS_MODULES){
    result[module]={};
    for(const action of actions)result[module][action]=defaultPermission(user,module,action);
  }
  if(isAdmin(user))return result;
  const ids={role:normAccess(user?.role),fonction:normAccess(user?.fonction),
    personne:String(user?.supabase_id||user?.id||"")};
  // Les droits d'une personne prévalent sur son poste, puis sur son rôle.
  for(const scope of ["role","fonction","personne"]){
    const row=Array.isArray(rules)?rules.find(r=>r?.scope===scope&&String(r.subject)===ids[scope]):null;
    if(!row||!row.rules||typeof row.rules!=="object")continue;
    for(const [module,actions] of Object.entries(row.rules)){
      if(!CATALOG.has(module)||module==="parametres"||!actions||typeof actions!=="object")continue;
      for(const [action,choice] of Object.entries(actions)){
        if(CATALOG.get(module).has(action)&&typeof choice==="boolean")result[module][action]=choice;
      }
    }
  }
  for(const [module,,actions] of ACCESS_MODULES){
    if(!result[module].view)for(const action of actions)if(action!=="view")result[module][action]=false;
  }
  return result;
}

export function permissionAllowed(user,module,action="view"){
  if(!CATALOG.get(module)?.has(action))return false;
  if(module==="parametres")return isAdmin(user);
  if(isAdmin(user))return true;
  const stored=user?.permissions?.[module]?.[action];
  const allow=typeof stored==="boolean"?stored:defaultPermission(user,module,action);
  return action==="view"?allow:allow&&permissionAllowed(user,module,"view");
}
export const permittedModule=(user,id)=>permissionAllowed(user,id,"view");
export const canPlanPM=user=>permissionAllowed(user,"pm","create");
export const canManageMachines=user=>permissionAllowed(user,"machines","edit");
export const canReadEffectif=user=>permissionAllowed(user,"effectif","view");
export const canReadStats=user=>permissionAllowed(user,"stats","view");

export const sameDepartment=(user,department)=>Boolean(normAccess(user?.service)&&normAccess(department)===normAccess(user?.service));
export const machineInDepartment=(user,machine)=>isAdmin(user)||!String(machine?.departement||"").trim()||sameDepartment(user,machine.departement);
export const panneInDepartment=(user,panne)=>isAdmin(user)||sameDepartment(user,panne?.service);
export const pmInDepartment=(user,pm)=>isAdmin(user)||sameDepartment(user,pm?.service_intervenant);
export function employeeOwnsPanne(user,panne){
 const ownId=String(user?.supabase_id||user?.id||"");
 if(panne?.cree_par_effectif_id)return Boolean(ownId&&String(panne.cree_par_effectif_id)===ownId);
 const names=[nameAccess([user?.nom,user?.prenom].filter(Boolean).join(" ")),nameAccess([user?.prenom,user?.nom].filter(Boolean).join(" "))].filter(Boolean);
 return names.includes(nameAccess(panne?.technicien));
}
export const panneEditable=(user,panne)=>isAdmin(user)||(panneInDepartment(user,panne)&&(isLead(user)||employeeOwnsPanne(user,panne)));
