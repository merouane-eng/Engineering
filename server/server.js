import express from "express";
import initSqlJs from "sql.js";
import fs from "fs";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 5178);
const DB_PATH = process.env.DB_PATH || (process.env.VERCEL
  ? path.join("/tmp", "engineering-data.db")
  : path.resolve(__dirname, "../../data.db"));
let db;
let SQL;

function readPythonSetting(name) {
  const configPath = path.resolve(__dirname, "../../config.py");
  const source = fs.readFileSync(configPath, "utf8");
  const match = source.match(new RegExp(`^${name}\\s*=\\s*[\"']([^\"']+)`, "m"));
  return match ? match[1].trim() : "";
}

const SUPABASE_URL = (process.env.SUPABASE_URL || readPythonSetting("SUPABASE_URL")).replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || readPythonSetting("SUPABASE_ANON_KEY");

function localTimestamp() {
  const now = new Date();
  const pad = value => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

async function supabaseRequest(table, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Configuration Supabase manquante");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${options.query || ""}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Erreur Supabase ${response.status}`);
  return text ? JSON.parse(text) : null;
}

const SUPABASE_TABLES = {
  machines: "machines",
  techniciens: "effectif",
  pannes: "pannes",
  pm_programmees: "pm_programmees",
  pm_realisees: "pm_realisees",
  operating_time: "operating_time",
  pieces_rechange: "pieces_rechange",
  pieces_machines: "pieces_machines",
  pieces_utilisees: "pieces_utilisees"
};

app.use(express.json({ limit: "10mb" }));

const sessions = new Map();
const sessionSecret = process.env.SESSION_SECRET || SUPABASE_ANON_KEY || "engineering-local-session";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function issueSessionToken(user) {
  const payload = base64Url(JSON.stringify({
    user,
    exp: Date.now() + 12 * 60 * 60 * 1000
  }));
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.user || data.exp < Date.now()) return null;
    return data.user;
  } catch {
    return null;
  }
}
const modules = {
  accueil: ["admin", "superviseur", "technicien"],
  machines: ["admin", "superviseur", "technicien"],
  effectif: ["admin", "superviseur", "technicien"],
  saisie: ["admin", "superviseur", "technicien"],
  liste: ["admin", "superviseur", "technicien"],
  pm: ["admin", "superviseur", "technicien"],
  operating: ["admin", "superviseur", "technicien"],
  stats: ["admin", "superviseur", "technicien"],
  sop: ["admin", "superviseur", "technicien"],
  parametres: ["admin"]
};

const writableTables = new Set(["machines", "techniciens", "pannes", "pm_programmees", "pm_realisees", "operating_time", "sop", "ref_listes"]);

const SCHEMA_SQL = `
-- 1) Référentiel machines
CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    tag TEXT UNIQUE NOT NULL,
    designation TEXT NOT NULL,
    unite TEXT NOT NULL,
    groupe TEXT,
    zone TEXT,
    marque TEXT,
    modele TEXT,
    numero_serie TEXT,
    date_mise_service TEXT,
    actif INTEGER DEFAULT 1,
    commentaire TEXT,
    date_creation TEXT NOT NULL,
    date_modification TEXT
);

-- 2) Référentiel techniciens
CREATE TABLE IF NOT EXISTS techniciens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    matricule TEXT UNIQUE,
    nom TEXT NOT NULL,
    prenom TEXT,
    service TEXT NOT NULL,
    fonction TEXT NOT NULL,
    telephone TEXT,
    email TEXT,
    actif INTEGER DEFAULT 1,
    date_creation TEXT NOT NULL,
    date_modification TEXT
);

-- 3) Pannes
CREATE TABLE IF NOT EXISTS pannes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    wo TEXT UNIQUE NOT NULL,
    date_panne TEXT NOT NULL,
    date_debut TEXT,
    date_fin TEXT,
    unite TEXT NOT NULL,
    machine TEXT NOT NULL,
    probleme TEXT NOT NULL,
    area TEXT,
    service TEXT,
    mois TEXT,
    technicien TEXT,
    downtime INTEGER DEFAULT 0,
    statut TEXT NOT NULL DEFAULT 'Open',
    commentaire TEXT,
    pieces_consommees TEXT,
    date_creation TEXT NOT NULL,
    date_modification TEXT
);
CREATE INDEX IF NOT EXISTS idx_pannes_date ON pannes(date_panne);
CREATE INDEX IF NOT EXISTS idx_pannes_machine ON pannes(machine);
CREATE INDEX IF NOT EXISTS idx_pannes_statut ON pannes(statut);

-- 4) PM programmées
CREATE TABLE IF NOT EXISTS pm_programmees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    machine_tag TEXT NOT NULL,
    machine_designation TEXT,
    unite TEXT NOT NULL,
    groupe TEXT,
    frequence TEXT NOT NULL,
    tolerance_jours INTEGER DEFAULT 7,
    date_prevue TEXT NOT NULL,
    mois TEXT,
    annee INTEGER,
    id_sop INTEGER,
    statut TEXT NOT NULL DEFAULT 'Planifiée',
    responsable TEXT,
    commentaire TEXT,
    motif_report TEXT,
    date_creation TEXT NOT NULL,
    date_modification TEXT,
    UNIQUE(machine_tag, date_prevue)
);
CREATE INDEX IF NOT EXISTS idx_pmprog_date ON pm_programmees(date_prevue);
CREATE INDEX IF NOT EXISTS idx_pmprog_statut ON pm_programmees(statut);
CREATE INDEX IF NOT EXISTS idx_pmprog_machine ON pm_programmees(machine_tag);
CREATE INDEX IF NOT EXISTS idx_pmprog_unite ON pm_programmees(unite);

-- 5) PM réalisées
CREATE TABLE IF NOT EXISTS pm_realisees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    id_pm_prog INTEGER NOT NULL,
    code_pm TEXT NOT NULL,
    machine_tag TEXT NOT NULL,
    machine_designation TEXT,
    unite TEXT,
    date_prevue TEXT NOT NULL,
    date_debut TEXT NOT NULL,
    date_fin TEXT NOT NULL,
    downtime INTEGER DEFAULT 0,
    technicien TEXT NOT NULL,
    id_technicien INTEGER,
    ponctualite TEXT DEFAULT 'À l''heure',
    commentaire TEXT,
    statut TEXT NOT NULL DEFAULT 'Réalisée',
    date_creation TEXT NOT NULL,
    date_modification TEXT,
    FOREIGN KEY (id_pm_prog) REFERENCES pm_programmees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pmreal_date ON pm_realisees(date_fin);
CREATE INDEX IF NOT EXISTS idx_pmreal_pm ON pm_realisees(id_pm_prog);
CREATE INDEX IF NOT EXISTS idx_pmreal_machine ON pm_realisees(machine_tag);

-- 6) Operating time
CREATE TABLE IF NOT EXISTS operating_time (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    machine TEXT NOT NULL,
    date_jour TEXT NOT NULL,
    heures_planifiees REAL DEFAULT 24.0,
    heures_marche REAL DEFAULT 0.0,
    heures_arret REAL DEFAULT 0.0,
    commentaire TEXT,
    saisi_par TEXT,
    source TEXT DEFAULT 'manuel',
    date_creation TEXT NOT NULL,
    date_modification TEXT,
    UNIQUE(machine, date_jour)
);
CREATE INDEX IF NOT EXISTS idx_op_date ON operating_time(date_jour);
CREATE INDEX IF NOT EXISTS idx_op_machine ON operating_time(machine);

-- 7) SOP
CREATE TABLE IF NOT EXISTS sop (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    titre TEXT NOT NULL,
    version TEXT,
    machine TEXT,
    unite TEXT,
    date_application TEXT,
    date_revision TEXT,
    validateur TEXT,
    chemin_fichier TEXT,
    commentaire TEXT,
    actif INTEGER DEFAULT 1,
    date_creation TEXT NOT NULL,
    date_modification TEXT
);

-- 8) Machines critiques
CREATE TABLE IF NOT EXISTS machines_critiques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine TEXT UNIQUE NOT NULL,
    actif INTEGER DEFAULT 1,
    date_creation TEXT NOT NULL
);

-- 9) Listes de référence
CREATE TABLE IF NOT EXISTS ref_listes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_liste TEXT NOT NULL,
    valeur TEXT NOT NULL,
    parent TEXT,
    ordre INTEGER DEFAULT 0,
    actif INTEGER DEFAULT 1,
    date_creation TEXT NOT NULL,
    date_modification TEXT,
    UNIQUE(type_liste, valeur)
);

-- 10) Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_action TEXT NOT NULL,
    utilisateur TEXT,
    action TEXT NOT NULL,
    table_cible TEXT NOT NULL,
    id_cible INTEGER,
    details TEXT
);

-- 11) Meta app
CREATE TABLE IF NOT EXISTS app_meta (
    cle TEXT PRIMARY KEY,
    valeur TEXT,
    date_modification TEXT
);

-- 12) Version de schéma
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    date_application TEXT NOT NULL
);

-- 13) Pièces de rechange — référentiel
CREATE TABLE IF NOT EXISTS pieces_rechange (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    reference TEXT UNIQUE,
    nom TEXT NOT NULL,
    description TEXT,
    fournisseur TEXT,
    actif INTEGER DEFAULT 1,
    date_creation TEXT NOT NULL,
    date_modification TEXT
);
CREATE INDEX IF NOT EXISTS idx_pieces_nom ON pieces_rechange(nom);
CREATE INDEX IF NOT EXISTS idx_pieces_ref ON pieces_rechange(reference);

-- 14) Pièces utilisées — traçabilité
CREATE TABLE IF NOT EXISTS pieces_utilisees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    id_panne INTEGER,
    id_pm_realisee INTEGER,
    wo TEXT,
    machine TEXT NOT NULL,
    unite TEXT,
    id_piece INTEGER,
    nom_piece TEXT NOT NULL,
    reference_piece TEXT,
    description_piece TEXT,
    quantite INTEGER DEFAULT 1,
    date_utilisation TEXT NOT NULL,
    technicien TEXT,
    commentaire TEXT,
    date_creation TEXT NOT NULL,
    FOREIGN KEY (id_panne) REFERENCES pannes(id) ON DELETE CASCADE,
    FOREIGN KEY (id_pm_realisee) REFERENCES pm_realisees(id) ON DELETE CASCADE,
    FOREIGN KEY (id_piece) REFERENCES pieces_rechange(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_pu_panne ON pieces_utilisees(id_panne);
CREATE INDEX IF NOT EXISTS idx_pu_pmreal ON pieces_utilisees(id_pm_realisee);
CREATE INDEX IF NOT EXISTS idx_pu_machine ON pieces_utilisees(machine);
CREATE INDEX IF NOT EXISTS idx_pu_date ON pieces_utilisees(date_utilisation);
CREATE INDEX IF NOT EXISTS idx_pu_wo ON pieces_utilisees(wo);

-- 15) Pièces ↔ machines
CREATE TABLE IF NOT EXISTS pieces_machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_piece INTEGER NOT NULL,
    machine TEXT NOT NULL,
    commentaire TEXT,
    date_creation TEXT NOT NULL,
    UNIQUE(id_piece, machine),
    FOREIGN KEY (id_piece) REFERENCES pieces_rechange(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pm_machine ON pieces_machines(machine);
`;

