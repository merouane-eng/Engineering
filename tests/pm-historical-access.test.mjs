import test from "node:test";
import assert from "node:assert/strict";
import {pmVisibility} from "../client/src/pmVisibility.js";

const lead={id:"lead",role:"technicien",fonction:"Maintenance Shift Leader",service:"Maintenance",site:"Site 01"};
const tech={id:"tech",role:"technicien",fonction:"Maintenance Technicien 2",service:"Maintenance",site:"Site 01"};
const electrical={...lead,service:"Électricité",fonction:"Electrical Shift Leader"};
const admin={...lead,role:"admin"};
const shared={tag:"U4-M001",unite:"U4",departement:null};
const maintenance={...shared,departement:"Maintenance"};
const other={...shared,departement:"Électricité"};
const pm={id:21,machine_tag:"U4-M001",unite:"U4",service_intervenant:null,date_prevue:"2026-11-20",statut:"Planifiée"};
test("Les 265 anciennes PM U4 sans service sont visibles en lecture seule pour Shift Leader affecté à U4",()=>{
 const all=Array.from({length:265},(_,i)=>({...pm,id:i+1}));
 const authorized=all.filter(row=>pmVisibility(lead,row,new Set(["U4"]),shared).visible);
 assert.equal(authorized.length,265);
 assert.ok(authorized.every(row=>pmVisibility(lead,row,["U4"],shared).readOnly));
});
test("Technicien consulte les anciennes PM de sa localisation en lecture seule",()=>{
 const access=pmVisibility(tech,pm,["U4"],shared);
 assert.equal(access.visible,true);
 assert.equal(access.readOnly,true);
 assert.equal(access.reason,"legacy-unassigned");
});
test("U5 : 209 PM historiques reliées à une machine restent consultables, 3 orphelines exclues",()=>{
 const u5={...tech,site:"Site 01"};
 const machine={...shared,tag:"U5-M001",unite:"U5"};
 const planned=Array.from({length:209},(_,i)=>({
  ...pm,id:i+1,machine_tag:machine.tag,unite:"U5",
  statut:i===0?"Planifiée":"Réalisée"
 }));
 const orphan=Array.from({length:3},(_,i)=>({...pm,id:i+210,unite:"U5",machine_tag:"ABSENT-"+i}));
 const result=[...planned,...orphan].map(row=>pmVisibility(u5,row,["U5"],row.machine_tag===machine.tag?machine:null));
 assert.equal(result.filter(x=>x.visible).length,209);
 assert.equal(result.filter(x=>x.visible&&!x.readOnly).length,0);
 assert.equal(result.filter(x=>!x.visible).length,3);
});
test("PM attribuée : département et localisation obligatoires",()=>{
 const assigned={...pm,service_intervenant:"Maintenance"};
 assert.equal(pmVisibility(lead,assigned,["U4"],shared).readOnly,false);
 assert.equal(pmVisibility(electrical,assigned,["U4"],shared).visible,false);
 assert.equal(pmVisibility(lead,assigned,["U1"],shared).visible,false);
});
test("Équipements explicitement réservés à un département ne deviennent pas visibles aux autres",()=>{
 assert.equal(pmVisibility(lead,pm,["U4"],other).visible,false);
 assert.equal(pmVisibility(lead,pm,["U4"],maintenance).visible,true);
 assert.equal(pmVisibility(electrical,pm,["U4"],maintenance).visible,false);
});
test("Les PM avec localisation incohérente ou machine absente restent exclues",()=>{
 assert.equal(pmVisibility(lead,pm,["U4"],{...shared,unite:"U1"}).visible,false);
 assert.equal(pmVisibility(lead,pm,["U4"],null).visible,false);
});
test("Admin conserve son périmètre complet",()=>{
 const result=pmVisibility(admin,pm,["U4"],null);
 assert.equal(result.visible,true);
 assert.equal(result.readOnly,false);
});

test("Technicien U5 : lecture refusée hors localisation ou sur une machine d'un autre département",()=>{
 const u5={...tech,site:"Site 01"};
 const row={...pm,unite:"U5",machine_tag:"U5-E01"};
 const current={...other,tag:"U5-E01",unite:"U5"};
 assert.equal(pmVisibility(u5,row,["U4"],current).visible,false);
 assert.equal(pmVisibility(u5,row,["U5"],current).visible,false);
 assert.equal(pmVisibility(u5,row,["U5"],null).visible,false);
 assert.equal(pmVisibility(u5,{...row,service_intervenant:"Électricité"},["U5"],{...shared,unite:"U5"}).visible,false);
});
test("Technicien U5 : PM attribuée à son service visible et réalisable selon statut",()=>{
 const assigned={...pm,unite:"U5",service_intervenant:"Maintenance"};
 const result=pmVisibility(tech,assigned,["U5"],{...shared,unite:"U5"});
 assert.equal(result.visible,true);
 assert.equal(result.readOnly,false);
});
