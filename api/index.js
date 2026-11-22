import { app, initDatabase, remoteDatabaseConfigured } from "../server/server.js";

let databaseReady;

// Ces routes lisent et écrivent directement dans Supabase.
// Ne pas bloquer leur réponse avec le chargement complet de l'ancien cache SQLite
// (historique PM, machines, pannes...) à chaque démarrage de fonction Vercel.
const remoteOnly = /^\/api\/(?:excel(?:\/|$)|effectif(?:\/|$)|modules\/effectif(?:\/|$)|auth(?:\/|$)|me(?:\/|$))/;

export default async function handler(req, res) {
  const pathname = String(req.url || "").split("?")[0];
  if (remoteDatabaseConfigured && remoteOnly.test(pathname)) {
    return app(req, res);
  }
  try {
    databaseReady ||= initDatabase().catch(error => {
      databaseReady = null;
      throw error;
    });
    await databaseReady;
  } catch (error) {
    console.error("[API] Database initialization failed:", error);
  }
  return app(req, res);
}
