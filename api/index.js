import { app, initDatabase } from "../server/server.js";

let databaseReady;

export default async function handler(req, res) {
  try {
    databaseReady ||= initDatabase();
    await databaseReady;
  } catch (error) {
    console.error("[API] Database initialization failed:", error);
  }
  return app(req, res);
}
