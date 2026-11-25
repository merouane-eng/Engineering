import test from "node:test";
import assert from "node:assert/strict";
import {referenceConsumedPiece} from "../server/partsReference.js";

function fakeDb(initial=[]){
 const pieces=initial.map(row=>({...row}));
 const links=[];
 let creations=0;
 const supabaseRequest=async(table,opts={})=>{
  assert.equal(table,"pieces");
  if(opts.method==="POST"){
   const p={...opts.body[0],id:pieces.length+1};
   pieces.push(p);creations++;
   return [p];
  }
  if(opts.query.includes("&id=eq.")){
   const id=opts.query.split("&id=eq.")[1].split("&")[0];
   return pieces.filter(row=>String(row.id)===id&&row.actif);
  }
  return pieces;
 };
 const attachPieceToMachine=async(piece,machine)=>{
  if(!links.some(link=>link.id===piece.id&&link.machine===machine))
   links.push({id:piece.id,machine});
 };
 return {pieces,links,supabaseRequest,attachPieceToMachine,get creations(){return creations;}};
}

test("Une pièce libre est créée au catalogue et liée seulement à la machine du WO",async()=>{
 const db=fakeDb();
 const part={nom_piece:"Roulement 6205",reference_piece:"6205"};
 const first=await referenceConsumedPiece(part,"TAG-001",db);
 assert.equal(first.id,1);
 assert.equal(db.creations,1);
 assert.deepEqual(db.links,[{id:1,machine:"TAG-001"}]);
 const again=await referenceConsumedPiece(part,"TAG-001",db);
 assert.equal(again.id,1);
 assert.equal(db.creations,1);
 assert.equal(db.links.length,1);
 await referenceConsumedPiece(part,"TAG-002",db);
 assert.equal(db.creations,1);
 assert.deepEqual(db.links,[{id:1,machine:"TAG-001"},{id:1,machine:"TAG-002"}]);
});

test("Les pièces sans référence identiques sont réutilisées et les références distinctes ne sont pas fusionnées",async()=>{
 const db=fakeDb();
 const a=await referenceConsumedPiece({nom_piece:"Jóint   d'étanchéité"},"P-01",db);
 const b=await referenceConsumedPiece({nom_piece:"joint d'ÉTANCHÉITÉ"},"P-01",db);
 assert.equal(a.id,b.id);
 const c=await referenceConsumedPiece({nom_piece:"joint d'étanchéité",reference_piece:"REF-A"},"P-01",db);
 const d=await referenceConsumedPiece({nom_piece:"joint d'étanchéité",reference_piece:"REF-B"},"P-01",db);
 assert.notEqual(c.id,d.id);
 assert.equal(db.creations,3);
});

test("Une pièce déjà sélectionnée au catalogue est associée sans création",async()=>{
 const db=fakeDb([{id:23,nom:"Filtre",reference:"F10",actif:true}]);
 const part=await referenceConsumedPiece({piece_id:23,nom_piece:"Filtre",reference_piece:"F10"},"M-01",db);
 assert.equal(part.id,23);
 assert.equal(db.creations,0);
 assert.deepEqual(db.links,[{id:23,machine:"M-01"}]);
});
