// Paramétrage des droits par rôle, poste (fonction) et personne.
// Les droits sont lus côté serveur ; le navigateur ne décide jamais de l'autorisation.
import {ACCESS_MODULES,ACCESS_ACTIONS,normAccess,resolvePermissions} from "../client/src/accessPolicy.js";

const ALLOWED_SCOPES=new Set(["role","fonction","personne"]);
const CATALOG=new Map(ACCESS_MODULES.map(([id,,actions])=>[id,new Set(actions)]));
const ROLES=["technicien","superviseur"];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(res,error,status=400)=>res.status(status).json({error});

export function sanitizeAccessRules(value){
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Droits invalides.");
  const clean={};
  for(const [module,actions] of Object.entries(value)){
    if(!CATALOG.has(module)||module==="parametres")throw new Error("Module non paramétrable : "+module);
    if(!actions||typeof actions!=="object"||Array.isArray(actions))throw new Error("Actions invalides : "+module);
    const valid={};
    for(const [action,choice] of Object.entries(actions)){
      if(!CATALOG.get(module).has(action)||typeof choice!=="boolean")
        throw new Error("Droit invalide : "+module+" / "+action);
      valid[action]=choice;
    }
    if(Object.keys(valid).length)clean[module]=valid;
  }
  return clean;
}

export function createAccessManager({supabaseRequest}){
  async function rpc(action,params={}){
    const secret=process.env.ENGINEERING_REFERENCES_SECRET;
    if(!secret)throw new Error("Droits personnalisés indisponibles : secret serveur manquant.");
    return supabaseRequest("rpc/engineering_permissions_rpc",{
      method:"POST",
      body:{p_secret:secret,p_action:action,p_scope:null,p_subject:null,p_rules:null,
        p_role:null,p_fonction:null,p_personne:null,...params}
    });
  }
  async function resolve(user){
    if(!process.env.ENGINEERING_REFERENCES_SECRET)return resolvePermissions(user);
    const result=await rpc("resolve",{
      p_role:normAccess(user?.role),
      p_fonction:normAccess(user?.fonction),
      p_personne:String(user?.supabase_id||user?.id||"")
    });
    return resolvePermissions(user,Array.isArray(result)?result:[]);
  }
  async function admin(req,res,next){
    if(req.user?.role!=="admin")return fail(res,"Réservé aux administrateurs.",403);
    try{
      const id=req.user.supabase_id||req.user.id;
      if(!id)return fail(res,"Administrateur non vérifié.",403);
      const rows=await supabaseRequest("effectif",{
        query:"?select=id,role,actif&id=eq."+encodeURIComponent(id)+"&limit=1"
      });
      if(rows[0]?.role!=="admin"||rows[0]?.actif!==true)
        return fail(res,"Privilèges administrateur révoqués.",403);
      next();
    }catch{return fail(res,"Vérification administrateur indisponible.",503);}
  }
  function register(app,requireAuth){
    app.get("/api/settings/access",requireAuth,admin,async(_req,res)=>{
      try{
        const [rules,people]=await Promise.all([
          rpc("list"),
          supabaseRequest("effectif",{
            query:"?select=id,matricule,nom,prenom,fonction,role,service,actif&order=nom.asc,prenom.asc"
          })
        ]);
        res.json({rules:Array.isArray(rules)?rules:[],
          roles:ROLES,
          functions:[...new Set(people.map(p=>p.fonction).filter(Boolean))]
            .sort((a,b)=>a.localeCompare(b,"fr")),
          people:people.map(({id,matricule,nom,prenom,fonction,role,service,actif})=>
            ({id,matricule,nom,prenom,fonction,role,service,actif})),
          modules:ACCESS_MODULES});
      }catch(e){fail(res,"Chargement des droits impossible : "+e.message,503);}
    });
    app.put("/api/settings/access",requireAuth,admin,async(req,res)=>{
      try{
        const scope=String(req.body?.scope||"").trim();
        const raw=String(req.body?.subject||"").trim();
        const subject=scope==="personne"?raw:normAccess(raw);
        if(!ALLOWED_SCOPES.has(scope)||!subject||subject.length>180)throw new Error("Poste, rôle ou personne invalide.");
        if(scope==="role"&&!ROLES.includes(subject))throw new Error("Le rôle administrateur est protégé.");
        const people=await supabaseRequest("effectif",{
          query:"?select=id,role,fonction&actif=eq.true"
        });
        if(scope==="personne"&&(!UUID.test(subject)||!people.some(p=>p.id===subject&&p.role!=="admin")))
          throw new Error("Personne non trouvée ou compte administrateur protégé.");
        if(scope==="fonction"&&!people.some(p=>normAccess(p.fonction)===subject))
          throw new Error("Ce poste n'est pas attribué à une personne active.");
        const rules=sanitizeAccessRules(req.body?.rules);
        const saved=await rpc("set",{p_scope:scope,p_subject:subject,p_rules:rules});
        res.json({ok:true,record:saved});
      }catch(e){fail(res,"Enregistrement des droits refusé : "+e.message);}
    });
  }
  return {resolve,rpc,register};
}
