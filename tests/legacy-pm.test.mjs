import test from "node:test";
import assert from "node:assert/strict";
import {registerLegacyPmRoutes} from "../server/legacyPm.js";

const admin={id:"admin",role:"admin",service:"Maintenance"};
const leader={id:"leader-u4",role:"technicien",fonction:"Maintenance Shift Leader",service:"Maintenance"};
function setup(){
 const pms=[
  ...Array.from({length:265},(_,n)=>({id:n+1,unite:"U4",statut:"Réalisée",service_intervenant:null})),
  {id:266,unite:"U4",statut:"Planifiée",service_intervenant:"Électricité"},
  {id:267,unite:"U5",statut:"Réalisée",service_intervenant:null}
 ];
 const calls=[],routes={};
 const app={
  get(path,...handlers){routes["GET "+path]=handlers;},
  post(path,...handlers){routes["POST "+path]=handlers;}
 };
 const read=async(table,query)=>{
  if(table==="effectif")return [{id:"e1",service:"Maintenance"},{id:"e2",service:"Électricité"}];
  const u=decodeURIComponent((query.match(/unite=eq[.]([^&]+)/)||[])[1]||"");
  return pms.filter(row=>!u||row.unite===u).map(row=>({...row}));
 };
 const request=async(table,{query="",method,body}={})=>{
  assert.equal(table,"pm_programmees");
  assert.equal(method,"PATCH");
  assert.equal(body?.service_intervenant,"Maintenance");
  assert.match(query,/or=\(service_intervenant[.]is[.]null,service_intervenant[.]eq[.]\)/);
  const group=(query.match(/id=in[.]\(([0-9,]+)\)/)||[])[1];
  const ids=(group||"").split(",").map(Number);
  const updated=pms.filter(row=>ids.includes(row.id)&&!String(row.service_intervenant||"").trim());
  updated.forEach(row=>row.service_intervenant=body.service_intervenant);
  calls.push({ids,changed:updated.length});
  return updated.map(row=>({id:row.id}));
 };
 const gate=(req,res,next)=>req.user.role==="admin"?next():res.status(403).json({error:"Admin only"});
 registerLegacyPmRoutes(app,{
  requireAuth:(_req,_res,next)=>next(),requireAdmin:gate,
  supabaseReadAll:read,supabaseRequest:request,
  allowedUnitsForUser:async()=>["U4","U5"],
  normService:v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
 });
 async function call(method,path,{user=admin,query={},body={}}={}){
  const handlers=routes[method+" "+path];assert.ok(handlers,path);
  const req={user,query,body};
  const res={statusCode:200,data:null,status(n){this.statusCode=n;return this;},json(v){this.data=v;return this;}};
  for(const handler of handlers){
   let next=false;
   await handler(req,res,()=>{next=true;});
   if(!next)break;
  }
  return res;
 }
 return {call,pms,calls};
}

test("Aperçu U4 : 265 réalisées sans département, une PM Électricité préservée",async()=>{
 const fx=setup();
 const r=await fx.call("GET","/api/pm/legacy/unassigned",{query:{unite:"U4"}});
 assert.equal(r.statusCode,200);
 assert.deepEqual({...r.data},{unite:"U4",machine_tag:"",total:266,unassigned:265,assigned:1,by_status:{"Réalisée":265},by_machine:{"(sans machine)":265}});
 assert.equal(fx.calls.length,0,"Preview never mutates records");
});
test("Attribution groupée admin avec confirmation du compte : 3 lots, zéro écrasement",async()=>{
 const fx=setup();
 const r=await fx.call("POST","/api/pm/legacy/assign",{
  body:{unite:"U4",service_intervenant:"Maintenance",expected_count:265}
 });
 assert.equal(r.statusCode,200,JSON.stringify(r.data));
 assert.equal(r.data.attributed,265);
 assert.equal(fx.calls.length,3);
 assert.deepEqual(fx.calls.map(x=>x.changed),[100,100,65]);
 assert.equal(fx.pms.filter(p=>p.unite==="U4"&&p.service_intervenant==="Maintenance").length,265);
 assert.equal(fx.pms.find(p=>p.id===266).service_intervenant,"Électricité");
 assert.equal(fx.pms.find(p=>p.id===267).service_intervenant,null);
 const next=await fx.call("GET","/api/pm/legacy/unassigned",{query:{unite:"U4"}});
 assert.equal(next.data.unassigned,0);
});
test("Le Shift Leader ne peut ni prévisualiser ni attribuer les PM historiques",async()=>{
 const fx=setup();
 for(const [method,path] of [["GET","/api/pm/legacy/unassigned"],["POST","/api/pm/legacy/assign"]]){
  const r=await fx.call(method,path,{user:leader,query:{unite:"U4"},body:{unite:"U4",service_intervenant:"Maintenance",expected_count:265}});
  assert.equal(r.statusCode,403);
 }
 assert.equal(fx.calls.length,0);
});
test("Refus si nombre modifié, département inconnu, unité inconnue ou saisie incomplète",async()=>{
 const fx=setup();
 const variants=[
  [{unite:"U4",service_intervenant:"Maintenance",expected_count:264},409],
  [{unite:"U4",service_intervenant:"Inconnu",expected_count:265},400],
  [{unite:"U99",service_intervenant:"Maintenance",expected_count:265},400],
  [{unite:"U4",service_intervenant:"",expected_count:265},400]
 ];
 for(const [body,expected] of variants){
  const r=await fx.call("POST","/api/pm/legacy/assign",{body});
  assert.equal(r.statusCode,expected,JSON.stringify(r.data));
 }
 assert.equal(fx.calls.length,0);
 assert.equal(fx.pms.filter(p=>p.service_intervenant===null).length,266);
});