function initSchema() {
  try {
    db.exec(SCHEMA_SQL);
    for (const [column, definition] of [
      ["username", "TEXT UNIQUE"],
      ["password_hash", "TEXT"],
      ["is_admin", "INTEGER DEFAULT 0"],
      ["toutes_unites", "INTEGER DEFAULT 0"],
      ["date_recrutement", "TEXT"],
      ["date_depart", "TEXT"],
      ["role", "TEXT"]
    ]) {
      const exists = db.exec(`SELECT 1 FROM pragma_table_info('techniciens') WHERE name = '${column}'`).length > 0;
      if (!exists) db.exec(`ALTER TABLE techniciens ADD COLUMN ${column} ${definition}`);
    }
    console.log("[DB] Schéma initialisé avec succès sur Render");
  } catch (err) {
    console.error("[DB] Erreur initialisation schéma:", err.message);
  }
}

async function loadSupabaseDatabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const insertRows = (table, rows, transform = row => row) => {
    if (!rows.length) return;
    const available = dbAll(`PRAGMA table_info(${table})`).map(column => column.name);
    for (const row of rows) {
      const source = transform(row);
      const fields = Object.keys(source).filter(key =>
        available.includes(key) && source[key] !== undefined
      );
      if (!fields.length) continue;
      try {
        db.run(
          `INSERT OR REPLACE INTO ${table} (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`,
          fields.map(key => {
          const value = source[key];
          if (value === null || value === undefined) return null;
          if (typeof value === "boolean") return value ? 1 : 0;
          if (typeof value === "object") return JSON.stringify(value);
          return value;
          })
        );
      } catch (error) {
        throw new Error(`${table}: ${error.message}; values=${JSON.stringify(source)}`);
      }
    }
  };

  try {
    const employees = await supabaseRequest("effectif", { query: "?select=*&order=id.asc" });
    const employeeUuidById = new Map();
    insertRows("techniciens", employees, employee => {
      const localUuid = crypto.randomUUID();
      employeeUuidById.set(String(employee.id), localUuid);
      return ({
      uuid: localUuid,
      matricule: employee.matricule,
      nom: employee.nom || "",
      prenom: employee.prenom || "",
      service: employee.service || "",
      fonction: employee.fonction || "",
      telephone: employee.telephone || null,
      email: employee.email || null,
      actif: employee.actif === false ? 0 : 1,
      is_admin: employee.role === "admin" || employee.is_admin === true ? 1 : 0,
      toutes_unites: employee.toutes_unites ? 1 : 0,
      username: employee.username || null,
      password_hash: employee.password_hash || null,
      date_recrutement: employee.date_recrutement || null,
      date_depart: employee.date_depart || null,
      date_creation: employee.created_at || employee.date_creation || localTimestamp(),
      date_modification: employee.updated_at || employee.date_modification || null,
      role: employee.role || "technicien"
    });
    });

    const employeeUnits = await supabaseRequest("effectif_unites", { query: "?select=*&order=effectif_id.asc" });
    for (const unit of employeeUnits) {
      const employeeUuid = employeeUuidById.get(String(unit.effectif_id));
      const statement = db.prepare("SELECT id FROM techniciens WHERE uuid = ?");
      statement.bind([employeeUuid]);
      if (!statement.step()) {
        statement.free();
        continue;
      }
      const id = statement.get()[0];
      statement.free();
      db.run(
        "INSERT OR IGNORE INTO technicien_unites (id_technicien, unite, date_creation) VALUES (?, ?, ?)",
        [id, unit.unite, unit.created_at || localTimestamp()]
      );
    }

    const remoteTables = {
      machines: "machines",
      pannes: "pannes",
      pm_programmees: "pm_programmees",
      pm_realisees: "pm_realisees",
      operating_time: "operating_time",
      pieces_rechange: "pieces_rechange",
      pieces_machines: "pieces_machines",
      pieces_utilisees: "pieces_utilisees",
      ref_listes: "ref_listes"
    };
    for (const [remoteTable, localTable] of Object.entries(remoteTables)) {
      try {
        const rows = await supabaseRequest(remoteTable, { query: "?select=*" });
        insertRows(localTable, rows);
      } catch (error) {
        if (!String(error.message || "").includes("PGRST205")) {
          console.error(`[DB] Impossible de charger ${remoteTable}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error("[DB] Chargement Supabase impossible:", error.message);
  }
}

async function initDatabase() {
  SQL = await initSqlJs();
  db = new SQL.Database(fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : undefined);
  initSchema();
  await loadSupabaseDatabase();
  persistDatabase();
}
function persistDatabase() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function reloadDatabase() {
  if (fs.existsSync(DB_PATH)) db = new SQL.Database(fs.readFileSync(DB_PATH));
}

const dbAll = (sql, params = []) => {
  reloadDatabase();
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
};
const dbGet = (sql, params = []) => dbAll(sql, params)[0] || undefined;
const dbRun = (sql, params = []) => {
  reloadDatabase();
  const statement = db.prepare(sql);
  statement.run(params);
  statement.free();
  let idRow;
  let changesRow;
  let query = db.prepare("SELECT last_insert_rowid() AS id");
  if (query.step()) idRow = query.getAsObject();
  query.free();
  query = db.prepare("SELECT changes() AS changes");
  if (query.step()) changesRow = query.getAsObject();
  query.free();
  persistDatabase();
  return { id: idRow?.id, changes: changesRow?.changes };
};

function roleFor(user) {
  if (user.role && ["admin", "superviseur", "technicien"].includes(user.role)) return user.role;
  if (user.is_admin) return "admin";
  const fonction = String(user.fonction || "").toLowerCase();
  return fonction.includes("superviseur") || fonction.includes("supervisor") ? "superviseur" : "technicien";
}

async function userUnits(user) {
  if (user.role === "admin" || user.toutes_unites) {
    const remoteMachines = await supabaseRequest("machines", { query: "?select=unite&actif=eq.1" });
    return [...new Set(remoteMachines.map(row => row.unite).filter(Boolean))].sort();
  }
  const remoteUserId = user.supabase_id || user.id;
  if (typeof remoteUserId === "string" && remoteUserId.includes("-")) {
    const rows = await supabaseRequest("effectif_unites", {
      query: `?select=unite&effectif_id=eq.${encodeURIComponent(remoteUserId)}&order=unite.asc`
    });
    return rows.map(row => row.unite).filter(Boolean);
  }
  return dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=? ORDER BY unite", [user.id])
    .map(row => row.unite);
}

async function remoteEffectifWithUnits() {
  const [employees, associations] = await Promise.all([
    supabaseRequest("effectif", { query: "?select=*&order=nom.asc,prenom.asc" }),
    supabaseRequest("effectif_unites", { query: "?select=effectif_id,unite&order=unite.asc" })
  ]);
  const unitsByEmployee = new Map();
  for (const association of associations) {
    const key = String(association.effectif_id);
    if (!unitsByEmployee.has(key)) unitsByEmployee.set(key, []);
    unitsByEmployee.get(key).push(association.unite);
  }
  return employees.map(employee => ({
    ...employee,
    is_admin: employee.role === "admin",
    units: unitsByEmployee.get(String(employee.id)) || []
  }));
}

function machineFieldsFromBody(body, includeCreation = false) {
  const allowed = ["tag", "designation", "unite", "groupe", "zone", "marque", "modele",
    "numero_serie", "date_mise_service", "actif", "commentaire"];
  const payload = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) payload[key] = body[key];
  }
  if (includeCreation) {
    payload.uuid = crypto.randomUUID();
    payload.date_creation = new Date().toISOString();
    payload.source = "web";
    if (payload.actif === undefined) payload.actif = 1;
  } else {
    payload.date_modification = new Date().toISOString();
  }
  return payload;
}

function currentUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer /i, "");
  return readSessionToken(token);
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Session expirée" });
  const localEmployee = user.matricule
    ? dbGet("SELECT id FROM techniciens WHERE matricule=? LIMIT 1", [user.matricule])
    : null;
  req.user = {
    ...user,
    supabase_id: user.supabase_id || (typeof user.id === "string" ? user.id : null),
    id: localEmployee?.id ?? user.id
  };
  next();
}

function requireModule(module) {
  return (req, res, next) => {
    if (!modules[module]?.includes(req.user.role)) return res.status(403).json({ error: "Accès refusé" });
    next();
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, database: DB_PATH }));

app.get("/api/supabase/status", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.json({ linked: false, reason: "Configuration manquante" });
  }
  try {
    const tables = {};
    await Promise.all(Object.values(SUPABASE_TABLES).map(async table => {
      try {
        await supabaseRequest(table, { query: "?select=*&limit=1" });
        tables[table] = true;
      } catch {
        tables[table] = false;
      }
    }));
    res.json({ linked: true, url: SUPABASE_URL, tables });
  } catch (error) {
    res.status(502).json({ linked: false, reason: error.message });
  }
});

app.get("/api/auth/usernames", (_req, res) => {
  try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabaseRequest("effectif", {
        query: "?select=username&actif=eq.true&username=not.is.null&order=username.asc"
      }).then(rows => res.json(rows.map(row => row.username).filter(Boolean))).catch(error => {
        console.error("[AUTH] Chargement des noms Supabase impossible:", error.message);
        res.status(502).json({ error: "Chargement des comptes impossible" });
      });
      return;
    }
    const rows = dbAll(
      "SELECT username FROM techniciens WHERE actif=1 AND username IS NOT NULL AND TRIM(username)<>'' ORDER BY LOWER(username)"
    );
    res.json(rows.map(row => row.username));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!username || !password) return res.status(400).json({ error: "Identifiants requis" });
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const rows = await supabaseRequest("effectif", {
        query: `?select=*&username=ilike.${encodeURIComponent(username)}&actif=eq.true&limit=1`
      });
      const user = rows[0];
      if (!user?.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "Identifiants incorrects" });
      }
      const publicUser = {
        ...user,
        role: user.role || (user.is_admin ? "admin" : String(user.fonction || "").toLowerCase().includes("supervisor") ? "superviseur" : "technicien"),
        toutes_unites: Boolean(user.toutes_unites)
      };
      delete publicUser.password_hash;
      const token = issueSessionToken(publicUser);
      res.json({ token, user: publicUser });
      return;
    }
    const user = dbGet("SELECT * FROM techniciens WHERE LOWER(username)=? AND actif=1", [username]);
    if (!user?.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }
    const publicUser = { ...user, role: roleFor(user) };
    delete publicUser.password_hash;
    const token = issueSessionToken(publicUser);
    res.json({ token, user: publicUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer /i, "");
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => res.json(req.user));

app.get("/api/saisie/context", requireAuth, async (req, res) => {
  try {
    const [units, machinesAll, employees] = await Promise.all([
      userUnits(req.user),
      supabaseRequest("machines", { query: "?select=id,tag,designation,unite&actif=eq.1&order=unite.asc,tag.asc" }),
      supabaseRequest("effectif", { query: "?select=nom,prenom,service,actif&actif=eq.true&order=nom.asc,prenom.asc" })
    ]);
    const technician = [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim();
    const machines = machinesAll.filter(row => req.user.role === "admin" || req.user.toutes_unites || units.includes(row.unite));
    const services = [...new Set(employees.map(row => row.service).filter(Boolean))].sort();
    const zones = [...new Set((await supabaseRequest("machines", { query: "?select=zone&actif=eq.1" })).map(row => row.zone).filter(Boolean))].sort();
    const technicians = req.user.role === "admin"
      ? employees.map(row => ({ name: [row.nom, row.prenom].filter(Boolean).join(" ").trim(), service: row.service || "" }))
      : [{ name: technician, service: req.user.service || "" }];
    res.json({ units, machines, services, zones, technicians, technician, service: req.user.service || "" });
  } catch (error) {
    res.status(502).json({ error: `Chargement du contexte Supabase impossible: ${error.message}` });
  }
});

app.get("/api/pm/context", requireAuth, async (req, res) => {
  try {
    const [units, allMachines, employees, programmes] = await Promise.all([
      userUnits(req.user),
      supabaseRequest("machines", { query: "?select=id,tag,designation,unite&actif=eq.1&order=unite.asc,tag.asc" }),
      supabaseRequest("effectif", { query: "?select=id,nom,prenom,actif&actif=eq.true&order=nom.asc,prenom.asc" }),
      supabaseRequest("pm_programmees", { query: "?select=frequence" })
    ]);
    const machines = allMachines.filter(row => req.user.role === "admin" || req.user.toutes_unites || units.includes(row.unite));
    const technician = [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim();
    res.json({
      units, machines, technician,
      technicians: req.user.role === "admin"
        ? employees.map(row => ({ id: row.id, name: [row.nom, row.prenom].filter(Boolean).join(" ").trim() }))
        : [{ id: req.user.id, name: technician }],
      frequencies: [...new Set(programmes.map(row => row.frequence).filter(Boolean))].sort()
    });
  } catch (error) {
    res.status(502).json({ error: `Chargement du contexte Supabase impossible: ${error.message}` });
  }
});

app.get("/api/operating/context", requireAuth, (req, res) => {
  const units = req.user.role === "admin" || req.user.toutes_unites
    ? dbAll("SELECT valeur FROM ref_listes WHERE type_liste=? AND actif=1 ORDER BY ordre, valeur", ["unite"]).map(row => row.valeur)
    : dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=? ORDER BY unite", [req.user.id]).map(row => row.unite);
  const machines = dbAll(
    `SELECT m.tag, m.designation, m.unite
     FROM machines m
     INNER JOIN machines_critiques mc ON mc.machine=m.tag AND mc.actif=1
     WHERE m.actif=1
     ORDER BY m.unite COLLATE NOCASE, m.tag COLLATE NOCASE`
  ).filter(row => req.user.role === "admin" || req.user.toutes_unites || units.includes(row.unite));
  res.json({ units, machines, operator: [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim() });
});

app.post("/api/operating", requireAuth, async (req, res) => {
  const unite = String(req.body.unite || "");
  const machine = String(req.body.machine || "");
  const dateJour = String(req.body.date_jour || "");
  if (!unite || !machine || !dateJour) return res.status(400).json({ error: "Unité, machine et date sont obligatoires" });
  const allowedUnits = req.user.role === "admin" || req.user.toutes_unites
    ? dbAll("SELECT valeur FROM ref_listes WHERE type_liste=? AND actif=1", ["unite"]).map(row => row.valeur)
    : dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=?", [req.user.id]).map(row => row.unite);
  if (!allowedUnits.includes(unite)) return res.status(403).json({ error: "Unité non autorisée" });
  const machineRow = dbGet(
    `SELECT m.tag FROM machines m
     INNER JOIN machines_critiques mc ON mc.machine=m.tag AND mc.actif=1
     WHERE m.tag=? AND m.unite=? AND m.actif=1`,
    [machine, unite]
  );
  if (!machineRow) return res.status(400).json({ error: "Machine critique et unité incohérentes" });
  const hours = Number(req.body.heures_marche);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return res.status(400).json({ error: "Heures de marche invalides" });
  }
  const downtime = dbAll(
    "SELECT COALESCE(downtime, 0) AS downtime FROM pannes WHERE machine=? AND date_panne=?",
    [machine, dateJour]
  ).reduce((sum, row) => sum + Number(row.downtime || 0), 0);
  if (hours * 60 + downtime > 1440) return res.status(400).json({ error: "Le temps de marche et les arrêts dépassent 24 heures" });
  const now = localTimestamp();
  const existing = dbGet("SELECT id, uuid FROM operating_time WHERE machine=? AND date_jour=?", [machine, dateJour]);
  if (existing) {
    dbRun(
      `UPDATE operating_time SET heures_planifiees=24, heures_marche=?, heures_arret=?,
       commentaire=?, saisi_par=?, source='manuel', date_modification=? WHERE id=?`,
      [hours, downtime / 60, req.body.commentaire || "", req.body.saisi_par || "", now, existing.id]
    );
  } else {
    dbRun(
      `INSERT INTO operating_time
       (uuid, machine, date_jour, heures_planifiees, heures_marche, heures_arret,
        commentaire, saisi_par, source, date_creation)
       VALUES (?, ?, ?, 24, ?, ?, ?, ?, 'manuel', ?)`,
      [crypto.randomUUID(), machine, dateJour, hours, downtime / 60,
       req.body.commentaire || "", req.body.saisi_par || "", now]
    );
  }
  persistDatabase();
  const saved = dbGet("SELECT * FROM operating_time WHERE machine=? AND date_jour=?", [machine, dateJour]);
  try {
    await supabaseRequest("operating_time", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      query: "?on_conflict=uuid",
      body: [{
        uuid: saved.uuid, machine: saved.machine, date_jour: saved.date_jour,
        heures_planifiees: saved.heures_planifiees, heures_marche: saved.heures_marche,
        heures_arret: saved.heures_arret, commentaire: saved.commentaire,
        saisi_par: saved.saisi_par, source: saved.source,
        date_creation: saved.date_creation, date_modification: saved.date_modification
      }]
    });
  } catch (error) {
    return res.status(502).json({ error: `Operating Time enregistré localement mais non synchronisé: ${error.message}` });
  }
  res.status(201).json(saved);
});

app.get("/api/pieces/context", requireAuth, (req, res) => {
  const machine = String(req.query.machine || "");
  const catalog = dbAll(
    "SELECT id, uuid, reference, nom, description FROM pieces_rechange WHERE actif=1 ORDER BY nom COLLATE NOCASE, reference COLLATE NOCASE LIMIT 500"
  );
  const machineParts = machine ? dbAll(
    `SELECT pr.id, pr.uuid, pr.reference, pr.nom, pr.description, pm.commentaire
       FROM pieces_machines pm
       JOIN pieces_rechange pr ON pr.id=pm.id_piece
      WHERE pm.machine=? AND pr.actif=1
      ORDER BY pr.nom COLLATE NOCASE, pr.reference COLLATE NOCASE`,
    [machine]
  ) : [];
  const history = dbAll(
    `SELECT pu.*, p.wo AS panne_wo
       FROM pieces_utilisees pu
       LEFT JOIN pannes p ON p.id=pu.id_panne
      ORDER BY pu.date_utilisation DESC, pu.id DESC LIMIT 200`
  );
  res.json({ catalog, machineParts, history });
});

app.post("/api/pieces", requireAuth, (req, res) => {
  const nom = String(req.body.nom || "").trim();
  const reference = String(req.body.reference || "").trim() || null;
  const description = String(req.body.description || "").trim() || null;
  if (!nom) return res.status(400).json({ error: "Le nom de la pièce est obligatoire" });
  const existing = reference
    ? dbGet("SELECT * FROM pieces_rechange WHERE LOWER(reference)=LOWER(?) LIMIT 1", [reference])
    : dbGet("SELECT * FROM pieces_rechange WHERE LOWER(nom)=LOWER(?) LIMIT 1", [nom]);
  if (existing) return res.status(409).json({ error: "Cette pièce existe déjà dans le référentiel" });
  const now = new Date().toISOString();
  const result = dbRun(
    "INSERT INTO pieces_rechange (uuid, reference, nom, description, actif, date_creation) VALUES (?, ?, ?, ?, 1, ?)",
    [crypto.randomUUID(), reference, nom, description, now]
  );
  const piece = dbGet("SELECT * FROM pieces_rechange WHERE id=?", [result.id]);
  supabaseRequest("pieces_rechange", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    query: "?on_conflict=uuid",
    body: [{ uuid: piece.uuid, reference, nom, description, actif: 1, date_creation: now }]
  }).catch(error => console.error("Synchronisation pièce:", error.message));
  res.status(201).json(piece);
});

app.get("/api/dashboard", requireAuth, requireModule("accueil"), async (req, res) => {
  try {
    const allowedUnits = req.user.role === "admin" || req.user.toutes_unites
      ? dbAll("SELECT valeur FROM ref_listes WHERE type_liste=? AND actif=1", ["unite"]).map(row => row.valeur)
      : dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=?", [req.user.id]).map(row => row.unite);
    const unitsFilter = allowedUnits.map(() => "?").join(",");
    const unitParams = allowedUnits.length ? allowedUnits : [""];
    const month = localTimestamp().slice(0, 7);
    const machines = dbGet(
      allowedUnits.length
        ? `SELECT COUNT(*) AS count FROM machines WHERE actif=1 AND unite IN (${unitsFilter})`
        : "SELECT COUNT(*) AS count FROM machines WHERE 0",
      unitParams
    );
    const techniciens = req.user.role === "admin" || req.user.toutes_unites
      ? dbGet("SELECT COUNT(*) AS count FROM techniciens WHERE actif=1")
      : dbGet(
        allowedUnits.length
          ? `SELECT COUNT(DISTINCT t.id) AS count FROM techniciens t
             INNER JOIN technicien_unites tu ON tu.id_technicien=t.id
             WHERE t.actif=1 AND tu.unite IN (${unitsFilter})`
          : "SELECT COUNT(*) AS count FROM techniciens WHERE 0",
        unitParams
      );
    const pannes = dbAll("SELECT unite, statut, date_panne FROM pannes");
    const pannesScope = pannes.filter(panne => allowedUnits.includes(panne.unite));
    const pannesOpen = pannesScope.filter(panne => panne.statut !== "Close").length;
    const pannesClose = pannesScope.filter(panne =>
      panne.statut === "Close" && String(panne.date_panne || "").startsWith(month)
    ).length;
    const pmRows = dbAll("SELECT unite, statut, date_prevue FROM pm_programmees");
    const pmScope = pmRows.filter(pm => allowedUnits.includes(pm.unite));
    const pmRealizedStatuses = ["Réalisée", "Non conforme"];
    const pmRealisees = pmScope.filter(pm =>
      pmRealizedStatuses.includes(pm.statut) && String(pm.date_prevue || "").startsWith(month)
    ).length;
    const pmProgrammee = pmScope.filter(pm =>
      !pmRealizedStatuses.includes(pm.statut) &&
      (String(pm.date_prevue || "").startsWith(month) || String(pm.date_prevue || "") < `${month}-01`)
    ).length;
    res.json({
      machines: machines.count,
      techniciens: techniciens.count,
      pannesOuvertes: pannesOpen,
      pannesFermees: pannesClose,
      pmProgrammee,
      pmRealisees,
      month
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/modules/:module", requireAuth, (req, res, next) => requireModule(req.params.module)(req, res, next), async (req, res) => {
  if (req.params.module === "machines") {
    try {
      return res.json(await supabaseRequest("machines", { query: "?select=*&order=tag.asc" }));
    } catch (error) {
      return res.status(502).json({ error: `Chargement des machines depuis Supabase impossible: ${error.message}` });
    }
  }
  if (req.params.module === "effectif") {
    try {
      return res.json(await remoteEffectifWithUnits());
    } catch (error) {
      return res.status(502).json({ error: `Chargement de l'effectif depuis Supabase impossible: ${error.message}` });
    }
  }
  const tables = {
    machines: "machines",
    effectif: "techniciens",
    saisie: "pannes",
    liste: "pannes",
    pm: "pm_programmees",
    operating: "operating_time",
    sop: "sop",
    parametres: "ref_listes"
  };
  const table = tables[req.params.module];
  if (!table) return res.status(404).json({ error: "Module inconnu" });
  try {
    let rows = dbAll(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 500`);
    if (req.params.module === "effectif") {
      rows = rows.map(row => ({
        ...row,
        units: dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=?", [row.id]).map(unit => unit.unite)
      }));
    }
    if (["liste", "pm"].includes(req.params.module)) {
      if (req.user.role !== "admin" && !req.user.toutes_unites) {
        const allowedUnits = dbAll(
          "SELECT unite FROM technicien_unites WHERE id_technicien=?",
          [req.user.id]
        ).map(row => row.unite);
        rows = rows.filter(row => allowedUnits.includes(row.unite));
      }
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pm", requireAuth, async (req, res) => {
  if (!["admin", "superviseur"].includes(req.user.role)) {
    return res.status(403).json({ error: "Seuls les administrateurs et superviseurs peuvent programmer une PM" });
  }
  const unit = String(req.body.unite || "");
  const tag = String(req.body.machine_tag || "");
  const machine = dbGet("SELECT * FROM machines WHERE tag=?", [tag]);
  if (!machine || machine.unite !== unit) {
    return res.status(400).json({ error: "Machine et unité incohérentes" });
  }
  const allowedUnits = req.user.role === "admin" || req.user.toutes_unites
    ? dbAll("SELECT valeur FROM ref_listes WHERE type_liste=? AND actif=1", ["unite"]).map(row => row.valeur)
    : dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=?", [req.user.id]).map(row => row.unite);
  if (!allowedUnits.includes(unit)) return res.status(403).json({ error: "Unité non autorisée" });
  const date = String(req.body.date_prevue || "");
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch || !req.body.frequence) return res.status(400).json({ error: "Date et fréquence obligatoires" });
  const existing = dbGet(
    "SELECT id FROM pm_programmees WHERE machine_tag=? AND date_prevue=? AND UPPER(frequence)=UPPER(?) LIMIT 1",
    [tag, date, req.body.frequence]
  );
  if (existing) {
    return res.status(409).json({ error: "Cette PM existe déjà pour cette machine, cette date et cette fréquence" });
  }
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const now = localTimestamp();
  const values = [
    crypto.randomUUID(), tag, machine.designation || "", unit, req.body.groupe || machine.groupe || "",
    req.body.frequence, Number(req.body.tolerance_jours || 7), date,
    months[Number(dateMatch[2]) - 1] || "", Number(dateMatch[1]),
    req.body.id_sop || null, "Planifiée",
    String(req.user.nom || req.user.username || "").trim() + (req.user.prenom ? ` ${req.user.prenom}` : ""),
    req.body.commentaire || "", req.body.motif_report || "", now
  ];
  let result;
  try {
    result = dbRun(
      `INSERT INTO pm_programmees
        (uuid, machine_tag, machine_designation, unite, groupe, frequence, tolerance_jours,
         date_prevue, mois, annee, id_sop, statut, responsable, commentaire, motif_report, date_creation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );
  } catch (error) {
    console.error("Erreur ajout PM:", error.message);
    return res.status(400).json({ error: `Impossible d'ajouter la PM: ${error.message}` });
  }
  persistDatabase();
  const programmed = dbGet("SELECT * FROM pm_programmees WHERE id=?", [result.id]);
  const programmedPayload = {
    uuid: programmed.uuid,
    machine_tag: programmed.machine_tag,
    machine_designation: programmed.machine_designation,
    unite: programmed.unite,
    frequence: programmed.frequence,
    tolerance_jours: programmed.tolerance_jours,
    date_prevue: programmed.date_prevue,
    mois: programmed.mois,
    annee: programmed.annee,
    statut: programmed.statut,
    commentaire: programmed.commentaire,
    date_creation: programmed.date_creation,
    date_modification: programmed.date_modification
  };
  try {
    await supabaseRequest("pm_programmees", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      query: "?on_conflict=uuid",
      body: [programmedPayload]
    });
  } catch (error) {
    return res.status(502).json({ error: `PM locale créée mais non synchronisée avec Supabase: ${error.message}` });
  }
  res.status(201).json(programmed);
});

app.post("/api/pm/:id/realiser", requireAuth, async (req, res) => {
  const pm = dbGet("SELECT * FROM pm_programmees WHERE id=?", [req.params.id]);
  if (!pm) return res.status(404).json({ error: "PM introuvable" });
  if (pm.statut !== "Planifiée") return res.status(400).json({ error: "Cette PM n'est pas planifiée" });
  const allowedUnits = req.user.role === "admin" || req.user.toutes_unites
    ? dbAll("SELECT valeur FROM ref_listes WHERE type_liste=? AND actif=1", ["unite"]).map(row => row.valeur)
    : dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=?", [req.user.id]).map(row => row.unite);
  if (!allowedUnits.includes(pm.unite)) return res.status(403).json({ error: "Unité non autorisée" });
  const dateDebut = String(req.body.date_debut || "").replace("T", " ").slice(0, 16);
  const dateFin = String(req.body.date_fin || "").replace("T", " ").slice(0, 16);
  if (!dateDebut || !dateFin || dateFin < dateDebut) {
    return res.status(400).json({ error: "Les dates de début et de fin sont invalides" });
  }
  const technician = req.user.role === "admin"
    ? String(req.body.technicien || "").trim()
    : [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim();
  if (!technician) return res.status(400).json({ error: "Technicien obligatoire" });
  const technicianRow = dbGet(
    "SELECT id FROM techniciens WHERE LOWER(TRIM(nom || ' ' || COALESCE(prenom, ''))) = LOWER(TRIM(?)) LIMIT 1",
    [technician]
  );
  const start = new Date(dateDebut.replace(" ", "T"));
  const end = new Date(dateFin.replace(" ", "T"));
  const downtime = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
    ? Math.max(0, Math.round((end - start) / 60000)) : 0;
  const now = localTimestamp();
  const result = dbRun(
    `INSERT INTO pm_realisees
      (uuid, id_pm_prog, machine_tag, machine_designation, unite, date_prevue, date_debut, date_fin,
       downtime, technicien, id_technicien, ponctualite, commentaire, statut, date_creation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), pm.id, pm.machine_tag, pm.machine_designation, pm.unite, pm.date_prevue,
     dateDebut, dateFin, downtime, technician, technicianRow?.id || req.user.id,
     "À l'heure", req.body.commentaire || "", "Réalisée", now]
  );
  dbRun("UPDATE pm_programmees SET statut=?, date_modification=? WHERE id=?",
    ["Réalisée", now, pm.id]);
  persistDatabase();
  const payload = dbGet("SELECT * FROM pm_realisees WHERE id=?", [result.id]);
  const programmed = dbGet("SELECT * FROM pm_programmees WHERE id=?", [pm.id]);
  const programmedPayload = {
    uuid: programmed.uuid,
    machine_tag: programmed.machine_tag,
    machine_designation: programmed.machine_designation,
    unite: programmed.unite,
    frequence: programmed.frequence,
    tolerance_jours: programmed.tolerance_jours,
    date_prevue: programmed.date_prevue,
    mois: programmed.mois,
    annee: programmed.annee,
    statut: programmed.statut,
    commentaire: programmed.commentaire,
    date_creation: programmed.date_creation,
    date_modification: programmed.date_modification
  };
  try {
    await supabaseRequest("pm_programmees", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      query: "?on_conflict=uuid",
      body: [programmedPayload]
    });
    const remotePrograms = await supabaseRequest("pm_programmees", {
      query: `?select=id&uuid=eq.${encodeURIComponent(pm.uuid)}`
    });
    if (!Array.isArray(remotePrograms) || !remotePrograms.length) {
      throw new Error("PM programmée distante introuvable après synchronisation");
    }
    const realizedPayload = {
      uuid: payload.uuid,
      id_pm_prog: remotePrograms[0].id,
      machine_tag: payload.machine_tag,
      machine_designation: payload.machine_designation,
      unite: payload.unite,
      date_prevue: payload.date_prevue,
      date_debut: payload.date_debut,
      date_fin: payload.date_fin,
      downtime: payload.downtime,
      technicien: payload.technicien,
      ponctualite: payload.ponctualite,
      commentaire: payload.commentaire,
      statut: payload.statut,
      date_creation: payload.date_creation,
      date_modification: payload.date_modification
    };
    await supabaseRequest("pm_realisees", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      query: "?on_conflict=uuid",
      body: [realizedPayload]
    });
  } catch (error) {
    return res.status(502).json({ error: `PM réalisée locale enregistrée mais non synchronisée avec Supabase: ${error.message}` });
  }
  res.status(201).json(payload);
});

app.put("/api/users/:id/password", requireAuth, requireModule("parametres"), async (req, res) => {
  const password = String(req.body.password || "");
  if (password.length < 4) return res.status(400).json({ error: "Mot de passe trop court" });
  try {
    const updated = await supabaseRequest("effectif", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(req.params.id)}`,
      prefer: "return=minimal",
      body: { password_hash: bcrypt.hashSync(password, 10), updated_at: new Date().toISOString() }
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(502).json({ error: `Mise à jour du mot de passe impossible: ${error.message}` });
  }
});

app.put("/api/users/:id/role", requireAuth, requireModule("parametres"), async (req, res) => {
  const role = String(req.body.role || "");
  if (!["admin", "superviseur", "technicien"].includes(role)) return res.status(400).json({ error: "Rôle invalide" });
  try {
    const current = await supabaseRequest("effectif", {
      query: `?select=fonction&id=eq.${encodeURIComponent(req.params.id)}&limit=1`
    });
    if (!current.length) return res.status(404).json({ error: "Employé introuvable" });
    const fonction = role === "superviseur" ? "Superviseur" :
      role === "admin" && current[0].fonction ? current[0].fonction : "Technicien";
    await supabaseRequest("effectif", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(req.params.id)}`,
      prefer: "return=minimal",
      body: { role, fonction, updated_at: new Date().toISOString() }
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(502).json({ error: `Mise à jour du rôle impossible: ${error.message}` });
  }
});

app.get("/api/effectif/context", requireAuth, requireModule("effectif"), async (_req, res) => {
  try {
    const [machines, employees] = await Promise.all([
      supabaseRequest("machines", { query: "?select=unite,zone&actif=eq.1" }),
      supabaseRequest("effectif", { query: "?select=service,fonction&actif=eq.true" })
    ]);
    res.json({
      units: [...new Set(machines.map(row => row.unite).filter(Boolean))].sort(),
      services: [...new Set(employees.map(row => row.service).filter(Boolean))].sort(),
      functions: [...new Set(employees.map(row => row.fonction).filter(Boolean))].sort()
    });
  } catch (error) {
    res.status(502).json({ error: `Chargement du référentiel Supabase impossible: ${error.message}` });
  }
});

async function syncEffectifToSupabase(employee) {
  const payload = {
    matricule: employee.matricule,
    nom: employee.nom || "",
    prenom: employee.prenom || "",
    service: employee.service || "",
    fonction: employee.fonction || "",
    role: employee.is_admin ? "admin" : "technicien",
    actif: Boolean(employee.actif),
    date_recrutement: employee.date_recrutement || null,
    date_depart: employee.date_depart || null,
    toutes_unites: Boolean(employee.toutes_unites)
  };
  const existing = await supabaseRequest("effectif", {
    query: `?select=id&matricule=eq.${encodeURIComponent(employee.matricule)}`
  });
  let effectifId;
  if (existing.length) {
    effectifId = existing[0].id;
    await supabaseRequest("effectif", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(effectifId)}`,
      prefer: "return=minimal",
      body: payload
    });
  } else {
    const created = await supabaseRequest("effectif", {
      method: "POST",
      prefer: "return=representation",
      body: [payload]
    });
    effectifId = created?.[0]?.id;
  }
  if (!effectifId) return null;

  await supabaseRequest("effectif_unites", {
    method: "DELETE",
    query: `?effectif_id=eq.${encodeURIComponent(effectifId)}`
  });
  const units = employee.toutes_unites
    ? []
    : dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=?", [employee.id]).map(row => row.unite);
  if (units.length) {
    await supabaseRequest("effectif_unites", {
      method: "POST",
      prefer: "return=minimal",
      body: units.map(unite => ({ effectif_id: effectifId, unite }))
    });
  }
  return effectifId;
}

app.post("/api/effectif", requireAuth, requireModule("parametres"), async (req, res) => {
  const matricule = String(req.body.matricule || "").trim();
  const nom = String(req.body.nom || "").trim();
  const prenom = String(req.body.prenom || "").trim();
  const service = String(req.body.service || "").trim();
  const fonction = String(req.body.fonction || "").trim();
  if (!matricule || !nom || !service || !fonction) {
    return res.status(400).json({ error: "Matricule, nom, service et fonction sont obligatoires" });
  }
  try {
    const duplicate = await supabaseRequest("effectif", {
      query: `?select=id&matricule=eq.${encodeURIComponent(matricule)}&limit=1`
    });
    if (duplicate.length) return res.status(409).json({ error: "Ce matricule existe déjà" });

    const baseUsername = `${nom}.${prenom}`.trim().toLowerCase().normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9._]/g, "");
    let username = baseUsername || `user${matricule}`;
    let suffix = 1;
    while ((await supabaseRequest("effectif", {
      query: `?select=id&username=ilike.${encodeURIComponent(username)}&limit=1`
    })).length) username = `${baseUsername || `user${matricule}`}${suffix++}`;

    const role = req.body.is_admin ? "admin" :
      (/superviseur|supervisor/i.test(fonction) ? "superviseur" : "technicien");
    const payload = {
      matricule, nom, prenom, service, fonction, role,
      actif: req.body.actif !== false,
      date_recrutement: req.body.date_recrutement || null,
      date_depart: req.body.date_depart || null,
      toutes_unites: Boolean(req.body.toutes_unites),
      username,
      password_hash: bcrypt.hashSync(matricule, 10)
    };
    const created = await supabaseRequest("effectif", {
      method: "POST", prefer: "return=representation", body: [payload]
    });
    const employee = created?.[0];
    if (!employee?.id) throw new Error("Supabase n'a pas retourné l'identifiant du nouvel employé");

    const units = req.body.toutes_unites ? [] :
      [...new Set((Array.isArray(req.body.units) ? req.body.units : []).map(value => String(value).trim()).filter(Boolean))];
    if (units.length) {
      await supabaseRequest("effectif_unites", {
        method: "POST", prefer: "return=minimal",
        body: units.map(unite => ({ effectif_id: employee.id, unite }))
      });
    }
    return res.status(201).json({ ...employee, is_admin: role === "admin", units });
  } catch (error) {
    return res.status(502).json({ error: `Création Supabase impossible: ${error.message}` });
  }
});

