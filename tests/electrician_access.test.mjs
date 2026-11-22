import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";
import {
 isAdmin,isLead,sameDepartment,machineInDepartment,panneInDepartment,
 pmInDepartment,panneEditable,nameAccess,permissionAllowed
} from "../client/src/accessPolicy.js";
import {localisationSite,SITES} from "../client/src/locationModel.js";
import {pmVisibility} from "../client/src/pmVisibility.js";
const src=readFileSync(new URL("../server/server.js",import.meta.url),"utf8");
const extract=(start,end)=>{
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a, "Missing server section: "+start);
 return src.slice(a,b);
};
const employees=[
 {id:"e1",nom:"Touati",prenom:"Leila",service:"Électricité",role:"technicien",password_hash:"SECRET"},
 {id:"e2",nom:"Kader",prenom:"Omar",service:"Maintenance",role:"technicien"},
 {id:"e3",nom:"Haddad",prenom:"Youssef",service:"Électricité",role:"technicien"},
 {id:"e4",nom:"Haddad",prenom:"Youssef",service:"Maintenance",role:"technicien"}
];
const pannes=[
 {id:1,unite:"U1",service:"Maintenance",technicien:"TOUATI Leila"},
 {id:2,unite:"U1",service:"Maintenance",technicien:"Kader Omar"},
 {id:3,unite:"U1",service:"Électricité",technicien:"Touati Leila"},
 {id:4,unite:"U1",service:"Maintenance",technicien:"Haddad Youssef"},
 {id:5,unite:"U2",service:"Électricité",technicien:"Touati Leila"}
];
const pm=[
 {id:11,unite:"U1",service_intervenant:"Électricité"},
 {id:12,unite:"U1",service_intervenant:"Maintenance"},
 {id:13,unite:"U1",service_intervenant:null,responsable:"Touati Leila"},
 {id:14,unite:"U1",service_intervenant:""},
 {id:15,unite:"U2",service_intervenant:"Électricité"}
];
const links=employees.map(e=>({effectif_id:e.id,unite:"U1"}));
const ctx=createContext({
 supabaseReadAll:async table=>({pannes,pm_programmees:pm,machines:[]}[table]||[]),
 supabaseRequest:async table=>({effectif:employees,effectif_unites:links}[table]||[]),
 allowedUnitsForUser:async()=>["U1"],
 visibleMachineRows:async()=>[],pmVisibility,
 isAdmin,isLead,sameDepartment,machineInDepartment,panneInDepartment,pmInDepartment,panneEditable,nameAccess,permissionAllowed,
 localisationSite,SITES,console
});
runInContext(extract("const normService =","async function remoteEffectifWithUnits(user)"),ctx);
runInContext(extract("async function remoteEffectifWithUnits(user)","function machineFieldsFromBody"),ctx);
runInContext(extract("async function legacyPanneOwnerNames(user)","function currentUser(req)"),ctx);
const electrician={id:"e1",supabase_id:"e1",role:"technicien",service:"Électricité",nom:"Touati",prenom:"Leila"};
const lead={...electrician,fonction:"Electrical Shift Leader"};
const mechanic={id:"e2",role:"technicien",service:"Maintenance",nom:"Kader",prenom:"Omar"};
const admin={id:"admin",role:"admin",service:"Maintenance"};

test("Électricité : seules les pannes de son département et localisation",async()=>{
 assert.deepEqual((await ctx.remoteModuleRows("liste",electrician)).map(x=>x.id),[3]);
 assert.deepEqual((await ctx.remoteModuleRows("liste",mechanic)).map(x=>x.id),[1,2,4]);
 assert.equal((await ctx.remoteModuleRows("liste",electrician))[0].peut_modifier,true);
});
test("PM anciennes sans département : jamais attribuées automatiquement",async()=>{
 assert.deepEqual((await ctx.remoteModuleRows("pm",electrician)).map(x=>x.id),[11]);
 assert.deepEqual((await ctx.remoteModuleRows("pm",mechanic)).map(x=>x.id),[12]);
});
test("Effectif : visibilité des responsables limitée à département et localisation",async()=>{
 const tech=await ctx.remoteEffectifWithUnits(electrician);
 assert.equal(tech.length,0);
 const team=await ctx.remoteEffectifWithUnits(lead);
 assert.deepEqual(team.map(x=>x.id),["e1","e3"]);
 assert.ok(team.every(x=>!("password_hash" in x)));
 assert.equal((await ctx.remoteEffectifWithUnits(admin)).length,4);
});
test("Shift Leader peut modifier les pannes de son département, pas les autres",async()=>{
 const team=await ctx.remoteModuleRows("liste",lead);
 assert.deepEqual(team.map(x=>x.id),[3]);
 assert.equal(team[0].peut_modifier,true);
});
test("Nom historique ambigu : aucune propriété implicite d'une panne",async()=>{
 assert.equal((await ctx.legacyPanneOwnerNames({id:"e3",role:"technicien",nom:"Haddad",prenom:"Youssef",service:"Maintenance"})).size,0);
});
