import {isAdmin,isInstrumentation,INSTRUMENTATION_PM_LOCATIONS,pmInDepartment,machineInDepartment} from "./accessPolicy.js";

// Les PM historiques sans service ne sont jamais automatiquement réaffectées.
// Les techniciens comme les responsables peuvent les CONSULTER uniquement dans
// leurs localisations autorisées, si la machine est partagée ou rattachée à leur
// département. La réalisation reste interdite jusqu'à attribution explicite
// du service par un administrateur (vérifiée aussi par l'API de réalisation).
export function pmVisibility(user,pm,allowedLocations,machine){
 const units=allowedLocations instanceof Set?allowedLocations:new Set(allowedLocations||[]);
 if(!units.has(pm.unite))return {visible:false,readOnly:true,reason:"location"};
 if(isAdmin(user))return {visible:true,readOnly:false,reason:"admin"};
 if(isInstrumentation(user)){
  if(!INSTRUMENTATION_PM_LOCATIONS.includes(pm.unite))
   return {visible:false,readOnly:true,reason:"instrumentation-location"};
  // Consultation des PM de ces trois localisations, même si la PM a été affectée
  // à un autre service ; la réalisation reste limitée à son département.
  if(pm.service_intervenant&&String(pm.service_intervenant).trim()){
   const writable=pmInDepartment(user,pm);
   return {visible:true,readOnly:!writable,reason:writable?"instrumentation":"other-department"};
  }
  return {visible:true,readOnly:true,reason:"legacy-unassigned"};
 }
 if(pm.service_intervenant&&String(pm.service_intervenant).trim()){
  const allowed=pmInDepartment(user,pm);
  return {visible:allowed,readOnly:!allowed,reason:allowed?"department":"other-department"};
 }
 // Ne jamais confondre absence d'attribution et accès libre aux PM.
 // La machine doit être présente, dans la même localisation, et visible selon
 // le département du compte connecté. Aucun droit d'écriture n'est ajouté ici.
 if(!machine||machine.unite!==pm.unite||!machineInDepartment(user,machine))
  return {visible:false,readOnly:true,reason:"machine-scope"};
 return {visible:true,readOnly:true,reason:"legacy-unassigned"};
}
