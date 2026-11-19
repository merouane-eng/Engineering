// Réconciliation des PM historiques dépourvues de service.
 // Aucun service n'est inféré automatiquement : un administrateur valide la
// localisation et le département après avoir consulté l'aperçu.
export function registerLegacyPmRoutes(app,{
  requireAuth,requireAdmin,supabaseReadAll,supabaseRequest,allowedUnitsForUser,normService
}){
  async function summaryFor(unit,user,machineTag=""){
    const value=String(unit||"").trim();
    if(!value||value.length>120)throw Object.assign(new Error("Choisir une localisation valide."),{status:400});
    const units=await allowedUnitsForUser(user);
    if(!units.includes(value))throw Object.assign(new Error("Localisation inconnue."),{status:400});
    const rows=await supabaseReadAll("pm_programmees",
      "?select=id,unite,machine_tag,statut,service_intervenant&unite=eq."+encodeURIComponent(value)+"&order=id.asc");
    const selectedTag=String(machineTag||"").trim();
    const scoped=rows.filter(r=>r.unite===value&&(!selectedTag||r.machine_tag===selectedTag));
    const unassigned=scoped.filter(r=>!String(r.service_intervenant||"").trim());
    const statusCounts={},machineCounts={};
    for(const row of unassigned){
      const status=String(row.statut||"Non renseigné");
      statusCounts[status]=(statusCounts[status]||0)+1;
      const machine=String(row.machine_tag||"(sans machine)");
      machineCounts[machine]=(machineCounts[machine]||0)+1;
    }
    return {unite:value,machine_tag:selectedTag,total:scoped.length,unassigned:unassigned.length,
      assigned:scoped.length-unassigned.length,by_status:statusCounts,by_machine:machineCounts,ids:unassigned.map(r=>r.id)};
  }
  const errorReply=(res,err)=>res.status(err.status||502).json({error:err.message});
  app.get("/api/pm/legacy/unassigned",requireAuth,requireAdmin,async(req,res)=>{
    try{
      const summary=await summaryFor(req.query.unite,req.user,req.query.machine_tag);
      const {ids,...publicSummary}=summary;
      return res.json(publicSummary);
    }catch(err){return errorReply(res,err);}
  });
  app.post("/api/pm/legacy/assign",requireAuth,requireAdmin,async(req,res)=>{
    try{
      const unit=String(req.body.unite||"").trim();
      const service=String(req.body.service_intervenant||"").trim();
      const expected=Number(req.body.expected_count);
      if(!service||service.length>120||!Number.isSafeInteger(expected)||expected<1||expected>50000)
        return res.status(400).json({error:"Localisation, service et nombre confirmé obligatoires."});
      const employees=await supabaseReadAll("effectif","?select=id,service&order=id.asc");
      const allowedServices=new Set(employees.map(e=>normService(e.service)).filter(Boolean));
      if(!allowedServices.has(normService(service)))
        return res.status(400).json({error:"Département non référencé."});
      const before=await summaryFor(unit,req.user,req.body.machine_tag);
      if(before.unassigned!==expected)
        return res.status(409).json({error:"Le nombre de PM à attribuer a changé. Refaire l'aperçu.",current:before.unassigned});
      let changed=0;
      // Conditions d'écriture : identifiants vérifiés et service encore vide.
      // Les PM déjà attribuées ne sont jamais écrasées.
      for(let i=0;i<before.ids.length;i+=100){
        const ids=before.ids.slice(i,i+100);
        const updated=await supabaseRequest("pm_programmees",{
          method:"PATCH",
          query:"?id=in.("+ids.join(",")+")&or=(service_intervenant.is.null,service_intervenant.eq.)&select=id",
          prefer:"return=representation",
          body:{service_intervenant:service}
        });
        if(!Array.isArray(updated)||updated.length!==ids.length){
          return res.status(409).json({
            error:"Attribution partielle ou données modifiées simultanément. Recharger l'aperçu.",
            attributed:changed+(Array.isArray(updated)?updated.length:0)
          });
        }
        changed+=updated.length;
      }
      return res.json({ok:true,unite:unit,machine_tag:before.machine_tag,service_intervenant:service,attributed:changed});
    }catch(err){return errorReply(res,err);}
  });
}
