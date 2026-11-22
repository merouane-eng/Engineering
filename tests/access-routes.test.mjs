import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";
import {isLead,isAdmin,panneInDepartment,panneEditable,machineInDepartment,permissionAllowed} from "../client/src/accessPolicy.js";

const src=readFileSync(new URL("../server/server.js",import.meta.url),"utf8");
const extract=(a,b)=>{const x=src.indexOf(a),y=src.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return src.slice(x,y);};
const tech={id:"emp-tech",supabase_id:"emp-tech",role:"technicien",fonction:"Maintenance Technicien 2",nom:"Touati",prenom:"Leila",service:"Maintenance"};
const leader={...tech,id:"emp-lead",supabase_id:"emp-lead",fonction:"Maintenance Shift Leader"};
const manager={...tech,id:"emp-manager",supabase_id:"emp-manager",fonction:"Utilities Manager"};
const admin={...tech,id:"admin",supabase_id:"admin",role:"admin"};
const machines=[
 {id:11,tag:"M1",designation:"Pompe",unite:"U1",departement:"Maintenance",actif:1},
 {id:12,tag:"M2",designation:"Analyseur",unite:"U1",departement:"Électricité",actif:1}
];
const pannes=[
 {id:1,unite:"U1",machine:"M1",service:"Maintenance",cree_par_effectif_id:"emp-tech",technicien:"Touati Leila",commentaire:"Initial"},
 {id:2,unite:"U1",machine:"M1",service:"Maintenance",cree_par_effectif_id:"someone-else",technicien:"Autre Technicien",commentaire:"Initial"},
 {id:3,unite:"U1",machine:"M2",service:"Électricité",cree_par_effectif_id:"someone-else",technicien:"Technicien électricité",commentaire:"Initial"}
];
const createdPM=[];
function parseFilter(query,field){
 const match=String(query||"").match(new RegExp("(?:[?&])"+field+"=eq[.]([^&]+)"));
 return match?decodeURIComponent(match[1]):null;
}
const supabaseRequest=async(table,{query="",method="GET",body}={})=>{
 if(table==="pannes"){
  const id=parseFilter(query,"id");
  if(method==="PATCH"){
   const row=pannes.find(p=>String(p.id)===id);
   Object.assign(row,body);return [{...row}];
  }
  return id?pannes.filter(p=>String(p.id)===id).map(p=>({...p})):[...pannes];
 }
 if(table==="machines"){
  const tag=parseFilter(query,"tag");
  return machines.filter(m=>!tag||m.tag===tag);
 }
 if(table==="pm_programmees"){
  if(method==="POST"){createdPM.push(body[0]);return body;}
  return [];
 }
 return [];
};
const routes={put:{},post:{}};
const chain=handlers=>async(req,res)=>{
  for(const handler of handlers.slice(1,-1)){
    let advance=false;
    await handler(req,res,()=>{advance=true;});
    if(!advance)return;
  }
  return handlers.at(-1)(req,res);
};
const app={
 put(path,...handlers){routes.put[path]=chain(handlers);},
 post(path,...handlers){routes.post[path]=chain(handlers);}
};
const ctx=createContext({app,requireAuth:()=>{},isLead,isAdmin,panneInDepartment,machineInDepartment,
 requirePermission:(module,action)=>(req,res,next)=>permissionAllowed(req.user,module,action)?next():res.status(403).json({error:"Action non autorisée"}),
 allowedUnitsForUser:async user=>user.id==="admin"?["U1","U2"]:["U1"],
 panneCanBeEdited:async(user,row)=>panneEditable(user,row),
 supabaseRequest,localTimestamp:()=>"2026-11-19 11:00:00",
 crypto:{randomUUID:()=> "e1a37d3a-6b47-4191-a9a2-a13330e3fa71"},
 console
});
runInContext(extract('app.post("/api/pm",','// Attribution explicite des PM historiques'),ctx);
runInContext(extract('app.put("/api/tables/pannes/:id"', 'app.get("/api/tables/:table"'),ctx);
async function call(fn,user,body={},id="1"){
 const res={statusCode:200,data:null,status(v){this.statusCode=v;return this;},json(v){this.data=v;return this;}};
 await fn({user,body,params:{id}},res);
 return res;
}
const edit=routes.put["/api/tables/pannes/:id"],create=routes.post["/api/pm"];
test("Technicien ne modifie pas la panne créée par un autre",async()=>{
 const denied=await call(edit,tech,{commentaire:"Interdit"},"2");
 assert.equal(denied.statusCode,403);
 assert.equal(pannes[1].commentaire,"Initial");
 const allowed=await call(edit,tech,{commentaire:"Corrigé"},"1");
 assert.equal(allowed.statusCode,200);
 assert.equal(pannes[0].commentaire,"Corrigé");
});
test("Technicien ne peut pas forcer un autre département ni une autre localisation",async()=>{
 const response=await call(edit,tech,{commentaire:"OK",service:"Électricité",unite:"U2"},"1");
 assert.equal(response.statusCode,403);
 assert.equal(pannes[0].service,"Maintenance");
 const safe=await call(edit,tech,{commentaire:"OK",service:"Électricité"},"1");
 assert.equal(safe.statusCode,200);
 assert.equal(pannes[0].service,"Maintenance");
});
test("Shift Leader modifie ses pannes d'équipe, pas celles du département voisin",async()=>{
 const ok=await call(edit,leader,{commentaire:"Régularisé"},"2");
 assert.equal(ok.statusCode,200);
 const no=await call(edit,leader,{commentaire:"Interdit"},"3");
 assert.equal(no.statusCode,403);
 assert.equal(pannes[2].commentaire,"Initial");
});
test("Techniciens ne créent jamais de PM même avec un corps de requête forgé",async()=>{
 const r=await call(create,tech,{unite:"U1",machine_tag:"M1",date_prevue:"2026-12-05",frequence:"MONTHLY"});
 assert.equal(r.statusCode,403);
});
test("Shift Leader crée PM seulement sur machine et département permis",async()=>{
 const base={unite:"U1",machine_tag:"M1",date_prevue:"2026-12-05",frequence:"MONTHLY",
   service_intervenant:"Électricité",commentaire:"PM test"};
 const ok=await call(create,leader,base);
 assert.equal(ok.statusCode,201,JSON.stringify(ok.data));
 assert.equal(createdPM.at(-1).service_intervenant,"Maintenance");
 const anotherMachine=await call(create,leader,{...base,machine_tag:"M2"});
 assert.equal(anotherMachine.statusCode,403);
 const anotherLoc=await call(create,leader,{...base,unite:"U2"});
 assert.equal(anotherLoc.statusCode,403);
});
test("Manager et admin : autorisations explicites",async()=>{
 assert.equal((await call(create,manager,{unite:"U1",machine_tag:"M1",date_prevue:"2026-12-06",frequence:"MONTHLY"})).statusCode,201);
 assert.equal((await call(edit,admin,{commentaire:"Admin"},"3")).statusCode,200);
});
