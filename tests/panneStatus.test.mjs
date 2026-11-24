import test from "node:test";
import assert from "node:assert/strict";
import {isClosedPanne,isOpenPanne,panneStatusLabel,canonicalPanneStatus} from "../client/src/panneStatus.js";

test("Les variantes historiques de clôture sont toutes clôturées",()=>{
  for(const value of ["Close","Closed","Clos","Clôturé","Cloture","Clôturée","Terminé","Resolved","  CLOS  "]){
    assert.equal(isClosedPanne(value),true,value);
    assert.equal(isOpenPanne(value),false,value);
    assert.equal(canonicalPanneStatus(value),"Close",value);
    assert.equal(panneStatusLabel(value,"fr"),"Clôturé");
    assert.equal(panneStatusLabel(value,"en"),"Closed");
  }
});
test("Les statuts actifs restent ouverts",()=>{
  for(const value of ["Open","Ouvert","En cours","Pending","Opened",null]){
    assert.equal(isOpenPanne(value),true,String(value));
    assert.equal(isClosedPanne(value),false,String(value));
  }
});
test("Les 634 Close et 353 Clos donnent zéro panne ouverte",()=>{
  const statuses=[...Array(634).fill("Close"),...Array(353).fill("Clos")];
  assert.equal(statuses.filter(isOpenPanne).length,0);
  assert.equal(statuses.filter(isClosedPanne).length,987);
});