app.put("/api/effectif/:id", requireAuth, requireModule("parametres"), async (req, res) => {
  const id = String(req.params.id || "");
  const matricule = String(req.body.matricule || "").trim();
  const nom = String(req.body.nom || "").trim();
  const prenom = String(req.body.prenom || "").trim();
  const service = String(req.body.service || "").trim();
  const fonction = String(req.body.fonction || "").trim();
  if (!id || !matricule || !nom || !service || !fonction) {
    return res.status(400).json({ error: "Matricule, nom, service et fonction sont obligatoires" });
  }
  try {
    const duplicate = await supabaseRequest("effectif", {
      query: `?select=id&matricule=eq.${encodeURIComponent(matricule)}&id=neq.${encodeURIComponent(id)}&limit=1`
    });
    if (duplicate.length) return res.status(409).json({ error: "Ce matricule existe déjà" });
    const role = req.body.is_admin ? "admin" :
      (/superviseur|supervisor/i.test(fonction) ? "superviseur" : "technicien");
    const payload = {
      matricule, nom, prenom, service, fonction, role,
      actif: req.body.actif !== false,
      date_recrutement: req.body.date_recrutement || null,
      date_depart: req.body.date_depart || null,
      toutes_unites: Boolean(req.body.toutes_unites),
      updated_at: new Date().toISOString()
    };
    const updated = await supabaseRequest("effectif", {
      method: "PATCH", query: `?id=eq.${encodeURIComponent(id)}&select=*`,
      prefer: "return=representation", body: payload
    });
    if (!updated?.length) return res.status(404).json({ error: "Employé introuvable" });

    await supabaseRequest("effectif_unites", {
      method: "DELETE", query: `?effectif_id=eq.${encodeURIComponent(id)}`
    });
    const units = req.body.toutes_unites ? [] :
      [...new Set((Array.isArray(req.body.units) ? req.body.units : []).map(value => String(value).trim()).filter(Boolean))];
    if (units.length) {
      await supabaseRequest("effectif_unites", {
        method: "POST", prefer: "return=minimal",
        body: units.map(unite => ({ effectif_id: id, unite }))
      });
    }
    return res.json({ ...updated[0], is_admin: role === "admin", units });
  } catch (error) {
    return res.status(502).json({ error: `Modification Supabase impossible: ${error.message}` });
  }
});

