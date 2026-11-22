import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";
import {pmVisibility} from "../client/src/pmVisibility.js";
import {pmInDepartment,machineInDepartment,isAdmin,isLead} from "../client/src/accessPolicy.js";
const src=readFileSync(new URL("../server/server.js",import.meta.url),"utf8");
const extract=(a,b)=>{
 const i=src.indexOf(a),j=src.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,"Missing server section: "+a);
 return src.slice(i,j);
};
const tech={id:"U5-TECH",supabase_id:"U5-TECH",role:"technicien",fonction:"Maintenance Technicien 2",
 service:"Maintenance",site:"Site 01",nom:"Test",prenom:"Technicien"};
const lead={...tech,id:"U5-LEAD",supabase_id:"U5-LEAD",fonction:"Maintenance Shift Leader"};
const otherService={...tech,id:"U5-ELEC",supabase_id:"U5-ELEC",service:"Électricité"};
const shared=Array.from({length:47},(_,i)=>({
 tag:"U5-M"+String(i+1).padStart(3,"0"),unite:"U5",departement:null
}));
const history=Array.from({length:212},(_,i)=>({
 id:i+1,unite:"U5",machine_tag:i<209?shared[i%shared.length].tag:"U5-MANQUANTE-"+i,
 service_intervenant:null,statut:i===0?"Planifiée":"Réalisée",date_prevue:"2025-07-01"
}));
const requests=[],writes=[];
const supabaseReadAll=async table=>{
 requests.push(table);
 if(table==="pm_programmees")return history;
 if(table==="pannes")return [];
 if(table==="operating_time")return [];
 return [];
};
const supabaseRequest=async(table,opts={})=>{
 requests.push(table);
 if(opts.method==="PATCH"||opts.method==="POST")writes.push({table,...opts});
 if(table==="pm_programmees")return history.filter(x=>String(x.id)===new URLSearchParams(String(opts.query||"").replace(/^[?]/,"")).get("id")?.replace(/^eq[.]/,""));
 return [];
};
const context=createContext({
 allowedUnitsForUser:async user=>user.id==="U5-NON-ASSIGNE"?[]:["U5"],
 visibleMachineRows:async user=>user.id==="U5-NON-ASSIGNE"?[]:shared,
 supabaseReadAll,supabaseRequest,pmVisibility,pmInDepartment,machineInDepartment,isAdmin,isLead,
 console
});
runInContext(extract("async function remoteModuleRows(module,user){","function currentUser(req)"),context);
test("API /modules/pm U5 : 209 PM visibles pour un technicien, sans aucune écriture",async()=>{
 const rows=await context.remoteModuleRows("pm",tech);
 assert.equal(rows.length,209);
 assert.equal(rows.filter(x=>x.consultation_seule).length,209);
 assert.equal(rows.filter(x=>x.attribution_requise).length,209);
 assert.equal(rows.filter(x=>x.statut==="Réalisée").length,208);
 assert.equal(rows.filter(x=>x.statut==="Planifiée").length,1);
 assert.deepEqual(writes,[]);
});
test("Technicien et shift leader U5 voient le même historique non attribué, lecture seule",async()=>{
 const [t,l]=await Promise.all([context.remoteModuleRows("pm",tech),context.remoteModuleRows("pm",lead)]);
 assert.equal(t.length,l.length);
 assert.deepEqual(t.map(x=>x.id),l.map(x=>x.id));
 assert.ok(t.every(x=>x.consultation_seule));
});
test("PM U5 hors des localisations autorisées jamais retournées",async()=>{
 const rows=await context.remoteModuleRows("pm",{...tech,id:"U5-NON-ASSIGNE"});
 assert.equal(rows.length,0);
});
test("PM U5 dédiées à un département voisin restent invisibles",()=>{
 const row={...history[0],service_intervenant:"Électricité"};
 assert.equal(pmVisibility(tech,row,["U5"],shared[0]).visible,false);
 assert.equal(pmVisibility(otherService,row,["U5"],shared[0]).visible,true);
});
test("API de réalisation interdit une PM sans service, même avec une requête forgée",async()=>{
 const routes={post:{}};
 const app={post(path,...handlers){routes.post[path]=handlers.at(-1)}};
 const ctx=createContext({
 app,requireAuth:()=>{},requirePermission:()=>()=>{},allowedUnitsForUser:async()=>["U5"],supabaseRequest,
 pmInDepartment,machineInDepartment,crypto:{randomUUID:()=> "u5-test"},console
 });
 runInContext(extract('app.post("/api/pm/:id/realiser"', 'app.put("/api/users/:id/password"'),ctx);
 const handler=routes.post["/api/pm/:id/realiser"];
 assert.equal(typeof handler,"function");
 const res={statusCode:200,payload:null,status(code){this.statusCode=code;return this},json(body){this.payload=body;return this}};
 await handler({user:tech,params:{id:"1"},body:{
  date_debut:"2026-11-19T08:00",date_fin:"2026-11-19T09:00",technicien:"Test"
 }},res);
 assert.equal(res.statusCode,403);
 assert.match(res.payload.error,/autre département/);
 assert.deepEqual(writes,[]);
});
