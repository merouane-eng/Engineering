import test from "node:test";
import assert from "node:assert/strict";
import {createSettingsHandlers,REFERENCE_TABS} from "../server/desktopSettings.js";
import {readXlsx,makeXlsx} from "../server/excel.js";

function fixtures(){
 const refs=[
  {id:1,type_liste:"service",valeur:"Électricité",parent:null,ordre:0,actif:true},
  {id:2,type_liste:"service",valeur:"Mécanique",parent:null,ordre:1,actif:true},
  {id:3,type_liste:"groupe",valeur:"OSD",parent:null,ordre:0,actif:true},
  {id:4,type_liste:"unite",valeur:"U3-1",parent:"OSD",ordre:0,actif:true},
  {id:5,type_liste:"unite",valeur:"U3-2",parent:"OSD",ordre:1,actif:true}
 ];
 const events=[];
 const db={
  effectif:[{id:"user-admin",role:"admin",actif:true,service:"Électricité",fonction:"Technicien L1"}],
  effectif_unites:[{unite:"U3-1"}],
  machines:[{unite:"U3-1",zone:"Zone A",groupe:"OSD"}],
  pannes:[{unite:"U3-1",area:"Zone A",service:"Électricité",statut:"Open",machine:"M1"}],
  pm_programmees:[{unite:"U3-1",groupe:"OSD",frequence:"MONTHLY",statut:"Planifiée",service_intervenant:"Électricité"}],
  pm_realisees:[{unite:"U3-1",statut:"Réalisée"}]
 };
 const request=async (table,options={})=>{
  if(table==="rpc/engineering_references_rpc"){
   const {p_action,p_type,p_valeur,p_id,p_parent}=options.body;
   events.push({action:p_action,type:p_type,id:p_id});
   if(p_action==="list")return refs.map(r=>({...r}));
   if(p_action==="add"){
    if(refs.some(r=>r.type_liste===p_type&&r.valeur.toLowerCase()===p_valeur.toLowerCase()))throw Error("Doublon");
    const row={id:refs.length+10,type_liste:p_type,valeur:p_valeur,parent:p_parent,ordre:refs.length,actif:true};
    refs.push(row);return row;
   }
   if(p_action==="edit"){
    const row=refs.find(r=>r.id===p_id);if(!row)throw Error("Introuvable");
    row.valeur=p_valeur;row.parent=p_parent;return row;
   }
   if(p_action==="delete"){
    const i=refs.findIndex(r=>r.id===p_id);if(i<0)throw Error("Introuvable");
    refs.splice(i,1);return {deleted:true};
   }
  }
  const rows=db[table]||[];
  if(table==="effectif"&&options.query?.includes("id=eq.")){
    const id=decodeURIComponent(options.query.split("id=eq.")[1].split("&")[0]);
    return rows.filter(r=>r.id===id).map(r=>({...r}));
  }
  return rows;
 };
 const routes={};
 const app={
  get(path,...handlers){routes["GET "+path]=handlers;},
  post(path,...handlers){routes["POST "+path]=handlers;},
  put(path,...handlers){routes["PUT "+path]=handlers;},
  delete(path,...handlers){routes["DELETE "+path]=handlers;}
 };
 const old=process.env.ENGINEERING_REFERENCES_SECRET;
 process.env.ENGINEERING_REFERENCES_SECRET="test-secret-only";
 const handlers=createSettingsHandlers({supabaseRequest:request,remoteEffectifWithUnits:async()=>[]});
 handlers.register(app,(_req,_res,next)=>next());
 function restore(){if(old===undefined)delete process.env.ENGINEERING_REFERENCES_SECRET;else process.env.ENGINEERING_REFERENCES_SECRET=old;}
 async function call(verb,path,{user={role:"admin",id:"user-admin",supabase_id:"user-admin"},body={},params={}}={}){
  const fns=routes[verb+" "+path];assert.ok(fns,verb+" "+path+" not registered");
  const req={user,body,params},res={
   statusCode:200,headers:{},status(i){this.statusCode=i;return this;},
   json(o){this.body=o;return this;},send(b){this.binary=b;return this;},
   set(k,v){this.headers[k]=v;return this;}
  };
  for(const f of fns){
   let next=false;await f(req,res,()=>{next=true;});
   if(!next)break;
  }
  return res;
 }
 return {call,refs,events,db,restore};
}
test("Conformité desktop : les 8 listes et les références SG disponibles",()=>{
 const names=REFERENCE_TABS.map(x=>x[0]);
 for(const t of ["service","fonction","zone","unite","frequence_pm","statut_pm","statut_panne",
   "area_SG01","area_SG02","equipement_SG01","equipement_SG02"])assert.ok(names.includes(t),t);
 assert.ok(!names.includes("groupe"));
 assert.equal(REFERENCE_TABS.find(x=>x[0]==="unite")[1],"Localisations");
});
test("Accès : aucune lecture/écriture sans compte admin",async()=>{
 const fx=fixtures();
 try{
  for(const [verb,path,params] of [
   ["GET","/api/settings/references",{}],
   ["POST","/api/settings/references",{}],
   ["PUT","/api/settings/references/:id",{id:"1"}],
   ["DELETE","/api/settings/references/:id",{id:"1"}],
   ["GET","/api/settings/backup",{}],
   ["GET","/api/settings/backup/global",{}],
   ["POST","/api/settings/restore/:action",{action:"preview"}]
  ]){
   const response=await fx.call(verb,path,{params,user:{role:"technicien",id:"user-admin"}});
   assert.equal(response.statusCode,403,verb+" "+path);
  }
  assert.equal(fx.events.length,0);
 }finally{fx.restore();}
});
test("Accès : rôle admin désactivé/révoqué dans Supabase interdit les changements",async()=>{
 const fx=fixtures();
 try{
  fx.db.effectif[0].role="technicien";
  const changed=await fx.call("POST","/api/settings/references",{body:{type_liste:"service",valeur:"Test"}});
  assert.equal(changed.statusCode,403);
  fx.db.effectif[0].role="admin";fx.db.effectif[0].actif=false;
  const blocked=await fx.call("GET","/api/settings/references");
  assert.equal(blocked.statusCode,403);
  assert.equal(fx.events.length,0);
 }finally{fx.restore();}
});
test("Ajout, édition, suppression et protection usages",async()=>{
 const fx=fixtures();
 try{
  let r=await fx.call("GET","/api/settings/references");
  assert.equal(r.statusCode,200,JSON.stringify(r.body));
  const electricity=r.body.find(x=>x.valeur==="Électricité");
  assert.ok(electricity.usage>=1);
  const added=await fx.call("POST","/api/settings/references",{body:{type_liste:"zone",valeur:"Nouveau local"}});
  assert.equal(added.statusCode,201);
  const ref=added.body;
  r=await fx.call("PUT","/api/settings/references/:id",{
   params:{id:String(ref.id)},body:{type_liste:"zone",valeur:"Local essais"}});
  assert.equal(r.statusCode,200);
  r=await fx.call("DELETE","/api/settings/references/:id",{params:{id:String(ref.id)}});
  assert.equal(r.statusCode,200);
  assert.ok(fx.events.some(x=>x.action==="delete"));
 }finally{fx.restore();}
});
test("Backup des références : vrai XLSX relisible sans données utilisateur",async()=>{
 const fx=fixtures();
 try{
  const r=await fx.call("GET","/api/settings/backup");
  assert.equal(r.statusCode,200);
  const rows=readXlsx(r.binary);
  assert.deepEqual(rows[0],["type_liste","valeur","site","ordre","actif"]);
  assert.ok(rows.some(x=>x[1]==="Électricité"));
  assert.ok(!r.binary.toString("utf8").includes("password_hash"));
 }finally{fx.restore();}
});
test("Restauration : aperçu, confirmation hash et fusion des absents",async()=>{
 const fx=fixtures();
 try{
  const bytes=makeXlsx(["type_liste","valeur","parent","ordre","actif"],
   [["service","Électricité","",0,"Oui"],["zone","Local administratif","",1,"Oui"]]);
  const file=bytes.toString("base64");
  const preview=await fx.call("POST","/api/settings/restore/:action",{params:{action:"preview"},body:{file}});
  assert.equal(preview.statusCode,200);
  assert.equal(preview.body.creations,1);
  assert.equal(preview.body.duplicates,1);
  assert.equal(fx.events.filter(e=>e.action==="add").length,0);
  const fail=await fx.call("POST","/api/settings/restore/:action",{
   params:{action:"fusion"},body:{file,hash:"invalid"}});
  assert.equal(fail.statusCode,400);
  const okay=await fx.call("POST","/api/settings/restore/:action",{
   params:{action:"fusion"},body:{file,hash:preview.body.hash}});
  assert.equal(okay.statusCode,200,JSON.stringify(okay.body));
  assert.equal(okay.body.imported,1);
  assert.ok(fx.refs.some(r=>r.valeur==="Local administratif"));
 }finally{fx.restore();}
});
test("Références actives lisibles par les techniciens pour les sélecteurs",async()=>{
 const fx=fixtures();
 try{
  const result=await fx.call("GET","/api/references/active",{user:{role:"technicien",id:"e1"}});
  assert.equal(result.statusCode,200);
  assert.ok(result.body.every(r=>!("id" in r)));
 }finally{fx.restore();}
});

test("Sauvegarde globale : classeur multifeuille, lecture seule et sans compte secret",async()=>{
 const fx=fixtures();
 try{
  const r=await fx.call("GET","/api/settings/backup/global");
  assert.equal(r.statusCode,200,JSON.stringify(r.body));
  assert.equal(r.binary?.subarray(0,2).toString(),"PK");
  const rows=readXlsx(r.binary);
  assert.equal(rows[0][0],"Champ");
  assert.ok(rows.some(x=>x[0]==="Application"));
  assert.ok(rows.some(x=>x[0]==="Sécurité"));
  assert.ok(fx.events.every(x=>x.action==="list"));
 }finally{fx.restore();}
});
