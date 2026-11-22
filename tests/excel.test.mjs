import test from "node:test";
import assert from "node:assert/strict";
import { makeXlsx,readXlsx } from "../server/excel.js";
import { EXCEL_MODULES,registerExcelRoutes } from "../server/bulkExcel.js";

function createHarness() {
  const routes={};
  const app={
    get(path,...handlers){routes["GET "+path]=handlers;},
    post(path,...handlers){routes["POST "+path]=handlers;}
  };
  const data={
    machines:[{id:11,tag:"M-1",designation:"Moteur",unite:"U3-1",groupe:"Ligne",zone:"Production",actif:1}],
    effectif:[{id:"uuid-1",matricule:"A100",nom:"Ancien",prenom:"Amel",service:"Électricité",
      fonction:"Électricien",role:"admin",actif:true,initiale:"AA",type_contrat:"CDI",date_fin_contrat:null}],
    effectif_unites:[{effectif_id:"uuid-1",unite:"U3-1"}],
    pannes:[],pm_programmees:[],operating_time:[]
  };
  const writes=[];
  async function request(table,{method="GET",query="",body}={}){
    if(method==="GET"){
      let rows=data[table]||[];
      if(query.includes("&id=eq.")){
        const id=decodeURIComponent(query.split("&id=eq.")[1].split("&")[0]);
        rows=rows.filter(row=>String(row.id)===id);
      }
      if(query.includes("offset=")){
        const offset=Number(query.split("offset=")[1].split("&")[0]);
        rows=rows.slice(offset,offset+1000);
      }
      return rows;
    }
    writes.push({table,method,body,query});
    if(method==="PATCH"){
      const id=decodeURIComponent(query.split("?id=eq.")[1].split("&")[0]);
      const row=data[table].find(r=>String(r.id)===id);
      if(!row)return [];
      Object.assign(row,body);return [{id:row.id}];
    }
    if(method==="POST"){
      const list=Array.isArray(body)?body:[body];
      for(const row of list)data[table].push({...row,id:table==="effectif"?"uuid-"+(data[table].length+1):data[table].length+12});
      return list.map((r,i)=>({id:table==="effectif"?"uuid-"+data[table].length:data[table].length,...r}));
    }
    throw new Error("Method "+method);
  }
  registerExcelRoutes(app,{
    requireAuth:(req,res,next)=>next(),
    supabaseRequest:request,
    remoteEffectifWithUnits:async()=>data.effectif.map(r=>({...r,units:data.effectif_unites.filter(u=>u.effectif_id===r.id).map(u=>u.unite)})),
    localTimestamp:()=>new Date().toISOString()
  });
  function response(){
    return {statusCode:200,headers:{},
      status(value){this.statusCode=value;return this;},
      set(name,value){this.headers[name]=value;return this;},
      json(value){this.body=value;return this;},
      send(value){this.binary=value;return this;}
    };
  }
  async function run(method,path,{user={role:"admin",id:"uuid-1",supabase_id:"uuid-1"},params={},body={}}={}){
    const handlers=routes[method+" "+path];
    assert.ok(handlers,"Route missing "+method+" "+path);
    const req={user,params,body},res=response();
    for(const handler of handlers){
      let nextCalled=false;
      await handler(req,res,()=>{nextCalled=true;});
      if(handler===handlers.at(-1)||!nextCalled)break;
    }
    return res;
  }
  return {run,data,writes,routes};
}
function xlsx(fields,rows){return makeXlsx(fields,rows,{instructions:[["Test","Ne pas importer en production."]]}).toString("base64");}
test("XLSX : véritable fichier ZIP Office OpenXML, valeurs FR et Unicode",()=>{
  const content=makeXlsx(["matricule","initiale","type_contrat"],
    [["TEST-001","ÉL","CDI"],["TEST-002","","CDD"],["SAFE-003","=1+1","CDI"]],
    {name:"Effectif",instructions:[["Initiale","Facultative"]]});
  assert.equal(content.subarray(0,2).toString(),"PK");
  const rows=readXlsx(content);
  assert.deepEqual(rows[0],["matricule","initiale","type_contrat"]);
  assert.deepEqual(rows[1],["TEST-001","ÉL","CDI"]);
  assert.deepEqual(rows[2],["TEST-002","","CDD"]);
  assert.equal(rows[3][1],"=1+1");
});
test("XLSX rejette un faux fichier et n'exécute pas de formule",()=>{
  assert.throws(()=>readXlsx(Buffer.from("faux")),/XLSX|non valide/i);
});
test("Admin uniquement : le rôle utilisateur ne suffit pas si révoqué en base",async()=>{
  const h=createHarness();
  let r=await h.run("GET","/api/excel/catalogue",{user:{role:"technicien",id:"uuid-1"}});
  assert.equal(r.statusCode,403);
  assert.equal(h.writes.length,0);
  h.data.effectif[0].role="technicien";
  r=await h.run("GET","/api/excel/catalogue");
  assert.equal(r.statusCode,403);
  h.data.effectif[0].role="admin";
  r=await h.run("GET","/api/excel/catalogue");
  assert.equal(r.statusCode,200);
  assert.equal(r.body.length,5);
});
test("Machines : prévisualisation sans modification, doublon ignoré puis import après hash",async()=>{
  const h=createHarness();
  const file=xlsx(["tag","designation","unite","actif"],
    [["M-1","Modifié","U3-1","Non"],["M-2","Éclairage","U3-1","Oui"]]);
  const params={module:"machines",action:"preview"};
  let r=await h.run("POST","/api/excel/:module/:action",{params,body:{file}});
  assert.equal(r.statusCode,200);
  assert.equal(r.body.creations,1);
  assert.equal(r.body.duplicates,1);
  assert.equal(h.writes.length,0);
  const hash=r.body.hash;
  r=await h.run("POST","/api/excel/:module/:action",{params:{module:"machines",action:"import"},body:{file,hash:"wrong"}});
  assert.equal(r.statusCode,409);
  assert.equal(h.writes.length,0);
  r=await h.run("POST","/api/excel/:module/:action",{params:{module:"machines",action:"import"},body:{file,hash}});
  assert.equal(r.statusCode,200,r.body.error);
  assert.equal(r.body.imported,1);
  assert.equal(h.data.machines.length,2);
  assert.equal(h.data.machines[0].designation,"Moteur");
});
test("Effectif : la mise à jour RH ne touche ni au rôle ni aux affectations",async()=>{
  const h=createHarness();
  const file=xlsx(["matricule","initiale","site","type_contrat","date_fin_contrat"],
    [["A100","AZ","Site 01","CDD","2027-07-31"]]);
  let r=await h.run("POST","/api/excel/:module/:action",
    {params:{module:"effectif",action:"preview"},body:{file}});
  assert.equal(r.statusCode,200,JSON.stringify(r.body));
  assert.equal(r.body.updates,1);
  const hash=r.body.hash;
  r=await h.run("POST","/api/excel/:module/:action",
    {params:{module:"effectif",action:"import"},body:{file,hash}});
  assert.equal(r.statusCode,200,JSON.stringify(r.body));
  assert.equal(r.body.updated,1);
  assert.equal(h.data.effectif[0].role,"admin");
  assert.equal(h.data.effectif[0].nom,"Ancien");
  assert.equal(h.data.effectif[0].initiale,"AZ");
  assert.equal(h.data.effectif[0].date_fin_contrat,"2027-07-31");
  assert.equal(h.data.effectif_unites.length,1);
});
test("Effectif : initiale vide admise, CDD sans date rejeté sans écriture",async()=>{
  const h=createHarness();
  const file=xlsx(["matricule","nom","prenom","service","fonction","initiale","type_contrat","date_fin_contrat"],
    [["NEW-001","Nouveau","Lina","Électricité","Technicienne","","CDD",""]]);
  const r=await h.run("POST","/api/excel/:module/:action",
    {params:{module:"effectif",action:"preview"},body:{file}});
  assert.equal(r.body.errors.length,1);
  assert.match(r.body.errors[0].message,/Date de fin/);
  assert.equal(h.writes.length,0);
});
test("Exports : les colonnes systèmes et mots de passe ne sont jamais inclus",async()=>{
  const h=createHarness();
  h.data.effectif[0].password_hash="secret";
  const response=await h.run("GET","/api/excel/:module/:action",
    {params:{module:"effectif",action:"export"}});
  assert.equal(response.statusCode,200);
  const rows=readXlsx(response.binary);
  assert.ok(rows[0].includes("initiale"));
  assert.ok(rows[0].includes("date_fin_contrat"));
  assert.ok(!rows[0].includes("password_hash"));
  assert.ok(!rows[0].includes("role"));
});
test("Sécurité : interdire les colonnes sensibles dans les fichiers importés",async()=>{
  const h=createHarness();
  const file=xlsx(["tag","designation","unite","password_hash"],
    [["M-5","Test","U1","admin"]]);
  const res=await h.run("POST","/api/excel/:module/:action",
    {params:{module:"machines",action:"preview"},body:{file}});
  assert.equal(res.statusCode,400);
  assert.match(res.body.error,/interdites/);
  assert.equal(h.writes.length,0);
});
test("Templates XLSX : les cinq modules ont tous leurs champs sans données",async()=>{
  const h=createHarness();
  for(const module of Object.keys(EXCEL_MODULES)){
    const response=await h.run("GET","/api/excel/:module/:action",
      {params:{module,action:"template"}});
    assert.equal(response.statusCode,200,module+" "+response.body?.error);
    const rows=readXlsx(response.binary);
    assert.deepEqual(rows[0],EXCEL_MODULES[module].fields.map(x=>x==="unite"?"Localisation":x==="unites"?"Localisations":x));
    assert.equal(rows.length,1);
  }
});

