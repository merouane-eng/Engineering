import {test,expect} from "@playwright/test";
const BASE="http://127.0.0.1:4173";
const tech={id:"U5-Tech",role:"technicien",nom:"Test",prenom:"Technicien",
 service:"Maintenance",fonction:"Maintenance Technicien 2",site:"Site 01",units:["U5"]};
const lead={...tech,id:"U5-Lead",fonction:"Maintenance Shift Leader"};
const machines=[{id:1,tag:"U5-M001",designation:"Équipement U5",unite:"U5",departement:null,actif:1,site:"Site 01"}];
const rows=Array.from({length:209},(_,i)=>({
 id:i+1,unite:"U5",machine_tag:"U5-M001",machine_designation:"Équipement U5",
 statut:i===0?"Planifiée":"Réalisée",date_prevue:"2026-11-18",
 frequence:"MONTHLY",responsable:"Ancien responsable",service_intervenant:null,
 consultation_seule:true,attribution_requise:true
}));
function mock(path,user){
 if(path==="/api/me")return user;
 if(path==="/api/modules/pm")return rows;
 if(path==="/api/pm/context")return {units:["U5"],machines,frequencies:["MONTHLY"],
  technician:"Test Technicien",technicians:[{id:user.id,name:"Test Technicien"}],services:["Maintenance"]};
 if(path==="/api/dashboard")return {machines:1,techniciens:1,pannesOuvertes:0,pannesFermees:0,
  pmProgrammee:1,pmRealisees:208,recentPannes:[],upcomingPM:rows.slice(0,1),month:"2026-11",scope:{department:"Maintenance",locations:["U5"],lead:/Shift Leader/.test(user.fonction)}};
 if(path==="/api/modules/machines")return machines;
 if(path==="/api/references/active")return [{type_liste:"unite",valeur:"U5",actif:true}];
 if(path==="/api/supabase/status")return {linked:true};
 return [];
}
for(const width of [390,1366]){
 for(const [kind,user] of [["technicien",tech],["shift leader",lead]]){
  test("U5 "+kind+" : PM historiques visibles, non réalisables avant attribution — "+width+"px",async({browser})=>{
   const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:"block"});
   const page=await context.newPage(),errors=[];
   page.on("pageerror",err=>errors.push(err.message));
   await page.addInitScript(person=>{
    localStorage.setItem("engineering_token","test-pm-u5");
    localStorage.setItem("engineering_user",JSON.stringify(person));
    localStorage.setItem("engineering_language","fr");
   },user);
   await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(mock(path,user))});
   });
   await page.goto(BASE);
   if(width<=800)await page.locator(".mobileMenu").click();
   await page.locator("aside .module-pm").click();
   await expect(page.locator(".tableWrap tbody tr")).toHaveCount(209);
   await expect(page.locator(".bl-count strong").first()).toHaveText("209");
   await expect(page.getByText("Non attribuée · consultation seule").first()).toBeVisible();
   await expect(page.getByRole("button",{name:"Réaliser",exact:true})).toHaveCount(0);
   if(kind==="technicien")await expect(page.getByRole("button",{name:"Ajouter une PM"})).toHaveCount(0);
   else await expect(page.getByRole("button",{name:"Ajouter une PM"})).toBeVisible();
   expect(errors).toEqual([]);
   await context.close();
  });
 }
}
