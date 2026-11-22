import test from "node:test";
import assert from "node:assert/strict";
import {gridDays,monthKey,monthFromKey,moveMonth,validDay,pmStatus,isPMDone,initials,realizationIndex,mergeRealizations} from "../client/src/pmCalendarModel.js";

test("Planning PM : calendrier mensuel commençant le lundi et tenant compte des années bissextiles",()=>{
  assert.equal(monthKey(monthFromKey("2026-11")),"2026-11");
  assert.equal(moveMonth("2026-12",1),"2027-01");
  assert.equal(moveMonth("2026-01",-1),"2025-12");
  const month=gridDays("2026-11");
  assert.equal(month[0].date,"2026-10-26");
  assert.equal(month.filter(d=>d.inMonth).length,30);
  assert.equal(month.length%7,0);
  assert.equal(gridDays("2028-02").filter(d=>d.inMonth).length,29);
  assert.equal(validDay("2026-02-30"),"");
  assert.equal(validDay("2026-11-12 14:35:00"),"2026-11-12");
});

test("Planning PM : les statuts sont issus du réel, sans modifier les dates prévues",()=>{
  const today="2026-11-22";
  assert.equal(pmStatus({date_prevue:"2026-11-21",statut:"Planifiée"},today),"late");
  assert.equal(pmStatus({date_prevue:"2026-12-01",statut:"Planifiée"},today),"planned");
  assert.equal(pmStatus({date_prevue:"2025-01-01",statut:"Réalisée"},today),"done");
  assert.equal(pmStatus({date_prevue:"2025-01-01",statut:"Reportée"},today),"postponed");
  assert.equal(pmStatus({date_prevue:"2025-01-01",statut:"Annulée"},today),"cancelled");
  assert.equal(isPMDone({statut:"Realisee"}),true);
});

test("Planning PM : initiales et identité toujours issues de la réalisation enregistrée",()=>{
  const pms=[
    {id:1,statut:"Planifiée",date_prevue:"2026-11-12",machine_tag:"VENT-01"},
    {id:2,statut:"Réalisée",date_prevue:"2026-11-02",machine_tag:"VENT-02"},
    {id:3,statut:"Réalisée",date_prevue:"2026-11-03",machine_tag:"VENT-03"}
  ];
  const history=[
    {id_pm_prog:2,technicien:"Samir Benali",date_fin:"2026-11-02 10:00"},
    {id_pm_prog:2,technicien:"Samir Benali",date_fin:"2026-11-02 12:00"},
    {id_pm_prog:3,technicien:"Amine Touati",date_fin:"2026-11-03 08:45"},
    {id_pm_prog:999,technicien:"Inconnu",date_fin:"2026-11-03 10:00"}
  ];
  const results=mergeRealizations(pms,history);
  assert.equal(results[0].realisation_technicien,"");
  assert.equal(results[1].realisation_technicien,"Samir Benali");
  assert.equal(results[1].realisation_date,"2026-11-02");
  assert.equal(results[1].date_prevue,"2026-11-02");
  assert.equal(results[2].realisation_technicien,"Amine Touati");
  assert.equal(initials(results[2].realisation_technicien),"AT");
  assert.equal(initials(""),"✓");
  assert.equal(realizationIndex(history).size,3);
});
