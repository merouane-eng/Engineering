/**
 * Read all PostgREST rows in bounded batches.
 * Supabase commonly caps each HTTP response at 1000 rows.
 * Stable ordering (date then id) prevents missing or repeated records on ties.
 */
export async function readAllSupabase(supabaseRequest,table,query="?select=*&order=id.desc"){
  const pageSize=500;
  const maxRows=50000;
  const params=new URLSearchParams(String(query).replace(/^\\?/,""));
  params.delete("limit");params.delete("offset");
  const order=params.get("order");
  if(!order)params.set("order","id.desc");
  else if(!/(^|,)id\\.(asc|desc)(,|$)/.test(order))
    params.set("order",order+",id.desc");
  const rows=[];
  for(let offset=0;offset<maxRows;offset+=pageSize){
    params.set("limit",String(pageSize));
    params.set("offset",String(offset));
    const batch=await supabaseRequest(table,{query:"?"+params.toString()});
    if(!Array.isArray(batch))throw new Error("Réponse Supabase inattendue pour "+table);
    rows.push(...batch);
    if(batch.length<pageSize)return rows;
  }
  throw new Error("Historique de "+table+" supérieur à "+maxRows+" lignes : pagination côté écran nécessaire.");
}
