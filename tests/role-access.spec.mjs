import {test,expect} from "@playwright/test";
const APP="http://127.0.0.1:4173";
const machine={id:1,tag:"M-001",designation:"Pompe",unite:"U1",site:"Site 01",departement:"Maintenance",zone:"Production",actif:1};
const base={id:"emp-tech",matricule:"T-001",nom:"Touati",prenom:"Leila",role:"technicien",
 service:"Maintenance",fonction:"Maintenance Technicien 2",site:"Site 01",toutes_unites:false};
const leader={...base,id:"emp-lead",matricule:"L-001",fonction:"Maintenance Shift Leader"};
function response(path,user){
 const lead=/shift.leader|supervisor|manager|superviseur/i.test(user.fonction);
 const panne=(id,owned)=>({id,wo:"WO-"+id,unite:"U1",machine:"M-001",probleme:"Défaut pompe",service:"Maintenance",
  technicien:owned?"Touati Leila":"Autre Technicien",statut:"Open",date_panne:"2026-11-18",area:"Production",commentaire:"Test",peut_modifier:lead||owned});
 const pannes=[panne(1,true),panne(2,false)];
 const pm=[{id:22,machine_tag:"M-001",machine_designation:"Pompe",unite:"U1",frequence:"MONTHLY",statut:"Planifiée",date_prevue:"2026-11-25",service_intervenant:"Maintenance",responsable:"Équipe"}];
 if(path==="/api/me")return user;
 if(path==="/api/dashboard")return {machines:1,techniciens:lead?3:0,pannesOuvertes:2,pannesFermees:0,pmProgrammee:1,pmRealisees:0,recentPannes:pannes,upcomingPM:pm,month:"2026-11",scope:{department:"Maintenance",locations:["U1"],lead}};
 if(path==="/api/modules/machines")return [machine];
 if(path==="/api/modules/liste"||path==="/api/modules/saisie")return pannes;
 if(path==="/api/modules/pm")return pm;
 if(path==="/api/modules/operating")return [];
 if(path==="/api/modules/effectif")return [user];
 if(path==="/api/effectif/context")return {units:["U1"],services:["Maintenance"],functions:[user.fonction]};
 if(path==="/api/saisie/context")return {units:["U1"],machines:[machine],services:["Maintenance"],zones:["Production"],technicians:[{name:"Touati Leila",service:"Maintenance"}],technician:"Touati Leila",service:"Maintenance"};
 if(path==="/api/pm/context")return {units:["U1"],machines:[machine],technician:"Touati Leila",technicians:[{name:"Touati Leila"}],frequencies:["MONTHLY"],services:["Maintenance"]};
 if(path==="/api/operating/context")return {units:["U1"],machines:[machine],operator:"Touati Leila"};
 if(path==="/api/stats/overview")return {pannes,pm,operating:[],machines:[machine],units:["U1"],scope:{}};
 if(path==="/api/references/active")return [{type_liste:"unite",valeur:"U1",actif:true},{type_liste:"service",valeur:"Maintenance",actif:true}];
 if(path==="/api/pieces/context")return {catalog:[],machineParts:[],history:[]};
 if(path==="/api/supabase/status")return {linked:true};
 return [];
}
for(const size of [{width:390,height:844},{width:1366,height:768}]){
 for(const kind of ["technicien","shift leader"]){
  test(kind+" — menus et actions selon fonction — "+size.width+" px",async({browser})=>{
   const user=kind==="technicien"?base:leader;
   const context=await browser.newContext({viewport:size,serviceWorkers:"block"});
   const page=await context.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.addInitScript(person=>{
     localStorage.setItem("engineering_token","role-test-token");
     localStorage.setItem("engineering_user",JSON.stringify(person));
     localStorage.setItem("engineering_language","fr");
   },user);
   await page.route("**/api/**",route=>route.fulfill({
     status:200,contentType:"application/json",
     body:JSON.stringify(response(new URL(route.request().url()).pathname,user))
   }));
   await page.goto(APP);
   const nav=async module=>{
     if(size.width<=800)await page.locator(".mobileMenu").click();
     await page.locator("aside .module-"+module).click();
   };
   await expect(page.getByText("Département :", {exact:false}).first()).toBeVisible();
   if(kind==="technicien"){
     await expect(page.locator("aside .module-effectif")).toHaveCount(0);
     await expect(page.locator("aside .module-stats")).toHaveCount(0);
     await expect(page.locator("aside .module-parametres")).toHaveCount(0);
   }else{
     await expect(page.locator("aside .module-effectif")).toHaveCount(1);
     await expect(page.locator("aside .module-stats")).toHaveCount(1);
     await expect(page.locator("aside .module-parametres")).toHaveCount(0);
   }
   await nav("machines");
   await expect(page.getByRole("heading",{name:"Parc machines"})).toBeVisible();
   await expect(page.getByRole("button",{name:/Ajouter une machine/})).toHaveCount(kind==="technicien"?0:1);
   await nav("pm");
   await expect(page.getByRole("button",{name:/Ajouter une PM/})).toHaveCount(kind==="technicien"?0:1);
   await expect(page.getByRole("button",{name:/Réaliser/}).first()).toBeVisible();
   await nav("liste");
   await expect(page.locator(".tableWrap tbody tr")).toHaveCount(2);
   await expect(page.locator(".tableWrap tbody button").filter({hasText:"Modifier"})).toHaveCount(kind==="technicien"?1:2);
   if(kind!=="technicien"){
     await nav("effectif");
     await expect(page.getByRole("heading",{name:/Effectif/}).first()).toBeVisible();
     await expect(page.getByRole("button",{name:/Ajouter/})).toHaveCount(0);
   }
   expect(errors).toEqual([]);
   await context.close();
  });
 }
}


test("Shift Leader U4 voit les PM historiques non attribuées sans pouvoir les réaliser",async({browser})=>{
 const user={...leader,id:"emp-u4",site:"Site 01",service:"Maintenance"};
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.addInitScript(person=>{
   localStorage.setItem("engineering_token","pm-u4");
   localStorage.setItem("engineering_user",JSON.stringify(person));
   localStorage.setItem("engineering_language","fr");
 },user);
 const legacy=Array.from({length:265},(_,i)=>({
   id:i+1,machine_tag:"U4-M1",machine_designation:"Pompe",unite:"U4",
   service_intervenant:null,consultation_seule:true,attribution_requise:true,
   frequence:"MONTHLY",statut:"Planifiée",date_prevue:"2026-12-20",responsable:null
 }));
 await page.route("**/api/**",route=>{
   const url=new URL(route.request().url()).pathname;
   let result=response(url,user);
   if(url==="/api/modules/pm")result=legacy;
   if(url==="/api/pm/context")result={...result,units:["U4"],machines:[{...machine,tag:"U4-M1",unite:"U4"}]};
   if(url==="/api/dashboard")result={...result,scope:{department:"Maintenance",locations:["U4"],lead:true}};
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(result)});
 });
 await page.goto(APP);
 await page.locator(".mobileMenu").click();
 await page.locator("aside .module-pm").click();
 await expect(page.getByText("265 / 265 PM affichée(s)")).toBeVisible();
 await expect(page.getByText("Non attribuée · consultation seule").first()).toBeVisible();
 await expect(page.getByText("Affectation requise").first()).toBeVisible();
 await expect(page.getByRole("button",{name:"Réaliser"})).toHaveCount(0);
 expect(errors).toEqual([]);
 await context.close();
});
