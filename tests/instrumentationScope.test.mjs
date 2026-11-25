import test from "node:test";
import assert from "node:assert/strict";
import {defaultPermission,permissionAllowed,resolvePermissions,isInstrumentation,
  pmLocationsForUser,INSTRUMENTATION_PM_LOCATIONS} from "../client/src/accessPolicy.js";
import {pmVisibility} from "../client/src/pmVisibility.js";
const user={role:"technicien",service:"Instrumentation",fonction:"Technicien Instrumentation"};
test("Operating Time masqué et interdit même si une permission personnelle l'autorise",()=>{
 assert.equal(isInstrumentation(user),true);
 const rules=[{scope:"role",subject:"technicien",rules:{operating:{view:true,create:true,edit:true}}},
   {scope:"fonction",subject:"technicien instrumentation",rules:{operating:{view:true}}}];
 const permissions=resolvePermissions(user,rules);
 for(const act of ["view","create","edit"]){
   assert.equal(defaultPermission(user,"operating",act),false);
   assert.equal(permissions.operating[act],false);
   assert.equal(permissionAllowed({...user,permissions:{operating:{[act]:true}}},"operating",act),false);
 }
});
test("PM Instrumentation : QC S01, Microbiologie S01 et Instrumentation uniquement",()=>{
 assert.deepEqual(pmLocationsForUser(user,["U1","U2","QC__S02"]),INSTRUMENTATION_PM_LOCATIONS);
 const allowed=new Set(pmLocationsForUser(user,[]));
 const machine=code=>({tag:"X",unite:code,departement:"Maintenance"});
 for(const unit of INSTRUMENTATION_PM_LOCATIONS){
  const decision=pmVisibility(user,{unite:unit,service_intervenant:"Instrumentation"},allowed,machine(unit));
  assert.equal(decision.visible,true,unit);
  assert.equal(decision.readOnly,false,unit);
  const other=pmVisibility(user,{unite:unit,service_intervenant:"Maintenance"},allowed,machine(unit));
  assert.equal(other.visible,true,unit);
  assert.equal(other.readOnly,true,unit);
 }
 for(const unit of ["U1","U2","U6","QC__S02","MICROBIOLOGIE__S02"]){
  assert.equal(pmVisibility(user,{unite:unit,service_intervenant:"Instrumentation"},allowed,machine(unit)).visible,false,unit);
 }
});
test("Administrateur reste non limité par les règles spécifiques d'Instrumentation",()=>{
 const admin={...user,role:"admin"};
 assert.equal(isInstrumentation(admin),false);
 assert.equal(permissionAllowed(admin,"operating","view"),true);
 assert.deepEqual(pmLocationsForUser(admin,["U1","U6"]),["U1","U6"]);
});
