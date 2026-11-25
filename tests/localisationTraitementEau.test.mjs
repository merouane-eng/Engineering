import test from "node:test";
import assert from "node:assert/strict";
import {canonicalLocalisationCode,localisationLabel,localisationName,localisationCode,localisationsForSite,localisationSite} from "../client/src/locationModel.js";
test("Traitement d’eau garde un seul code par site, graphies historiques comprises",()=>{
 for(const legacy of ["TRAITEMENT_D_EAU__S01","TRAITEMENT_EAU__S01","Traitement D'eau","Traitement d’eau"]){
  assert.equal(canonicalLocalisationCode(legacy),"TRAITEMENT_EAU__S01");
  assert.equal(localisationName(legacy,{withSite:true}),"Traitement d’eau · Site 01");
 }
 assert.equal(localisationCode("Traitement D'eau","Site 01"),"TRAITEMENT_EAU__S01");
 assert.equal(localisationCode("Traitement d’eau","Site 01"),"TRAITEMENT_EAU__S01");
 assert.equal(localisationCode("Traitement D'eau","Site 02"),"TRAITEMENT_EAU__S02");
 assert.equal(localisationSite("TRAITEMENT_D_EAU__S02"),"Site 02");
 assert.deepEqual(localisationsForSite(["TRAITEMENT_D_EAU__S01","TRAITEMENT_EAU__S01"],"Site 01"),["TRAITEMENT_EAU__S01"]);
});
