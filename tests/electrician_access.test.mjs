import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const src = readFileSync(new URL("../server/server.js",import.meta.url),"utf8");
const section=(start,end)=>{
  const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a, "Section serveur introuvable: "+start);
  return src.slice(a,b);
};
const employees=[
  {id:"e1",nom:"Touati",prenom:"Leila",service:"Électricité",password_hash:"NE PAS DIVULGUER",role:"technicien"},
  {id:"e2",nom:"Kader",prenom:"Omar",service:"Mécanique",role:"technicien"},
  {id:"e3",nom:"Haddad",prenom:"Youssef",service:"Électricité",role:"technicien"},
  {id:"e4",nom:"Haddad",prenom:"Youssef",service:"Mécanique",role:"technicien"}
];
const pannes=[
  {id:1,unite:"U1",service:"Maintenance",technicien:"TOUATI Leila"},
  {id:2,unite:"U1",service:"Maintenance",technicien:"Kader Omar"},
  {id:3,unite:"U1",service:"Électricité",technicien:"Non renseigné"},
  {id:4,unite:"U1",service:"Maintenance",technicien:"Haddad Youssef"},
  {id:5,unite:"U2",service:"Électricité",technicien:"Touati Leila"}
];
const pm=[
  {id:11,unite:"U1",service_intervenant:"Électricité"},
  {id:12,unite:"U1",service_intervenant:"Mécanique",responsable:"Touati Leila"},
  {id:13,unite:"U1",responsable:"Touati Leila"},
  {id:14,unite:"U1",responsable:""},
  {id:15,unite:"U2",service_intervenant:"Électricité"}
];
const ctx=createContext({
  supabaseRequest:async table=>({
    effectif:employees,effectif_unites:[{effectif_id:"e1",unite:"U1"},{effectif_id:"e2",unite:"U1"}],
    pannes,pm_programmees:pm
  }[table]||[]),
  allowedUnitsForUser:async()=>["U1"],
  console
});
runInContext(section("const normService =","async function remoteEffectifWithUnits(user)"),ctx);
runInContext(section("async function remoteEffectifWithUnits(user)","function machineFieldsFromBody"),ctx);
runInContext(section("async function remoteModuleRows(module, user)","function currentUser"),ctx);
const electricians={role:"technicien",service:"Électricité"};
const mechanical={role:"technicien",service:"Mécanique"};
const admin={role:"admin",service:"Électricité"};

test("Service Électricité détecté par session, pas par rôle admin",()=>{
  assert.equal(runInContext('isElectrician({role:"technicien",service:"Électricité"})',ctx),true);
  assert.equal(runInContext('isElectrician({role:"technicien",service:"Mécanique"})',ctx),false);
  assert.equal(runInContext('isElectrician({role:"admin",service:"Électricité"})',ctx),false);
});
test("Effectif : uniquement les électriciens et jamais le hash du mot de passe",async()=>{
  const rows=await ctx.remoteEffectifWithUnits(electricians);
  assert.deepEqual(rows.map(r=>r.id),["e1","e3"]);
  assert.ok(rows.every(row=>!("password_hash" in row)));
  assert.equal((await ctx.remoteEffectifWithUnits(admin)).length,4);
});
test("Pannes : uniquement celles du métier et des unités autorisées",async()=>{
  assert.deepEqual((await ctx.remoteModuleRows("liste",electricians)).map(r=>r.id),[1,3]);
  assert.deepEqual((await ctx.remoteModuleRows("saisie",electricians)).map(r=>r.id),[1,3]);
  assert.equal((await ctx.remoteModuleRows("liste",mechanical)).length,4);
});
test("PM : pas de mélange de service, PM historiques non attribuées masquées",async()=>{
  assert.deepEqual((await ctx.remoteModuleRows("pm",electricians)).map(r=>r.id),[11,13]);
  assert.equal((await ctx.remoteModuleRows("pm",mechanical)).length,4);
});
test("Noms ambigus multi-services : aucune divulgation des pannes Maintenance",async()=>{
  const names=await ctx.electricServiceNames();
  assert.equal(names.has("haddad youssef"),false);
  assert.equal(names.has("touati leila"),true);
});
