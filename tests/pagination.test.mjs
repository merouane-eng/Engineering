import test from "node:test";
import assert from "node:assert/strict";
import {readAllSupabase} from "../server/paginatedSupabase.js";

function fakePostgrest(rows){
  const calls=[];
  const request=async(table,{query})=>{
    const q=new URLSearchParams(query.substring(1));
    const limit=Number(q.get("limit")),offset=Number(q.get("offset"));
    calls.push({table,limit,offset,order:q.get("order")});
    assert.equal(limit,500);
    assert.ok(offset>=0);
    const order=q.get("order")||"id.desc";
    let sorted=[...rows];
    // Simulates deterministic sorting of rows that share the same date.
    const keys=order.split(",").map(s=>s.split("."));
    sorted.sort((a,b)=>{
      for(const [field,dir] of keys){
        const v=String(a[field]??"").localeCompare(String(b[field]??""),undefined,{numeric:true});
        if(v!==0)return dir==="desc"?-v:v;
      }
      return 0;
    });
    return sorted.slice(offset,offset+Math.min(limit,1000));
  };
  return {request,calls};
}
for(const [table,count,order] of [
  ["pm_programmees",1352,"date_prevue.desc"],
  ["pm_realisees",1327,"date_fin.desc"],
  ["operating_time",2582,"date_jour.desc"],
  ["pannes",986,"date_panne.desc"]
]){
 test(table+": charger exactement "+count+" lignes, sans doublon ni perte",async()=>{
   const source=Array.from({length:count},(_,i)=>({
     id:i+1,
     date_prevue:"2026-11-"+String((i%7)+1).padStart(2,"0"),
     date_fin:"2026-11-"+String((i%7)+1).padStart(2,"0"),
     date_jour:"2026-11-"+String((i%7)+1).padStart(2,"0"),
     date_panne:"2026-11-"+String((i%7)+1).padStart(2,"0")
   }));
   const {request,calls}=fakePostgrest(source);
   const rows=await readAllSupabase(request,table,"?select=*&order="+order+"&limit=5000");
   assert.equal(rows.length,count);
   assert.equal(new Set(rows.map(x=>x.id)).size,count);
   assert.deepEqual(new Set(rows.map(x=>x.id)),new Set(source.map(x=>x.id)));
   assert.equal(calls.length,Math.floor(count/500)+1);
   assert.ok(calls.every(c=>c.order.includes("id.desc")));
 });
}
test("exactly 1000 rows: an empty last page is requested",async()=>{
 const data=Array.from({length:1000},(_,id)=>({id}));
 const {request,calls}=fakePostgrest(data);
 assert.equal((await readAllSupabase(request,"pm_realisees")).length,1000);
 assert.deepEqual(calls.map(c=>c.offset),[0,500,1000]);
});
test("empty table: no fabricated data",async()=>{
 const {request,calls}=fakePostgrest([]);
 assert.deepEqual(await readAllSupabase(request,"operating_time"),[]);
 assert.equal(calls.length,1);
});
test("invalid payload: refuse to misreport a complete history",async()=>{
 await assert.rejects(readAllSupabase(async()=>({error:"broken"}),"pm_programmees"),/inattendue/);
});
test("50k safety cap: never silently truncate overflowing history",async()=>{
 const read=async()=>Array.from({length:500},(_,id)=>({id}));
 await assert.rejects(readAllSupabase(read,"pm_programmees"),/supérieur à 50000 lignes/);
});
