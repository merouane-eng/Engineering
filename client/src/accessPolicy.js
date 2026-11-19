// Shared between the API and React. Never trust role data sent in write payloads.
export const normAccess=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
export const nameAccess=value=>normAccess(value).replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
export const isAdmin=user=>user?.role==="admin";
export const isLead=user=>isAdmin(user)||user?.role==="superviseur"||
 /(?:^|\b)(?:superviseur|supervisor|manager)(?:\b|$)|shift[\s-]*leader/.test(normAccess(user?.fonction));
export const canPlanPM=isLead;
export const canManageMachines=isLead;
export const canReadEffectif=isLead;
export const canReadStats=isLead;
export const permittedModule=(user,id)=>{
 if(id==="parametres")return isAdmin(user);
 if(id==="effectif"||id==="stats")return isLead(user);
 return ["accueil","machines","saisie","liste","pm","operating","sop"].includes(id);
};
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
