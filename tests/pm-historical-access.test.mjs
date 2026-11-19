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
test("Technicien ne reçoit jamais les PM non attribuées, même dans sa localisation",()=>{
 assert.equal(pmVisibility(tech,pm,["U4"],shared).visible,false);
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
