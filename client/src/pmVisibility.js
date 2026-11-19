import {isAdmin,isLead,pmInDepartment,machineInDepartment} from "./accessPolicy.js";

// Les PM historiques sans service ne sont pas automatiquement réaffectées.
// Un responsable peut les consulter uniquement dans ses localisations autorisées
// et sur une machine partagée ou de son département. Elles restent non réalisables
// tant que l'administrateur ne les a pas attribuées explicitement.
export function pmVisibility(user,pm,allowedLocations,machine){
 const units=allowedLocations instanceof Set?allowedLocations:new Set(allowedLocations||[]);
 if(!units.has(pm.unite))return {visible:false,readOnly:true,reason:"location"};
 if(isAdmin(user))return {visible:true,readOnly:false,reason:"admin"};
 if(pm.service_intervenant&&String(pm.service_intervenant).trim()){
  const allowed=pmInDepartment(user,pm);
  return {visible:allowed,readOnly:!allowed,reason:allowed?"department":"other-department"};
 }
 if(!isLead(user))return {visible:false,readOnly:true,reason:"unassigned"};
 if(!machine||machine.unite!==pm.unite||!machineInDepartment(user,machine))
  return {visible:false,readOnly:true,reason:"machine-scope"};
 return {visible:true,readOnly:true,reason:"legacy-unassigned"};
}
