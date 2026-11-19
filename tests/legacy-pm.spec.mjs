import {test,expect} from "@playwright/test";
const APP="http://127.0.0.1:4173";
const machine={id:4,tag:"U4-MACHINE",designation:"Compresseur U4",unite:"U4",site:"Site 01",zone:"Production",actif:1};
const pm={id:44,machine_tag:machine.tag,machine_designation:machine.designation,unite:"U4",date_prevue:"2026-11-15",statut:"Réalisée",frequence:"MONTHLY",service_intervenant:null};
const admin={id:"test-admin",role:"admin",nom:"Tester",prenom:"Admin",fonction:"Maintenance Manager",service:"Maintenance",site:"Site 01"};
const leader={id:"test-leader",role:"technicien",nom:"Tester",prenom:"Lead",fonction:"Maintenance Shift Leader",service:"Maintenance",site:"Site 01"};
for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
 test("U4 attribution historique admin (aperçu et confirmation) — "+viewport.width+"px",async({browser})=>{
  const context=await browser.newContext({viewport,serviceWorkers:"block"});
  const page=await context.newPage(),errors=[],mutations=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("dialog",dialog=>dialog.accept());
  await page.addInitScript(user=>{
   localStorage.setItem("engineering_token","pm-demo");
   localStorage.setItem("engineering_user",JSON.stringify(user));
   localStorage.setItem("engineering_language","fr");
  },admin);
  await page.route("**/api/**",route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(path==="/api/pm/legacy/unassigned")
     return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
       unite:"U4",total:265,unassigned:265,assigned:0,by_status:{"Réalisée":265}
     })});
   if(path==="/api/pm/legacy/assign"&&req.method()==="POST"){
     mutations.push(req.postDataJSON());
     return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
       ok:true,attributed:265,unite:"U4",service_intervenant:"Maintenance"
     })});
   }
   const data={
    "/api/me":admin,
    "/api/modules/pm":[pm],
    "/api/pm/context":{units:["U4"],machines:[machine],technician:"Tester Admin",
      technicians:[{id:"test-admin",name:"Tester Admin"}],frequencies:["MONTHLY"],services:["Maintenance","Électricité"]},
    "/api/modules/machines":[machine],
    "/api/references/active":[{type_liste:"unite",valeur:"U4",actif:true}],
    "/api/auth/usernames":["admin"],
    "/api/supabase/status":{linked:true}
   };
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data[path]??[])});
  });
  await page.goto(APP);
  if(viewport.width<=800)await page.locator(".mobileMenu").click();
  await page.locator("aside .module-pm").click();
  await expect(page.getByText("Attribution des PM historiques sans département")).toBeVisible();
  await page.getByText("Attribution des PM historiques sans département").click();
  await expect(page.locator(".pm-legacy-fields")).toBeVisible();
  await expect(page.locator(".pm-legacy-preview")).toHaveCount(0);
  expect(mutations.length).toBe(0);
  await page.locator(".pm-legacy-fields select").first().selectOption("U4");
  await page.locator(".pm-legacy-fields select").nth(2).selectOption("Maintenance");
  await page.getByRole("button",{name:"Prévisualiser les PM non attribuées"}).click();
  await expect(page.locator(".pm-legacy-preview")).toContainText("265 PM sans département");
  await expect(page.locator(".pm-legacy-preview")).toContainText("Réalisée : 265");
  expect(mutations.length).toBe(0);
  await page.getByRole("button",{name:"Confirmer l'attribution au département"}).click();
  await expect(page.locator(".pm-legacy-notice")).toContainText("265 PM attribuées");
  expect(mutations).toHaveLength(1);
  expect(mutations[0]).toEqual({unite:"U4",machine_tag:"",service_intervenant:"Maintenance",expected_count:265});
  expect(errors).toEqual([]);
  await context.close();
 });
 test("Shift Leader U4 sans service attribué : explication et aucune commande admin — "+viewport.width+"px",async({browser})=>{
  const context=await browser.newContext({viewport,serviceWorkers:"block"});
  const page=await context.newPage();
  await page.addInitScript(user=>{
   localStorage.setItem("engineering_token","pm-demo");
   localStorage.setItem("engineering_user",JSON.stringify(user));
   localStorage.setItem("engineering_language","fr");
  },leader);
  await page.route("**/api/**",route=>{
   const path=new URL(route.request().url()).pathname;
   const data={
    "/api/me":leader,
    "/api/modules/pm":[],
    "/api/pm/context":{units:["U4"],machines:[machine],technician:"Tester Lead",
      technicians:[],frequencies:["MONTHLY"],services:["Maintenance"]},
    "/api/supabase/status":{linked:true}
   };
   if(path.startsWith("/api/pm/legacy"))return route.fulfill({status:403,contentType:"application/json",body:'{"error":"Accès refusé"}'});
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data[path]??[])});
  });
  await page.goto(APP);
  if(viewport.width<=800)await page.locator(".mobileMenu").click();
  await page.locator("aside .module-pm").click();
  await expect(page.locator(".pm-legacy-empty")).toContainText("un administrateur doit vérifier");
  await expect(page.locator(".pm-legacy-tools")).toHaveCount(0);
  await context.close();
 });
}
