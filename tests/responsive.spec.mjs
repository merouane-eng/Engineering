import { test, expect } from "@playwright/test";

const APP = "http://127.0.0.1:4173";
const employee = {id:"test-1",matricule:"TEST-001",nom:"Benk",prenom:"Leila",service:"Électricité",fonction:"Technicien électricité",initiale:"LB",site:"Site 01",units:["U1"],type_contrat:"CDD",date_fin_contrat:"2027-12-01",actif:true,date_recrutement:"2026-01-01",role:"technicien",toutes_unites:false,is_admin:false};
const machine = {id:1,tag:"M-001",designation:"Compresseur",unite:"U1",groupe:"Process",zone:"Production",actif:1};
const panne = {id:11,wo:"WO-012",machine:"M-001",unite:"U1",probleme:"Test électrique",technicien:"Benk Leila",service:"Électricité",statut:"Open",date_panne:"2026-11-18",area:"Production"};
const pm = {id:22,machine_tag:"M-001",machine_designation:"Compresseur",unite:"U1",frequence:"MONTHLY",statut:"Planifiée",date_prevue:"2026-11-25",service_intervenant:"Électricité",responsable:"Benk Leila"};
function fixture(url) {
  const path=new URL(url).pathname;
  if(path==="/api/dashboard") return {machines:1,techniciens:1,pannesOuvertes:1,pannesFermees:0,pmProgrammee:1,pmRealisees:0,recentPannes:[panne],upcomingPM:[pm],month:"2026-11"};
  if(path==="/api/supabase/status") return {linked:true};
  if(path==="/api/modules/machines") return [machine];
  if(path==="/api/modules/effectif") return [employee];
  if(path==="/api/modules/liste"||path==="/api/modules/saisie") return [panne];
  if(path==="/api/modules/pm") return [pm];
  if(path==="/api/modules/operating") return [];
  if(path==="/api/effectif/context") return {units:["U1","SG01"],services:["Électricité"],functions:["Technicien électricité"]};
  if(path==="/api/pm/context") return {units:["U1"],machines:[machine],technician:"Benk Leila",technicians:[{id:"test-1",name:"Benk Leila"}],frequencies:["MONTHLY"],services:["Électricité"]};
  if(path==="/api/saisie/context") return {units:["U1"],machines:[machine],services:["Électricité"],zones:["Production"],technicians:[{name:"Benk Leila",service:"Électricité"}],technician:"Benk Leila",service:"Électricité"};
  if(path==="/api/operating/context") return {units:["U1"],machines:[machine],operator:"Benk Leila"};
  if(path==="/api/pieces/context") return {catalog:[],machineParts:[],history:[]};
  if(path==="/api/auth/usernames") return ["test"];
  if(path.startsWith("/api/")) return [];
  return {};
}
const sizes=[{name:"mobile-360",width:360,height:740},{name:"mobile-390",width:390,height:844},{name:"tablette-768",width:768,height:1024},{name:"pc-1366",width:1366,height:768}];
for(const size of sizes){
  test(size.name+" — navigation et mise en page des 9 modules",async({browser})=>{
    const context=await browser.newContext({viewport:{width:size.width,height:size.height},isMobile:size.width<=600,hasTouch:size.width<=800,serviceWorkers:"block"});
    const page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.addInitScript(()=>{
      localStorage.setItem("engineering_token","test-responsive");
      localStorage.setItem("engineering_user",JSON.stringify({id:"test-1",role:"admin",nom:"Benk",prenom:"Leila",service:"Électricité",matricule:"TEST-001",toutes_unites:false}));
    });
    await page.route("**/api/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(fixture(route.request().url()))}));
    await page.goto(APP,{waitUntil:"domcontentloaded"});
    await expect(page.locator(".mobileTopbar")).toBeVisible();
    const ids=["accueil","machines","effectif","saisie","liste","pm","operating","stats","parametres"];
    for(const module of ids){
      if(size.width<=800) await page.locator(".mobileMenu").click();
      await page.locator("aside button.module-"+module).click();
      await page.waitForTimeout(130);
      await expect(page.locator(".mainContent")).toBeVisible();
      const dims=await page.evaluate(()=>{
        const root=document.documentElement,main=document.querySelector(".mainContent").getBoundingClientRect(),head=document.querySelector(".mobileTopbar").getBoundingClientRect();
        return {overflow:root.scrollWidth-root.clientWidth,mainRight:main.right,headRight:head.right};
      });
      expect(dims.overflow,size.name+" / "+module+" : horizontal page overflow").toBeLessThanOrEqual(2);
      expect(dims.mainRight,size.name+" / "+module+" : contenu hors écran").toBeLessThanOrEqual(size.width+2);
      expect(dims.headRight,size.name+" / "+module+" : en-tête hors écran").toBeLessThanOrEqual(size.width+2);
      if(module==="effectif"){
        await expect(page.getByText("Effectif & ressources humaines")).toBeVisible();
        await page.getByRole("button",{name:/Voir les graphes/}).click();
        await expect(page.getByText("Évolution des effectifs")).toBeVisible();
        if(size.width<=600){
          await page.getByRole("button",{name:/Ajouter/}).click();
          await expect(page.getByText("Ajouter un collaborateur")).toBeVisible();
          const modal=await page.locator(".modal").boundingBox();
          expect(modal.width).toBeLessThanOrEqual(size.width+1);
          await page.getByRole("button",{name:"Fermer"}).click();
        }
      }
      if(["liste","pm","machines"].includes(module)){
        const sc=await page.locator(".tableWrap").first().evaluate(el=>el.clientWidth).catch(()=>null);
        if(sc!==null) expect(sc).toBeLessThanOrEqual(size.width);
      }
    }
    expect(errors,"Erreurs React: "+errors.join(" | ")).toEqual([]);
    await context.close();
  });
}
