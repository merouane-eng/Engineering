import test from "node:test";
import assert from "node:assert/strict";
import {
 isAdmin,isLead,canPlanPM,canManageMachines,permittedModule,sameDepartment,
 machineInDepartment,panneInDepartment,pmInDepartment,employeeOwnsPanne,panneEditable
} from "../client/src/accessPolicy.js";

const technician={id:"emp-tech",role:"technicien",fonction:"Maintenance Technicien 2",nom:"Touati",prenom:"Leila",service:"Maintenance"};
const leader={...technician,id:"emp-lead",fonction:"Maintenance Shift Leader"};
const supervisor={...technician,id:"emp-sup",role:"superviseur",fonction:"Maintenance Supervisor"};
const supervisorUnflagged={...technician,id:"emp-sup-fn",fonction:"Maintenance Supervisor"};
const manager={...technician,id:"emp-manager",fonction:"Manager Engineering OSD"};
const admin={...technician,id:"emp-admin",role:"admin"};

test("Managers, shift leaders et superviseurs sont responsables même si role=technicien",()=>{
 for(const person of [leader,supervisor,supervisorUnflagged,manager,admin]){
  assert.equal(isLead(person),true,person.fonction);
  assert.equal(canPlanPM(person),true);
  assert.equal(canManageMachines(person),true);
 }
 assert.equal(isLead(technician),false);
});
test("Seul admin voit Paramètres; RH/Statistiques cachés aux techniciens",()=>{
 for(const m of ["effectif","stats","parametres"])assert.equal(permittedModule(technician,m),false,m);
 for(const person of [leader,supervisor,manager]){
  assert.equal(permittedModule(person,"effectif"),true);
  assert.equal(permittedModule(person,"stats"),true);
  assert.equal(permittedModule(person,"parametres"),false);
 }
 assert.equal(permittedModule(admin,"parametres"),true);
 for(const m of ["accueil","machines","saisie","liste","pm","operating"])assert.equal(permittedModule(technician,m),true);
});
test("Départements stricts, accents neutres et machines historiques partagées",()=>{
 assert.equal(sameDepartment({...technician,service:"Électricité"},"Electricite"),true);
 assert.equal(panneInDepartment(technician,{service:"Électricité"}),false);
 assert.equal(pmInDepartment(technician,{service_intervenant:null}),false);
 assert.equal(pmInDepartment(technician,{service_intervenant:"Maintenance"}),true);
 assert.equal(machineInDepartment(technician,{departement:null}),true);
 assert.equal(machineInDepartment(technician,{departement:"Maintenance"}),true);
 assert.equal(machineInDepartment(technician,{departement:"Électricité"}),false);
 assert.equal(machineInDepartment(admin,{departement:"Électricité"}),true);
});
test("Modification des pannes : auteur et responsables du même département uniquement",()=>{
 const own={id:1,service:"Maintenance",cree_par_effectif_id:"emp-tech",technicien:"Autre personne"};
 const other={...own,cree_par_effectif_id:"someone-else"};
 const electric={...own,service:"Électricité"};
 assert.equal(employeeOwnsPanne(technician,own),true);
 assert.equal(panneEditable(technician,own),true);
 assert.equal(panneEditable(technician,other),false);
 assert.equal(panneEditable(technician,electric),false);
 assert.equal(panneEditable(leader,other),true);
 assert.equal(panneEditable(leader,electric),false);
 assert.equal(panneEditable(admin,electric),true);
});
test("Une panne attribuée au même nom n'efface pas l'identifiant de son vrai auteur",()=>{
 const row={service:"Maintenance",technicien:"Touati Leila",cree_par_effectif_id:"someone-else"};
 assert.equal(employeeOwnsPanne(technician,row),false);
});
