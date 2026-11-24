import test from "node:test";
import assert from "node:assert/strict";
import {permissionAllowed,resolvePermissions,defaultPermission} from "../client/src/accessPolicy.js";

const technicien={role:"technicien",fonction:"Technicien",service:"Maintenance"};
const shiftLeader={role:"technicien",fonction:"Shift Leader",service:"Maintenance"};
const superviseur={role:"superviseur",fonction:"Superviseur",service:"Maintenance"};
const admin={role:"admin",fonction:"Maintenance Manager",service:"Maintenance"};

test("Effectif RH: le technicien ne peut ni voir ni modifier, même avec une règle personnalisée",()=>{
 const grants=[{scope:"role",subject:"technicien",rules:{effectif:{view:true,create:true,edit:true}}}];
 const perms=resolvePermissions(technicien,grants);
 for(const action of ["view","create","edit"]){
   assert.equal(perms.effectif[action],false);
   assert.equal(permissionAllowed({...technicien,permissions:{effectif:{[action]:true}}},"effectif",action),false);
 }
});
test("Effectif RH: superviseur et shift leader ont uniquement lecture",()=>{
 for(const user of [superviseur,shiftLeader]){
  assert.equal(defaultPermission(user,"effectif","view"),true);
  assert.equal(permissionAllowed(user,"effectif","view"),true);
  assert.equal(permissionAllowed({...user,permissions:{effectif:{create:true,edit:true}}},"effectif","create"),false);
  assert.equal(permissionAllowed({...user,permissions:{effectif:{create:true,edit:true}}},"effectif","edit"),false);
 }
});
test("Effectif RH: administrateur a tous les droits",()=>{
 for(const action of ["view","create","edit"])assert.equal(permissionAllowed(admin,"effectif",action),true);
});
