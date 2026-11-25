import test from "node:test";
import assert from "node:assert/strict";
import {defaultPermission,permissionAllowed,resolvePermissions,permittedModule} from "../client/src/accessPolicy.js";

test("SOP désactivé pour tous les rôles et toutes les actions",()=>{
 for(const role of ["admin","superviseur","technicien"]){
  const user={role,fonction:"Shift Leader",service:"Maintenance"};
  const rules=[{scope:"role",subject:role,rules:{sop:{view:true,create:true,edit:true}}}];
  const resolved=resolvePermissions(user,rules);
  for(const action of ["view","create","edit"]){
   assert.equal(defaultPermission(user,"sop",action),false,role+" "+action);
   assert.equal(resolved.sop[action],false,role+" "+action);
   assert.equal(permissionAllowed({...user,permissions:{sop:{[action]:true}}},"sop",action),false,role+" "+action);
  }
  assert.equal(permittedModule(user,"sop"),false);
 }
});