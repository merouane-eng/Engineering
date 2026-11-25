// Une pièce consommée dans une panne devient référentielle pour la machine.
// Les références distinctes restent des articles distincts ; aucune donnée
// de panne existante n'est modifiée.
export async function referenceConsumedPiece(part,machine,{supabaseRequest,attachPieceToMachine}){
  const nom=String(part.nom_piece||"").trim();
  const reference=String(part.reference_piece||"").trim();
  if(!nom)throw new Error("Nom de pièce obligatoire.");
  let piece=null;
  if(part.piece_id){
    const found=await supabaseRequest("pieces",{
      query:"?select=id,reference,nom&actif=eq.true&id=eq."+encodeURIComponent(part.piece_id)+"&limit=1"
    });
    piece=found[0]||null;
  }
  if(!piece){
    const candidates=await supabaseRequest("pieces",{
      query:"?select=id,reference,nom,actif&order=id.asc&limit=2000"
    });
    const key=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toLowerCase();
    piece=reference
      ? candidates.find(row=>key(row.reference)===key(reference)&&row.actif)
      : candidates.find(row=>!String(row.reference||"").trim()&&key(row.nom)===key(nom)&&row.actif);
    if(!piece){
      const created=await supabaseRequest("pieces",{
        method:"POST",query:"?select=id,reference,nom",prefer:"return=representation",
        body:[{nom,reference:reference||null,actif:true}]
      });
      piece=created?.[0];
      if(!piece?.id)throw new Error("Enregistrement de la pièce référentielle non confirmé.");
    }
  }
  await attachPieceToMachine(piece,machine);
  return piece;
}
