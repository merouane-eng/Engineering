import test from "node:test";
import assert from "node:assert/strict";
import {
 SITES,LOCALISATION_CODES,localisationSite,localisationLabel,
 localisationName,localisationCode,localisationsForSite
} from "../client/src/locationModel.js";
import {EXCEL_MODULES} from "../server/bulkExcel.js";
import {REFERENCE_TABS} from "../server/desktopSettings.js";

test("Microbiologie et QC sont distincts entre Site 01 et Site 02",()=>{
 assert.deepEqual(SITES,["Site 01","Site 02"]);
 assert.equal(LOCALISATION_CODES.length,4);
 assert.equal(new Set(LOCALISATION_CODES.map(x=>x.code)).size,4);
 for(const code of LOCALISATION_CODES){
  assert.equal(localisationSite(code.code),code.site);
  assert.equal(localisationLabel(code.code),code.label);
  assert.equal(localisationCode(code.label,code.site),code.code);
  assert.match(localisationName(code.code,{withSite:true}),/Site 0[12]$/);
 }
});
test("Les anciennes unités conservent leur code et leur rattachement",()=>{
 for(const unit of ["U1","U2","U3-1","U3-2","U4","U5","SG01"])
  assert.equal(localisationSite(unit),"Site 01",unit);
 assert.equal(localisationSite("U6"),"Site 02");
 assert.equal(localisationSite("SG02"),"Site 02");
 assert.equal(localisationCode("U3-1","Site 01"),"U3-1");
});
test("Les filtres de site ne mélangent pas les deux QC",()=>{
 const all=["U1","U6","QC__S01","QC__S02","MICROBIOLOGIE__S01","MICROBIOLOGIE__S02"];
 const first=localisationsForSite(all,"Site 01"),second=localisationsForSite(all,"Site 02");
 assert.ok(first.includes("QC__S01"));
 assert.ok(!first.includes("QC__S02"));
 assert.ok(second.includes("QC__S02"));
 assert.ok(!second.includes("MICROBIOLOGIE__S01"));
});
test("On n'expose plus Groupe dans Paramètres ni dans les templates Excel",()=>{
 assert.equal(REFERENCE_TABS.some(x=>x[0]==="groupe"),false);
 assert.equal(REFERENCE_TABS.find(x=>x[0]==="unite")[1],"Localisations");
 assert.equal(EXCEL_MODULES.machines.fields.includes("groupe"),false);
 assert.equal(EXCEL_MODULES.pm.fields.includes("groupe"),false);
 assert.ok(EXCEL_MODULES.machines.fields.includes("site"));
 assert.ok(EXCEL_MODULES.pannes.fields.includes("site"));
 assert.ok(EXCEL_MODULES.pm.fields.includes("site"));
});