test("La limite de 1 000 lignes est identique pour les cinq modules Excel",async()=>{
  const day=i=>new Date(Date.UTC(2027,0,1+i)).toISOString().slice(0,10);
  const cases=[
    ["machines",["tag","designation","unite"],i=>["EX-"+i,"Machine test","U3-1"]],
    ["effectif",["matricule","nom","prenom","service","fonction"],i=>["EMP-"+i,"Nom","Prénom","Électricité","Technicien"]],
    ["pannes",["wo","date_panne","unite","machine","probleme"],i=>["WO-"+i,"2027-01-01","U3-1","M-1","Test"]],
    ["pm",["machine_tag","unite","frequence","date_prevue"],i=>["M-1","U3-1","Mensuelle",day(i)]],
    ["operating",["machine","date_jour","heures_marche"],i=>["M-1",day(i),"8"]]
  ];
  for(const [module,columns,row] of cases){
    const h=createHarness();
    const values=Array.from({length:1000},(_,i)=>row(i));
    const file=xlsx(columns,values);
    const ok=await h.run("POST","/api/excel/:module/:action",
      {params:{module,action:"preview"},body:{file}});
    assert.equal(ok.statusCode,200,module+": "+ok.body.error);
    assert.equal(ok.body.total,1000,module);
    assert.equal(ok.body.errors.length,0,module+": "+JSON.stringify(ok.body.errors.slice(0,2)));
    assert.equal(h.writes.length,0,module+" preview must not write");
    const over=await h.run("POST","/api/excel/:module/:action",
      {params:{module,action:"preview"},body:{file:xlsx(columns,[...values,row(1000)])}});
    assert.equal(over.statusCode,400,module);
    assert.match(over.body.error,/Maximum 1000 lignes/,module);
    assert.equal(h.writes.length,0,module+" rejected upload must not write");
  }
});
test("Import Excel par lots : aucune ligne extérieure au lot n'est écrite",async()=>{
  const h=createHarness();
  const values=Array.from({length:120},(_,i)=>["LOT-"+i,"Équipement","U3-1"]);
  const file=xlsx(["tag","designation","unite"],values);
  const preview=await h.run("POST","/api/excel/:module/:action",
    {params:{module:"machines",action:"preview"},body:{file}});
  assert.equal(preview.statusCode,200);
  const write=async(start,size)=>h.run("POST","/api/excel/:module/:action",
    {params:{module:"machines",action:"import"},body:{file,hash:preview.body.hash,batchStart:start,batchSize:size}});
  let r=await write(0,50);
  assert.equal(r.statusCode,200);
  assert.equal(r.body.imported,50);
  assert.equal(h.data.machines.length,51);
  r=await write(50,50);
  assert.equal(r.body.imported,50);
  r=await write(100,20);
  assert.equal(r.body.imported,20);
  assert.equal(h.data.machines.length,121);
  r=await write(0,50);
  assert.equal(r.body.imported,0);
  assert.equal(h.data.machines.length,121);
  const invalid=await write(0,101);
  assert.equal(invalid.statusCode,400);
  assert.equal(h.data.machines.length,121);
});
