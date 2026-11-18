import {test,expect} from "@playwright/test";

const app="http://127.0.0.1:4173";
const person={id:"e1",matricule:"TEST-001",nom:"Benk",prenom:"Leila",
  service:"Électricité",fonction:"Technicien électricité",initiale:"LB",
  site:"Site 01",units:["U1"],type_contrat:"CDD",date_fin_contrat:"2027-12-01",
  date_recrutement:"2026-01-01",role:"technicien",actif:true};
const machine={id:1,tag:"M-001",designation:"Compresseur",unite:"U1",groupe:"Process",zone:"Production",actif:1};
const panne={id:11,wo:"WO-012",machine:"M-001",unite:"U1",probleme:"Test électrique",technicien:"Benk Leila",service:"Électricité",statut:"Open",date_panne:"2026-11-18",downtime:90};
const pm={id:22,machine_tag:"M-001",machine_designation:"Compresseur",unite:"U1",frequence:"MONTHLY",statut:"Planifiée",date_prevue:"2026-11-25",service_intervenant:"Électricité"};
function payload(url){
 const route=new URL(url).pathname;
 if(route==="/api/dashboard")return {machines:1,techniciens:1,pannesOuvertes:1,pannesFermees:0,pmProgrammee:1,pmRealisees:0,recentPannes:[panne],upcomingPM:[pm],month:"2026-11"};
 if(route==="/api/stats/overview")return {pannes:[panne],pm:[pm],operating:[{machine:"M-001",date_jour:"2026-11-18",heures_marche:18,heures_planifiees:24,heures_arret:6}],machines:[machine],units:["U1"],scope:{electricite:false}};
 if(route==="/api/supabase/status")return {linked:true};
 if(route==="/api/modules/machines")return [machine];
 if(route==="/api/modules/effectif")return [person];
 if(route==="/api/modules/liste"||route==="/api/modules/saisie")return [panne];
 if(route==="/api/modules/pm")return [pm];
 if(route==="/api/modules/operating")return [];
 if(route==="/api/effectif/context")return {units:["U1","SG01"],services:["Électricité"],functions:["Technicien électricité"]};
 if(route==="/api/pm/context")return {units:["U1"],machines:[machine],technician:"Benk Leila",technicians:[{id:"e1",name:"Benk Leila"}],frequencies:["MONTHLY"],services:["Électricité"]};
 if(route==="/api/saisie/context")return {units:["U1"],machines:[machine],services:["Électricité"],zones:["Production"],technicians:[{name:"Benk Leila",service:"Électricité"}],technician:"Benk Leila",service:"Électricité"};
 if(route==="/api/operating/context")return {units:["U1"],machines:[machine],operator:"Benk Leila"};
 if(route==="/api/settings/references")return [{id:1,type_liste:"service",valeur:"Électricité",parent:null,ordre:0,actif:true,usage:1}];
 if(route==="/api/references/active")return [{type_liste:"unite",valeur:"U1",parent:"Process",ordre:0}];
 if(route==="/api/pieces/context")return {catalog:[],machineParts:[],history:[]};
 if(route==="/api/auth/usernames")return ["admin"];
 return [];
}
const cases=[
 ["accueil","Dernières pannes","Latest breakdowns"],
 ["machines","Parc machines","Machine fleet"],
 ["effectif","Effectif & ressources humaines","Workforce & human resources"],
 ["saisie","Déclaration d'une panne","Report a breakdown"],
 ["pm","Service intervenant","Assigned department"],
 ["liste","TOTAL DES PANNES","TOTAL BREAKDOWNS"],
 ["operating","HEURES DE MARCHE","RUNNING HOURS"],
 ["stats","Configuration du rapport","Report configuration"],
 ["parametres","Paramètres de l'application","Application settings"]
];
for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
 test("FR/EN complets, navigation et mise à jour dynamique sur "+viewport.width+" px",async({browser})=>{
  const context=await browser.newContext({viewport,serviceWorkers:"block"});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.setDefaultTimeout(8000);
  await page.addInitScript(()=>{
   localStorage.setItem("engineering_token","test-i18n");
   localStorage.setItem("engineering_user",JSON.stringify({id:"e1",role:"admin",nom:"Benk",prenom:"Leila",service:"Électricité"}));
   localStorage.setItem("engineering_language","fr");
  });
  await page.route("**/api/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload(route.request().url()))}));
  await page.goto(app);
  const choose=async lang=>{
   await page.locator(".appLanguage button").filter({hasText:lang==="en"?"EN":"FR"}).click();
   await expect(page.locator("html")).toHaveAttribute("lang",lang);
  };
  const navigate=async name=>{
   if(viewport.width<=800)await page.locator(".mobileMenu").click();
   await page.locator("aside .module-"+name).click();
  };
  for(const [module,fr,en] of cases){
   await navigate(module);
   await choose("fr");
   await expect(page.getByText(fr,{exact:false}).first()).toBeVisible();
   await choose("en");
   await expect(page.getByText(en,{exact:false}).first()).toBeVisible();
   await expect(page.getByText(fr,{exact:true})).toHaveCount(0);
   await choose("fr");
   await expect(page.getByText(fr,{exact:false}).first()).toBeVisible();
  }
  // Changes to DOM after an EN selection must also be translated.
  await navigate("stats");await choose("en");
  await expect(page.getByText("Report configuration")).toBeVisible();
  await page.getByRole("tab",{name:/Reliability/}).click();
  await expect(page.getByText("Reliability & availability")).toBeVisible();
  await page.getByRole("button",{name:/Customize/}).click();
  await expect(page.getByText("DASHBOARD APPEARANCE")).toBeVisible();
  await page.getByRole("button",{name:/Customize/}).click();
  await navigate("effectif");
  await expect(page.getByText("Workforce & human resources")).toBeVisible();
  await page.getByRole("button",{name:/Add/}).click();
  await expect(page.getByText("EMPLOYEE RECORD")).toBeVisible();
  await expect(page.getByText(/Initials.*optional/i).first()).toBeVisible();
  await choose("fr");
  await expect(page.getByText("FICHE PERSONNEL")).toBeVisible();
  expect(errors,"Errors: "+errors.join(" | ")).toEqual([]);
  await context.close();
 });
}
test("Login page is translated before sign-in",async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 const page=await context.newPage();
 await page.route("**/api/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload(route.request().url()))}));
 await page.goto(app);
 await expect(page.getByText("Se connecter")).toBeVisible();
 await page.locator(".loginLanguage button").filter({hasText:"EN"}).click();
 await expect(page.getByText("Sign in")).toBeVisible();
 await page.locator(".loginLanguage button").filter({hasText:"FR"}).click();
 await expect(page.getByText("Se connecter")).toBeVisible();
 await context.close();
});