app.post("/api/pannes", requireAuth, (req, res, next) => {
  const allowedUnits = req.user.role === "admin" || req.user.toutes_unites
    ? dbAll("SELECT valeur FROM ref_listes WHERE type_liste=? AND actif=1", ["unite"]).map(row => row.valeur)
    : dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=?", [req.user.id]).map(row => row.unite);
  if (!allowedUnits.includes(req.body.unite)) {
    return res.status(403).json({ error: "Unité non autorisée" });
  }
  const machine = dbGet("SELECT unite FROM machines WHERE tag=?", [req.body.machine]);
  if (!machine || machine.unite !== req.body.unite) {
    return res.status(400).json({ error: "Machine et unité incohérentes" });
  }
  if (req.user.role !== "admin") {
    req.body.service = req.user.service || "";
    req.body.technicien = [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim();
  }
  req.tableName = "pannes";
  next();
});

app.post("/api/pannes", requireAuth, async (req, res) => {
  const required = ["wo", "date_panne", "heure_panne", "date_debut", "date_fin", "unite", "machine", "area", "probleme", "commentaire", "service", "technicien", "statut"];
  const missing = required.filter(key => String(req.body[key] ?? "").trim() === "");
  if (missing.length) return res.status(400).json({ error: `Champs obligatoires manquants : ${missing.join(", ")}` });
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const splitDateTime = value => {
    if (!value) return { date: "", time: "" };
    const text = String(value).trim().replace("T", " ");
    const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?/);
    return match ? { date: match[1], time: match[2] || "" } : { date: text.slice(0, 10), time: "" };
  };
  const formatDesktopDateTime = value => {
    const { date, time } = splitDateTime(value);
    return date && time ? `${date} ${time}` : "";
  };
  if (req.body.date_panne) {
    const panneDateTime = splitDateTime(req.body.date_panne);
    req.body.date_panne = panneDateTime.date;
    req.body.heure_panne = req.body.heure_panne || panneDateTime.time;
    const monthIndex = Number(panneDateTime.date.slice(5, 7)) - 1;
    if (monthIndex >= 0 && monthIndex < months.length && !req.body.mois) {
      req.body.mois = months[monthIndex];
    }
  }
  req.body.date_debut = formatDesktopDateTime(req.body.date_debut);
  req.body.date_fin = formatDesktopDateTime(req.body.date_fin);
  const allowedColumns = new Set(dbAll("PRAGMA table_info(pannes)").map(column => column.name));
  const insertFields = ["uuid", ...Object.keys(req.body).filter(key => allowedColumns.has(key) && key !== "uuid")];
  const panneUuid = req.body.uuid || crypto.randomUUID();
  if (!insertFields.includes("date_creation")) {
    insertFields.push("date_creation");
  }
  const pieces = Array.isArray(req.body.pieces) ? req.body.pieces : [];
  let result;
  try {
    const localFields = insertFields.filter(key => key !== "pieces");
    const now = localTimestamp();
    const localValues = localFields.map(key =>
      key === "uuid" ? panneUuid : key === "date_creation" ? now : req.body[key]
    );
    result = dbRun(
      `INSERT INTO pannes (${localFields.join(",")}) VALUES (${localFields.map(() => "?").join(",")})`,
      localValues
    );
    let panne = dbGet("SELECT * FROM pannes WHERE id=?", [result.id]);
    if (!panne && result.id) panne = dbGet("SELECT * FROM pannes WHERE uuid=?", [panneUuid]);
    if (!panne) throw new Error(`Insertion locale introuvable après enregistrement (id=${result.id || "?"}, uuid=${panneUuid})`);
    const piecesSummary = pieces.map(piece => {
      const reference = String(piece.reference_piece || "").trim();
      const name = String(piece.nom_piece || "").trim();
      const quantity = Math.max(1, Number(piece.quantite || 1));
      return `${reference ? `${reference} — ` : ""}${name} (x${quantity})`;
    }).filter(Boolean).join("; ");
    if (piecesSummary) dbRun("UPDATE pannes SET pieces_consommees=? WHERE id=?", [piecesSummary, result.id]);
    const panneWithParts = dbGet("SELECT * FROM pannes WHERE id=?", [result.id]) || panne;
    const pannePayload = Object.fromEntries(Object.entries(panneWithParts).filter(([key]) =>
      ["uuid", "wo", "date_panne", "heure_panne", "date_debut", "date_fin", "unite", "machine",
       "probleme", "area", "service", "mois", "technicien", "downtime", "statut",
       "commentaire", "pieces_consommees", "date_creation", "date_modification"].includes(key)
    ));

    try {
      await supabaseRequest("pannes", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        query: "?on_conflict=uuid",
        body: [pannePayload]
      });
    } catch (error) {
      if (!String(error.message || "").includes("pieces_consommees")) throw error;
      const pannePayloadWithoutParts = { ...pannePayload };
      delete pannePayloadWithoutParts.pieces_consommees;
      await supabaseRequest("pannes", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        query: "?on_conflict=uuid",
        body: [pannePayloadWithoutParts]
      });
    }

    for (const piece of pieces) {
      const name = String(piece.nom_piece || piece.nom || "").trim();
      if (!name) continue;
      const reference = String(piece.reference_piece || piece.reference || "").trim() || null;
      const description = String(piece.description_piece || piece.description || "").trim() || null;
      let catalog = reference
        ? dbGet("SELECT * FROM pieces_rechange WHERE LOWER(reference)=LOWER(?) LIMIT 1", [reference])
        : dbGet("SELECT * FROM pieces_rechange WHERE LOWER(nom)=LOWER(?) LIMIT 1", [name]);
      if (!catalog) {
        const catalogUuid = crypto.randomUUID();
        const catalogResult = dbRun(
          "INSERT INTO pieces_rechange (uuid, reference, nom, description, actif, date_creation) VALUES (?, ?, ?, ?, 1, ?)",
          [catalogUuid, reference, name, description, new Date().toISOString()]
        );
        catalog = dbGet("SELECT * FROM pieces_rechange WHERE id=?", [catalogResult.id]);
      }
      const linked = dbGet("SELECT id FROM pieces_machines WHERE id_piece=? AND machine=?", [catalog.id, req.body.machine]);
      if (!linked) {
        dbRun("INSERT INTO pieces_machines (id_piece, machine, date_creation) VALUES (?, ?, ?)",
          [catalog.id, req.body.machine, new Date().toISOString()]);
      }
      const useUuid = crypto.randomUUID();
      const usageResult = dbRun(
        `INSERT INTO pieces_utilisees
          (uuid, id_panne, wo, machine, unite, id_piece, nom_piece, reference_piece,
           description_piece, quantite, date_utilisation, technicien, commentaire, date_creation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [useUuid, result.id, req.body.wo, req.body.machine, req.body.unite, catalog.id, name,
         catalog.reference || reference, description || catalog.description, Number(piece.quantite || 1),
         req.body.date_panne || new Date().toISOString(), req.body.technicien,
         piece.commentaire || "", new Date().toISOString()]
      );
      try {
        await supabaseRequest("pieces_rechange", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", query: "?on_conflict=uuid", body: [Object.fromEntries(Object.entries(catalog).filter(([key]) => ["uuid", "reference", "nom", "description", "fournisseur", "actif", "date_creation", "date_modification"].includes(key)))] });
        await supabaseRequest("pieces_machines", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", query: "?on_conflict=piece_uuid,machine", body: [{ piece_uuid: catalog.uuid, machine: req.body.machine, date_creation: new Date().toISOString() }] });
        await supabaseRequest("pieces_utilisees", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", query: "?on_conflict=uuid", body: [{ uuid: useUuid, panne_uuid: panneUuid, wo: req.body.wo, machine: req.body.machine, unite: req.body.unite, piece_uuid: catalog.uuid, nom_piece: name, reference_piece: catalog.reference || reference, description_piece: description || catalog.description, quantite: Number(piece.quantite || 1), date_utilisation: req.body.date_panne || new Date().toISOString(), technicien: req.body.technicien, commentaire: piece.commentaire || "", date_creation: new Date().toISOString() }] });
      } catch (error) {
        console.error("Synchronisation pièce vers Supabase:", error.message);
      }
    }
    res.status(201).json({ id: result.id, uuid: panneUuid });
  } catch (error) {
    if (typeof result !== "undefined") {
      dbRun("DELETE FROM pannes WHERE id=?", [result.id]);
    }
    res.status(502).json({ error: `Panne non synchronisée avec Supabase: ${error.message}` });
  }
});

app.all("/api/tables/:table", requireAuth, async (req, res, next) => {
  const table = req.params.table;
  if (!writableTables.has(table)) return res.status(404).json({ error: "Table non disponible" });
  if (["techniciens", "ref_listes"].includes(table) && req.user.role !== "admin") {
    return res.status(403).json({ error: "Réservé aux administrateurs" });
  }
  next();
});

async function tableColumns(table) {
  const columns = dbAll(`PRAGMA table_info(${table})`);
  return new Set(columns.map(column => column.name));
}

app.put("/api/tables/pannes/:id", requireAuth, async (req, res) => {
  const panne = dbGet("SELECT * FROM pannes WHERE id=?", [req.params.id]);
  if (!panne) return res.status(404).json({ error: "Panne introuvable" });

  const allowedUnits = req.user.role === "admin" || req.user.toutes_unites
    ? dbAll("SELECT valeur FROM ref_listes WHERE type_liste=? AND actif=1", ["unite"]).map(row => row.valeur)
    : dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=?", [req.user.id]).map(row => row.unite);
  const targetUnit = String(req.body.unite ?? panne.unite);
  if (!allowedUnits.includes(targetUnit)) {
    return res.status(403).json({ error: "Modification non autorisée pour cette unité" });
  }
  if (!allowedUnits.includes(String(panne.unite))) {
    return res.status(403).json({ error: "Modification non autorisée pour cette panne" });
  }

  const machine = dbGet("SELECT unite FROM machines WHERE tag=?", [req.body.machine ?? panne.machine]);
  if (!machine || machine.unite !== targetUnit) {
    return res.status(400).json({ error: "Machine et unité incohérentes" });
  }

  const allowedColumns = await tableColumns("pannes");
  const technician = [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim();
  const fields = Object.keys(req.body).filter(key =>
    allowedColumns.has(key) && !["id", "uuid", "password_hash", "date_creation"].includes(key)
  );
  for (const key of fields) {
    if (req.user.role !== "admin" && ["service", "technicien"].includes(key)) {
      continue;
    }
  }
  const editableFields = fields.filter(key => !(req.user.role !== "admin" && ["service", "technicien"].includes(key)));
  const values = editableFields.map(key => req.body[key]);
  const modificationTime = localTimestamp();
  editableFields.push("date_modification");
  values.push(modificationTime);
  dbRun(
    `UPDATE pannes SET ${editableFields.map(key => `${key}=?`).join(",")} WHERE id=?`,
    [...values, req.params.id]
  );

  if (req.user.role !== "admin") {
    dbRun("UPDATE pannes SET technicien=?, service=? WHERE id=?", [
      technician, req.user.service || "", req.params.id
    ]);
  }
  const updated = dbGet("SELECT * FROM pannes WHERE id=?", [req.params.id]);
  const payload = Object.fromEntries(Object.entries(updated).filter(([key]) =>
    ["uuid", "wo", "date_panne", "heure_panne", "date_debut", "date_fin", "unite", "machine",
     "probleme", "area", "service", "mois", "technicien", "downtime", "statut",
     "commentaire", "pieces_consommees", "date_creation", "date_modification"].includes(key)
  ));
  try {
    await supabaseRequest("pannes", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      query: "?on_conflict=uuid",
      body: [payload]
    });
  } catch (error) {
    if (!String(error.message || "").includes("pieces_consommees")) throw error;
    delete payload.pieces_consommees;
    await supabaseRequest("pannes", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      query: "?on_conflict=uuid",
      body: [payload]
    });
  }
  res.json(updated);
});

app.get("/api/tables/:table", async (req, res) => {
  const rows = dbAll(`SELECT * FROM ${req.params.table} ORDER BY id DESC LIMIT 500`);
  res.json(rows.map(row => { const result = { ...row }; delete result.password_hash; return result; }));
});

app.post("/api/tables/:table", requireAuth, async (req, res) => {
  const table = req.params.table;
  if (table === "machines") {
    try {
      const payload = machineFieldsFromBody(req.body, true);
      if (!payload.tag || !payload.designation || !payload.unite) {
        return res.status(400).json({ error: "Tag, désignation et unité sont obligatoires" });
      }
      const created = await supabaseRequest("machines", {
        method: "POST", prefer: "return=representation", body: [payload]
      });
      return res.status(201).json(created?.[0] || { ok: true });
    } catch (error) {
      return res.status(502).json({ error: `Enregistrement machine Supabase impossible: ${error.message}` });
    }
  }
  const allowedColumns = await tableColumns(table);
  const fields = Object.keys(req.body).filter(key =>
    allowedColumns.has(key) && !["id", "uuid", "password_hash"].includes(key));
  const now = new Date().toISOString();
  const values = fields.map(key => req.body[key]);
  const uuid = crypto.randomUUID();
  let insertFields = [...fields];
  let insertValues = [...values];
  if (table !== "ref_listes" && !fields.includes("uuid")) {
    insertFields = ["uuid", ...insertFields];
    insertValues = [uuid, ...insertValues];
  }
  if (!fields.includes("date_creation") && !["ref_listes"].includes(table)) {
    insertFields.push("date_creation");
    insertValues.push(now);
  }
  const sql = `INSERT INTO ${table} (${insertFields.join(",")}) VALUES (${insertFields.map(() => "?").join(",")})`;
  const result = dbRun(sql, insertValues);
  res.status(201).json({ id: result.id });
});

app.put("/api/tables/:table/:id", requireAuth, async (req, res) => {
  if (req.params.table === "machines") {
    try {
      const payload = machineFieldsFromBody(req.body, false);
      if (!Object.keys(payload).some(key => key !== "date_modification")) {
        return res.status(400).json({ error: "Aucune donnée machine à modifier" });
      }
      const updated = await supabaseRequest("machines", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(req.params.id)}&select=*`,
        prefer: "return=representation",
        body: payload
      });
      if (!updated?.length) return res.status(404).json({ error: "Machine introuvable" });
      return res.json(updated[0]);
    } catch (error) {
      return res.status(502).json({ error: `Modification machine Supabase impossible: ${error.message}` });
    }
  }
  const allowedColumns = await tableColumns(req.params.table);
  const fields = Object.keys(req.body).filter(key =>
    allowedColumns.has(key) && !["id", "uuid", "password_hash", "date_creation"].includes(key));
  fields.push("date_modification");
  const values = fields.slice(0, -1).map(key => req.body[key]);
  values.push(new Date().toISOString());
  dbRun(
    `UPDATE ${req.params.table} SET ${fields.map(key => `${key}=?`).join(",")} WHERE id=?`,
    [...values, req.params.id]
  );
  res.json({ ok: true });
});

app.delete("/api/tables/:table/:id", requireAuth, async (req, res) => {
  if (req.params.table === "machines") {
    try {
      await supabaseRequest("machines", {
        method: "DELETE", query: `?id=eq.${encodeURIComponent(req.params.id)}`
      });
      return res.json({ ok: true });
    } catch (error) {
      return res.status(502).json({ error: `Suppression machine Supabase impossible: ${error.message}` });
    }
  }
  dbRun(`DELETE FROM ${req.params.table} WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

const clientDist = path.resolve(__dirname, "../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));

export { app };
export { initDatabase };

if (!process.env.VERCEL) {
  initDatabase().then(() => {
    app.listen(PORT, () => console.log(`Engineering Web API: http://localhost:${PORT}`));
  }).catch(error => { console.error(error); process.exit(1); });
}
