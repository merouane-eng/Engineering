import {test,expect} from "@playwright/test";

const APP_URL="http://127.0.0.1:4173";
const LOCS=["U1","U6","QC__S01","QC__S02","MICROBIOLOGIE__S01","MICROBIOLOGIE__S02"];
const machines=[
 {id:1,tag:"BASE-001",designation:"Pompe",unite:"U1",site:"Site 01",zone:"Production",actif:1},
 {id:2,tag:"QC-001",designation:"Analyseur QC",unite:"QC__S01",site:"Site 01",zone:"Laboratoire",actif:1},
 {id:3,tag:"QC-002",designation:"Analyseur QC",unite:"QC__S02",site:"Site 02",zone:"Laboratoire",actif:1},
 {id:4,tag:"MICRO-001",designation:"Incubateur",unite:"MICROBIOLOGIE__S01",site:"Site 01",zone:"Laboratoire",actif:1},
 {id:5,tag:"MICRO-002",designation:"Incubateur",unite:"MICROBIOLOGIE__S02",site:"Site 02",zone:"Laboratoire",actif:1}
];
const personnel={id:"emp-01",matricule:"TEST-001",nom:"Benk",prenom:"Leila",service:"Électricité",fonction:"Électricienne",
  initiale:"LB",site:"Site 02",units:["QC__S02"],actif:true,toutes_unites:false,type_contrat:"CDI"};
const pm=machines.slice(1,3).map((m,i)=>({id:i+10,machine_tag:m.tag,machine_designation:m.designation,
 unite:m.unite,service_intervenant:"Électricité",date_prevue:"2026-11-25",statut:"Planifiée",frequence:"MONTHLY",responsable:"Benk Leila"}));
const pannes=[{id:12,wo:"WO-TEST-01",unite:"QC__S02",machine:"QC-002",statut:"Open",probleme:"Courant faible",service:"Électricité",technicien:"Benk Leila",date_panne:"2026-11-18",area:"Laboratoire",downtime:45}];
const refs=LOCS.map((valeur,id)=>({id:id+1,type_liste:"unite",valeur,actif:true,usage:1,site:/__S02$|^U6$/.test(valeur)?"Site 02":"Site 01",parent:null}));
function mocked(path){
 if(path==="/api/modules/machines")return machines;
 if(path==="/api/references/active")return [...refs,{type_liste:"zone",valeur:"Laboratoire",actif:true}];
 if(path==="/api/modules/effectif")return [personnel];
 if(path==="/api/effectif/context")return {units:LOCS,services:["Électricité"],functions:["Électricienne"]};
 if(path==="/api/settings/references")return refs;
 if(path==="/api/modules/pm")return pm;
 if(path==="/api/modules/liste"||path==="/api/modules/saisie")return pannes;
 if(path==="/api/modules/operating")return [];
 if(path==="/api/saisie/context")return {units:LOCS,machines,services:["Électricité"],zones:["Laboratoire"],technicians:[{name:"Benk Leila",service:"Électricité"}],technician:"Benk Leila",service:"Électricité"};
 if(path==="/api/pm/context")return {units:LOCS,machines,technician:"Benk Leila",technicians:[{name:"Benk Leila"}],frequencies:["MONTHLY"],services:["Électricité"]};
 if(path==="/api/operating/context")return {units:LOCS,machines,operator:"Benk Leila"};
 if(path==="/api/stats/overview")return {pannes,pm,operating:[],machines,units:LOCS,scope:{electricite:false}};
 if(path==="/api/dashboard")return {machines:5,techniciens:1,pannesOuvertes:1,pannesFermees:0,pmProgrammee:2,pmRealisees:0,recentPannes:pannes,upcomingPM:pm,month:"2026-11"};
 if(path==="/api/pieces/context")return {catalog:[],machineParts:[],history:[]};
 if(path==="/api/supabase/status")return {linked:true};
 if(path==="/api/auth/usernames")return ["admin"];
 return [];
}
for(const size of [{width:390,height:844},{width:1366,height:768}]){
 test("Localisations Site 01/02 sans Groupe — "+size.width+" px",async({browser})=>{
  const context=await browser.newContext({viewport:size,serviceWorkers:"block"});
  const page=await context.newPage(),errors=[],saves=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem("engineering_token","test-location");
   localStorage.setItem("engineering_user",JSON.stringify({id:"emp-01",role:"admin",nom:"Benk",prenom:"Leila",site:"Site 01"}));
  });
  await page.route("**/api/**",route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(path==="/api/tables/machines"&&req.method()==="POST"){
     saves.push(req.postDataJSON());
     return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({...req.postDataJSON(),id:90})});
   }
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(mocked(path))});
  });
  await page.goto(APP_URL);
  const navigate=async id=>{
   if(size.width<=800)await page.locator(".mobileMenu").click();
   await page.locator("aside .module-"+id).click();
  };
  await navigate("machines");
  await expect(page.getByRole("heading",{name:"Parc machines"})).toBeVisible();
  await expect(page.getByText("GROUPE",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Groupe",{exact:true})).toHaveCount(0);
  await expect(page.locator(".mm-machineMeta span").filter({hasText:"QC"}).first()).toBeVisible();
  await page.getByRole("button",{name:/Ajouter une machine/}).click();
  await expect(page.locator(".machineForm")).toBeVisible();
  await expect(page.locator(".machineForm").getByText("Localisation *")).toBeVisible();
  await expect(page.locator(".machineForm").getByText("Groupe")).toHaveCount(0);
  await page.locator(".machineForm select").first().selectOption("Site 02");
  await page.locator(".machineForm select").nth(1).selectOption("QC__S02");
  await page.locator(".machineForm input").nth(0).fill("TEST-QC-S02");
  await page.locator(".machineForm input").nth(1).fill("Machine laboratoire QC Site 02");
  await page.locator(".machineForm button[type='submit']").click();
  await expect(page.locator(".machineForm")).toHaveCount(0);
  expect(saves.length).toBe(1);
  expect(saves[0].site).toBe("Site 02");
  expect(saves[0].unite).toBe("QC__S02");
  expect("groupe" in saves[0]).toBe(false);
  await navigate("pm");
  await expect(page.getByText("QC · Site 01",{exact:true}).first()).toBeVisible();
  await navigate("liste");
  await expect(page.getByText("QC · Site 02",{exact:true}).first()).toBeVisible();
  await navigate("effectif");
  await expect(page.getByText("Localisation",{exact:false}).first()).toBeVisible();
  await navigate("stats");
  await expect(page.getByText("Localisation",{exact:false}).first()).toBeVisible();
  await navigate("parametres");
  await expect(page.getByRole("tab",{name:/Localisations/})).toBeVisible();
  await expect(page.getByRole("tab",{name:/Groupes/})).toHaveCount(0);
  await page.getByRole("tab",{name:/Localisations/}).click();
  await expect(page.getByText("Site 02",{exact:true}).first()).toBeVisible();
  expect(errors,"Erreurs React "+errors.join(" | ")).toEqual([]);
  await context.close();
 });
}
