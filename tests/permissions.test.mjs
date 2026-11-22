import test from "node:test";
import assert from "node:assert/strict";
import {resolvePermissions,permissionAllowed,permittedModule,isAdmin} from "../client/src/accessPolicy.js";
import {createAccessManager,sanitizeAccessRules} from "../server/accessSettings.js";

const tech={id:"11111111-1111-4111-8111-111111111111",role:"technicien",
  fonction:"Electrical Technician 2",service:"Électricité"};
const admin={...tech,id:"22222222-2222-4222-8222-222222222222",role:"admin"};

test("Droits par défaut : les anciennes permissions des techniciens et responsables restent intactes",()=>{
  assert.equal(permittedModule(tech,"machines"),true);
  assert.equal(permittedModule(tech,"effectif"),false);
  assert.equal(permissionAllowed(tech,"saisie","create"),true);
  assert.equal(permissionAllowed(tech,"machines","create"),false);
  assert.equal(permissionAllowed(tech,"pm","edit"),true);
  assert.equal(permissionAllowed(tech,"parametres","view"),false);
  assert.equal(permissionAllowed({...tech,fonction:"Electrical Shift Leader"},"pm","create"),true);
  assert.equal(permissionAllowed(admin,"parametres","view"),true);
});

test("Héritage : rôle puis fonction puis personne ; masquer le module bloque aussi les mutations",()=>{
  const rules=[
    {scope:"role",subject:"technicien",rules:{machines:{view:true,create:true},effectif:{view:true}}},
    {scope:"fonction",subject:"electrical technician 2",rules:{machines:{create:false},effectif:{view:false}}},
    {scope:"personne",subject:tech.id,rules:{machines:{create:true},effectif:{view:true,edit:true}}}
  ];
  const permissions=resolvePermissions(tech,rules),user={...tech,permissions};
  assert.equal(permissionAllowed(user,"machines","create"),true);
  assert.equal(permissionAllowed(user,"effectif","view"),true);
  assert.equal(permissionAllowed(user,"effectif","edit"),true);
  const denied=resolvePermissions(tech,[{scope:"personne",subject:tech.id,rules:{machines:{view:false,create:true,edit:true}}}]);
  assert.equal(denied.machines.view,false);
  assert.equal(denied.machines.create,false);
  assert.equal(denied.machines.edit,false);
});

test("Le compte administrateur et les Paramètres ne sont jamais déverrouillés par une règle",()=>{
  const attack=[{scope:"personne",subject:tech.id,rules:{parametres:{view:true}}}];
  const got=resolvePermissions(tech,attack);
  assert.equal(got.parametres.view,false);
  assert.equal(resolvePermissions(admin,attack).parametres.view,true);
  assert.equal(permissionAllowed({...admin,permissions:{parametres:{view:false}}},"parametres","view"),true);
});

test("L'API refuse de stocker des modules inconnus, droits invalides et Paramètres",()=>{
  assert.deepEqual(sanitizeAccessRules({machines:{view:true,create:false}}),{machines:{view:true,create:false}});
  assert.throws(()=>sanitizeAccessRules({parametres:{view:true}}),/non paramétrable/);
  assert.throws(()=>sanitizeAccessRules({admin:{edit:true}}),/non paramétrable/);
  assert.throws(()=>sanitizeAccessRules({machines:{delete:true}}),/invalide/);
  assert.throws(()=>sanitizeAccessRules({machines:{view:"oui"}}),/invalide/);
});

test("Gestion des règles : admin vérifié dans Supabase, aucun changement de rôle possible par un technicien",async()=>{
  const old=process.env.ENGINEERING_REFERENCES_SECRET;
  process.env.ENGINEERING_REFERENCES_SECRET="test-only-secret";
  try{
    const saved=[];
    const people=[{id:admin.id,role:"admin",actif:true,fonction:"Manager"},
      {...tech,actif:true,nom:"Test",prenom:"Personne"}];
    const supabaseRequest=async(table,options={})=>{
      if(table==="effectif"){
        const id=options.query?.match(/id=eq\.([^&]+)/)?.[1];
        return id?people.filter(p=>p.id===id):people;
      }
      if(table==="rpc/engineering_permissions_rpc"){
        saved.push(options.body);
        if(options.body.p_action==="list"||options.body.p_action==="resolve")return [];
        return {scope:options.body.p_scope,subject:options.body.p_subject,rules:options.body.p_rules};
      }
      throw new Error("table "+table);
    };
    const routes={},app={
      get(path,...callbacks){routes["GET "+path]=callbacks;},
      put(path,...callbacks){routes["PUT "+path]=callbacks;}
    };
    const manager=createAccessManager({supabaseRequest});
    manager.register(app,(req,res,next)=>next());
    const call=async(method,path,user,body={})=>{
      const req={user,body},res={statusCode:200,
        status(code){this.statusCode=code;return this;},
        json(val){this.body=val;return this;}};
      for(const handler of routes[method+" "+path]){
        let advanced=false;
        await handler(req,res,()=>{advanced=true;});
        if(!advanced)break;
      }
      return res;
    };
    const denied=await call("PUT","/api/settings/access",tech,{scope:"role",subject:"technicien",rules:{machines:{view:false}}});
    assert.equal(denied.statusCode,403);
    let good=await call("PUT","/api/settings/access",admin,{scope:"role",subject:"technicien",rules:{machines:{view:false}}});
    assert.equal(good.statusCode,200);
    assert.equal(saved.at(-1).p_subject,"technicien");
    good=await call("PUT","/api/settings/access",admin,{scope:"personne",subject:admin.id,rules:{machines:{view:false}}});
    assert.equal(good.statusCode,400);
    const invalid=await call("PUT","/api/settings/access",admin,{scope:"role",subject:"admin",rules:{machines:{edit:false}}});
    assert.equal(invalid.statusCode,400);
    const resolved=await manager.resolve(tech);
    assert.equal(resolved.machines.view,true);
  }finally{
    if(old===undefined)delete process.env.ENGINEERING_REFERENCES_SECRET;
    else process.env.ENGINEERING_REFERENCES_SECRET=old;
  }
});
