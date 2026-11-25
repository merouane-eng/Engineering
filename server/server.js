import express from "express";
import initSqlJs from "sql.js";
import fs from "fs";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { registerExcelRoutes } from "./bulkExcel.js";
import {availableUsername} from "./accountCredentials.js";
import { readAllSupabase } from "./paginatedSupabase.js";
import {isClosedPanne,canonicalPanneStatus} from "../client/src/panneStatus.js";
import { localisationSite, SITES, LOCALISATION_CODES } from "../client/src/locationModel.js";
import {isAdmin,isLead,isInstrumentation,pmLocationsForUser,permittedModule,permissionAllowed,sameDepartment,machineInDepartment,panneInDepartment,pmInDepartment,employeeOwnsPanne,panneEditable,nameAccess} from "../client/src/accessPolicy.js";
import {createAccessManager} from "./accessSettings.js";
import {pmVisibility} from "../client/src/pmVisibility.js";
import { createSettingsHandlers } from "./desktopSettings.js";

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


const supabaseReadAll=(table,query)=>readAllSupabase(supabaseRequest,table,query);
const accessManager=createAccessManager({supabaseRequest});

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

CREATE TABLE IF NOT EXISTS technicien_unites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_technicien INTEGER NOT NULL,
    unite TEXT NOT NULL,
    date_creation TEXT,
    UNIQUE(id_technicien, unite)
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
      ["username", "TEXT"],
      ["password_hash", "TEXT"],
      ["is_admin", "INTEGER DEFAULT 0"],
      ["toutes_unites", "INTEGER DEFAULT 0"],
      ["date_recrutement", "TEXT"],
      ["date_depart", "TEXT"],
      ["role", "TEXT"],
      ["site", "TEXT"], ["initiale", "TEXT"], ["type_contrat", "TEXT"], ["date_fin_contrat", "TEXT"]
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
    let skippedLegacyRows = 0;
    for (const row of rows) {
      const source = transform(row);

      // The remote Supabase pm_realisees table predates the local code_pm
      // column. Keep those authoritative records in Supabase, but do not let
      // this schema mismatch abort the remaining local cache import.
      if (table === "pm_realisees" && !source.code_pm) {
        skippedLegacyRows += 1;
        continue;
      }

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
        console.error(`[DB] Ligne ${table} ignorée dans le cache local:`, error.message);
      }
    }
    if (skippedLegacyRows) {
      console.warn(`[DB] ${skippedLegacyRows} PM réalisées sans code_pm conservées dans Supabase et ignorées dans le cache SQLite local.`);
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
      site: employee.site || null,
      initiale: employee.initiale || null,
      type_contrat: employee.type_contrat || null,
      date_fin_contrat: employee.date_fin_contrat || null,
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

async function userUnits(user){return allowedUnitsForUser(user);}


// Isolation métier : le service est issu exclusivement du compte authentifié.
const normService = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
const isElectrician = user => user?.role !== "admin" && normService(user?.service)==="electricite";
const normPerson = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
function personNames(employee) {
  const first = String(employee.prenom || "").trim(), last = String(employee.nom || "").trim();
  return [normPerson(first+" "+last),normPerson(last+" "+first)].filter(Boolean);
}
async function electricServiceNames() {
  const employees = await supabaseRequest("effectif", { query: "?select=nom,prenom,service&order=id.asc" });
  const byName = new Map(),electric = new Set();
  for (const person of employees) for (const name of personNames(person)) {
    if (!byName.has(name)) byName.set(name,new Set());
    byName.get(name).add(normService(person.service));
    if (normService(person.service)==="electricite") electric.add(name);
  }
  // Ne pas divulguer une intervention si le nom existe dans plusieurs services.
  return new Set([...electric].filter(name=>byName.get(name)?.size===1));
}
const electricPanne = (row,names) => normService(row.service)==="electricite" ||
  (normService(row.service)==="maintenance" && names.has(normPerson(row.technicien)));
const electricPM = (row,names) => normService(row.service_intervenant)==="electricite" ||
  (!row.service_intervenant && names.has(normPerson(row.responsable)));

async function remoteEffectifWithUnits(user) {
  if(!isAdmin(user) && !isLead(user))return [];
  const [employees, associations] = await Promise.all([
    supabaseRequest("effectif", { query: isAdmin(user)
      ? "?select=*&order=nom.asc,prenom.asc"
      : "?select=id,nom,prenom,fonction,service,site,toutes_unites&order=nom.asc,prenom.asc" }),
    supabaseRequest("effectif_unites", { query: "?select=effectif_id,unite&order=unite.asc" })
  ]);
  const unitsByEmployee = new Map();
  for (const association of associations) {
    const key = String(association.effectif_id);
    if (!unitsByEmployee.has(key)) unitsByEmployee.set(key, []);
    unitsByEmployee.get(key).push(association.unite);
  }
  const units=new Set(await allowedUnitsForUser(user));
  return employees.filter(employee=>{
    if(isAdmin(user))return true;
    if(!permissionAllowed(user,"effectif","view"))return false;
    const linked=unitsByEmployee.get(String(employee.id))||[];
    const overlapping=linked.some(unit=>units.has(unit));
    // Un superviseur ne consulte que les salariés partageant une localisation autorisée.
    // Les salariés globaux restent visibles sur les sites couverts par le superviseur.
    return overlapping||
      (employee.toutes_unites&&SITES.some(site=>String(employee.site||"").includes(site)&&[...units].some(unit=>localisationSite(unit)===site)));
  }).map(employee => {
    const linked=unitsByEmployee.get(String(employee.id))||[];
    if(!isAdmin(user))return {
      nom:employee.nom||"",prenom:employee.prenom||"",fonction:employee.fonction||"",
      units:linked.filter(unit=>units.has(unit)),
      ...(employee.toutes_unites?{units:[...units].filter(unit=>SITES.some(site=>String(employee.site||"").includes(site)&&localisationSite(unit)===site))}:{})
    };
    const { password_hash, ...safeEmployee } = employee;
    return { ...safeEmployee, is_admin: employee.role==="admin", units: linked };
  });
}

function machineFieldsFromBody(body, includeCreation = false) {
  const allowed = ["tag", "designation", "site", "unite", "departement", "zone", "marque", "modele",
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


async function allowedUnitsForUser(user){
  if(isAdmin(user)||user?.toutes_unites){
    // Un droit global inclut aussi les localisations sans machine (QC et Microbiologie).
    // Les codes ajoutés au référentiel sont accessibles sans affectation individuelle.
    const [machines,refs]=await Promise.all([
      supabaseReadAll("machines","?select=id,unite,site&order=id.asc"),
      supabaseRequest("effectif_unites",{query:"?select=effectif_id,unite"})
    ]);
    const sites=isAdmin(user)?SITES:SITES.filter(site=>String(user.site||"").includes(site));
    return [...new Set([...machines,...refs,...LOCALISATION_CODES].map(row=>row.unite||row.code).filter(Boolean)
      .filter(code=>!sites.length||sites.includes(localisationSite(code))))].sort();
  }
  const id=user?.supabase_id||user?.id;
  if(!id)return [];
  let assigned=[];
  if(String(id).includes("-")){
    assigned=await supabaseRequest("effectif_unites",{
      query:"?select=unite&effectif_id=eq."+encodeURIComponent(id)+"&order=unite.asc"
    });
  }else{
    assigned=dbAll("SELECT unite FROM technicien_unites WHERE id_technicien=? ORDER BY unite",[id]);
  }
  let units=[...new Set(assigned.map(row=>row.unite).filter(Boolean))];
  const sites=SITES.filter(site=>String(user.site||"").includes(site));
  if(sites.length)units=units.filter(loc=>sites.includes(localisationSite(loc)));
  return [...new Set(units)].sort();
}

async function visibleMachineRows(user){
  const units=new Set(await allowedUnitsForUser(user));
  const rows=await supabaseReadAll("machines","?select=*&order=tag.asc,id.asc");
  return rows.filter(row=>isAdmin(user)||(units.has(row.unite)&&(String(user.service||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()==="electricite"||machineInDepartment(user,row))));
}

async function visibleEmployees(user){
  const rows=await remoteEffectifWithUnits(user);
  return rows;
}

// Historical WOs have no creator id. Names are accepted only when unambiguous
// across the entire staff directory, including reverse first/last display order.
async function legacyPanneOwnerNames(user){
  if(isAdmin(user)||isLead(user))return new Set();
  const employees=await supabaseRequest("effectif",{query:"?select=id,nom,prenom,service"});
  const owners=new Map();
  for(const employee of employees){
    for(const candidate of [
      nameAccess([employee.nom,employee.prenom].join(" ")),
      nameAccess([employee.prenom,employee.nom].join(" "))
    ]){
      if(!candidate)continue;
      if(!owners.has(candidate))owners.set(candidate,new Set());
      owners.get(candidate).add(String(employee.id));
    }
  }
  const current=String(user.supabase_id||user.id||"");
  return new Set([...owners.entries()].filter(([name,ids])=>ids.size===1&&ids.has(current)).map(([name])=>name));
}
async function panneCanBeEdited(user,panne,legacyNames=null){
  if(!panneEditable(user,panne))return false;
  if(isLead(user)||isAdmin(user)||panne.cree_par_effectif_id)return true;
  const allowed=legacyNames||await legacyPanneOwnerNames(user);
  return allowed.has(nameAccess(panne.technicien));
}

async function remoteModuleRows(module,user){
  const units=new Set(await allowedUnitsForUser(user));
  if(module==="liste"||module==="saisie"){
    const rows=await supabaseReadAll("pannes","?select=*&order=id.desc");
    const visible=rows.filter(row=>units.has(row.unite)&&panneInDepartment(user,row));
    const legacy=!isLead(user)?await legacyPanneOwnerNames(user):null;
    return visible.map(row=>({...row,peut_modifier:isLead(user)||isAdmin(user)?true:
      Boolean(panneEditable(user,row)&&(row.cree_par_effectif_id||legacy.has(nameAccess(row.technicien))))}));
  }
  if(module==="pm"){
    const scopedUnits=new Set(pmLocationsForUser(user,units));
    const [rows,machines]=await Promise.all([
      supabaseReadAll("pm_programmees","?select=*&order=date_prevue.desc,id.desc"),
      isInstrumentation(user)
        ? supabaseReadAll("machines","?select=tag,unite,departement,designation,actif&order=tag.asc")
        : visibleMachineRows(user)
    ]);
    const machineIndex=new Map(machines.map(machine=>[machine.tag,machine]));
    return rows.flatMap(row=>{
      const access=pmVisibility(user,row,scopedUnits,machineIndex.get(row.machine_tag));
      return access.visible?[{...row,consultation_seule:access.readOnly,
        attribution_requise:access.reason==="legacy-unassigned"}]:[];
    });
  }
  if(module==="operating"){
    if(isInstrumentation(user))return [];
    const [entries,machines]=await Promise.all([
      supabaseReadAll("operating_time","?select=*&order=date_jour.desc,id.desc"),
      visibleMachineRows(user)
    ]);
    const accessibleTags=new Set(machines.map(m=>m.tag));
    return entries.filter(row=>accessibleTags.has(row.machine));
  }
  if(module==="sop"){
    const rows=await supabaseReadAll("sop","?select=*&order=id.desc");
    return rows.filter(row=>!row.unite||units.has(row.unite));
  }
  throw new Error("Module non pris en charge");
}

function currentUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer /i, "");
  return readSessionToken(token);
}

async function requireAuth(req,res,next){
  const tokenUser=currentUser(req);
  if(!tokenUser)return res.status(401).json({error:"Session expirée"});
  try{
    if(SUPABASE_URL&&SUPABASE_ANON_KEY){
      const id=tokenUser.supabase_id||tokenUser.id;
      if(!id)return res.status(403).json({error:"Compte non identifié."});
      const rows=await supabaseRequest("effectif",{query:"?select=id,matricule,nom,prenom,role,fonction,service,site,toutes_unites,actif&id=eq."+encodeURIComponent(id)+"&limit=1"});
      const person=rows[0];
      if(!person||person.actif!==true)return res.status(403).json({error:"Compte désactivé ou inconnu."});
      req.user={...tokenUser,...person,supabase_id:person.id,role:person.role||"technicien"};
    }else{
      const localEmployee=tokenUser.matricule?dbGet("SELECT id FROM techniciens WHERE matricule=? LIMIT 1",[tokenUser.matricule]):null;
      req.user={...tokenUser,id:localEmployee?.id??tokenUser.id,role:roleFor(tokenUser)};
    }
    req.user.permissions=await accessManager.resolve(req.user);
    if(tokenUser.must_change_password&&!["/api/auth/change-password","/api/me","/api/auth/logout"].includes(req.path))
      return res.status(403).json({error:"Modification du mot de passe initial obligatoire.",mustChangePassword:true});
    next();
  }catch(error){return res.status(503).json({error:"Vérification du compte indisponible."});}
}

function requireModule(module) {
  return async (req, res, next) => {
    if (!modules[module]?.includes(req.user.role)||!permittedModule(req.user,module)) return res.status(403).json({ error: "Accès refusé" });
    if (module === "parametres") {
      try {
        const id=req.user.supabase_id||req.user.id;
        if (!id) return res.status(403).json({error:"Administrateur non vérifié."});
        const active=await supabaseRequest("effectif",{query:"?select=id,role,actif&id=eq."+encodeURIComponent(id)+"&limit=1"});
        if (active[0]?.role!=="admin" || active[0]?.actif!==true)
          return res.status(403).json({error:"Accès administrateur révoqué."});
      }catch{
        return res.status(503).json({error:"Vérification des droits indisponible."});
      }
    }
    next();
  };
}
function requirePermission(module,action){
  return (req,res,next)=>permissionAllowed(req.user,module,action)?next():
    res.status(403).json({error:"Action non autorisée pour ce module."});
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
      publicUser.must_change_password=Boolean(user.matricule&&bcrypt.compareSync(String(user.matricule),user.password_hash));
      publicUser.permissions=await accessManager.resolve(publicUser);
      const token = issueSessionToken(publicUser);
      res.json({ token, user: publicUser });
      return;
    }
    const user = dbGet("SELECT * FROM techniciens WHERE LOWER(username)=? AND actif=1", [username]);
    if (!user?.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }
    const publicUser = { ...user, role: roleFor(user) };
    publicUser.must_change_password=Boolean(user.matricule&&bcrypt.compareSync(String(user.matricule),user.password_hash));
    delete publicUser.password_hash;
    const token = issueSessionToken(publicUser);
    res.json({ token, user: publicUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Un mot de passe initial dérivé du matricule doit être changé dès la première connexion.
app.post("/api/auth/change-password", requireAuth, async(req,res)=>{
  const current=String(req.body.currentPassword||"");
  const next=String(req.body.newPassword||"");
  if(next.length<10||next.length>128||next===current)
    return res.status(400).json({error:"Choisir un nouveau mot de passe de 10 caractères minimum, différent du précédent."});
  try{
    const id=req.user.supabase_id||req.user.id;
    if(SUPABASE_URL&&SUPABASE_ANON_KEY){
      const rows=await supabaseRequest("effectif",{
        query:"?select=id,matricule,password_hash,actif&id=eq."+encodeURIComponent(id)+"&limit=1"
      });
      const account=rows[0];
      if(!account?.actif||!account.password_hash||!bcrypt.compareSync(current,account.password_hash))
        return res.status(401).json({error:"Mot de passe actuel incorrect."});
      if(next===String(account.matricule))
        return res.status(400).json({error:"Le nouveau mot de passe ne peut pas être le matricule."});
      await supabaseRequest("effectif",{method:"PATCH",
        query:"?id=eq."+encodeURIComponent(id),prefer:"return=minimal",
        body:{password_hash:bcrypt.hashSync(next,12),updated_at:new Date().toISOString()}});
    }else{
      const account=dbGet("SELECT id,matricule,password_hash FROM techniciens WHERE id=?",[id]);
      if(!account?.password_hash||!bcrypt.compareSync(current,account.password_hash))
        return res.status(401).json({error:"Mot de passe actuel incorrect."});
      if(next===String(account.matricule))return res.status(400).json({error:"Le nouveau mot de passe ne peut pas être le matricule."});
      dbRun("UPDATE techniciens SET password_hash=? WHERE id=?",[bcrypt.hashSync(next,12),id]);
    }
    const nextUser={...req.user,must_change_password:false};
    delete nextUser.password_hash;
    const token=issueSessionToken(nextUser);
    return res.json({ok:true,token,user:nextUser});
  }catch(e){return res.status(502).json({error:"Modification du mot de passe impossible : "+e.message});}
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer /i, "");
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => res.json(req.user));

app.get("/api/saisie/context", requireAuth, requireModule("saisie"), async (req, res) => {
  try {
    const [units, allMachines, employees, references] = await Promise.all([
      allowedUnitsForUser(req.user),
      visibleMachineRows(req.user),
      supabaseRequest("effectif", { query: "?select=nom,prenom,service,actif&actif=eq.true&order=nom.asc,prenom.asc" }),
      desktopSettings.list()
    ]);
    const machines = allMachines.filter(row => Number(row.actif)===1 && units.includes(row.unite));
    const technician = [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim();
    const refVals=type=>references.filter(r=>r.actif&&r.type_liste===type).map(r=>r.valeur);
    const services = isAdmin(req.user)?[...new Set([...refVals("service"),...employees.map(row => row.service)].filter(Boolean))].sort():[req.user.service].filter(Boolean);
    const zones = [...new Set([...refVals("zone"),...machines.map(row => String(row.zone || "").trim())].filter(Boolean))].sort();
    const technicians = req.user.role === "admin"
      ? employees.map(row => ({ name: [row.nom, row.prenom].filter(Boolean).join(" ").trim(), service: row.service || "" }))
      : [{ name: technician, service: req.user.service || "" }];
    res.json({ units, machines, services, zones, technicians, technician, statuses: refVals("statut_panne"), service: req.user.service || "" });
  } catch (error) {
    res.status(502).json({ error: `Chargement du contexte Supabase impossible: ${error.message}` });
  }
});



app.get("/api/pm/context", requireAuth, requireModule("pm"), async (req, res) => {
  try {
    const [units, allMachines, employees, programmes, references] = await Promise.all([
      userUnits(req.user).then(units=>pmLocationsForUser(req.user,units)),
      isInstrumentation(req.user)
        ? supabaseReadAll("machines","?select=tag,unite,designation,actif,departement&order=tag.asc")
        : visibleMachineRows(req.user),
      supabaseRequest("effectif", { query: "?select=id,nom,prenom,service,actif&actif=eq.true&order=nom.asc,prenom.asc" }),
      supabaseReadAll("pm_programmees","?select=id,frequence&order=id.asc"),
      desktopSettings.list()
    ]);
    const machines = allMachines.filter(row => Number(row.actif)===1 && units.includes(row.unite));
    const technician = [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim();
    res.json({
      units, machines, technician,
      technicians: req.user.role === "admin"
        ? employees.map(row => ({ id: row.id, name: [row.nom, row.prenom].filter(Boolean).join(" ").trim() }))
        : [{ id: req.user.id, name: technician }],
      frequencies: [...new Set([...references.filter(r=>r.type_liste==="frequence_pm"&&r.actif).map(r=>r.valeur),...programmes.map(row => row.frequence)].filter(Boolean))].sort(),
      services: req.user.role==="admin" ? [...new Set([...references.filter(r=>r.type_liste==="service"&&r.actif).map(r=>r.valeur),...employees.map(row=>row.service)].filter(Boolean))].sort() : [req.user.service].filter(Boolean)
    });
  } catch (error) {
    res.status(502).json({ error: `Chargement du contexte Supabase impossible: ${error.message}` });
  }
});

app.get("/api/operating/context", requireAuth, requireModule("operating"), async (req, res) => {
  try {
    const units = await allowedUnitsForUser(req.user);
    const [allMachines, entries] = await Promise.all([
      visibleMachineRows(req.user),
      supabaseReadAll("operating_time","?select=id,machine&order=id.asc")
    ]);
    const tracked = new Set(entries.map(row => row.machine));
    const machines = allMachines.filter(row => Number(row.actif)===1 && units.includes(row.unite));
    res.json({ units, machines, operator: [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim() });
  } catch (error) { res.status(502).json({ error: `Chargement Operating Time impossible: ${error.message}` }); }
});

app.post("/api/operating", requireAuth, requirePermission("operating","create"), async (req, res) => {
  try {
    const unit = String(req.body.unite || ""), machine = String(req.body.machine || ""), date = String(req.body.date_jour || "");
    if (!unit || !machine || !date) return res.status(400).json({ error: "Localisation, machine et date sont obligatoires" });
    const allowed = await allowedUnitsForUser(req.user);
    if (!allowed.includes(unit)) return res.status(403).json({ error: "Localisation non autorisée" });
    const machineRows = await supabaseRequest("machines", { query: `?select=tag,unite,actif,departement&tag=eq.${encodeURIComponent(machine)}&limit=1` });
    if (!machineRows[0] || machineRows[0].unite !== unit || Number(machineRows[0].actif) !== 1 || !machineInDepartment(req.user,machineRows[0])) return res.status(403).json({ error: "Machine ou département non autorisé" });
    const hours = Number(req.body.heures_marche);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) return res.status(400).json({ error: "Heures de marche invalides" });
    const failures = await supabaseRequest("pannes", { query: `?select=downtime&machine=eq.${encodeURIComponent(machine)}&date_panne=eq.${encodeURIComponent(date)}` });
    const downtimeMinutes = failures.reduce((sum,row)=>sum+Number(row.downtime||0),0);
    if (hours*60+downtimeMinutes>1440) return res.status(400).json({ error: "Le temps de marche et les arrêts dépassent 24 heures" });
    const existing = await supabaseRequest("operating_time", { query: `?select=id,uuid&machine=eq.${encodeURIComponent(machine)}&date_jour=eq.${encodeURIComponent(date)}&limit=1` });
    const payload = {
      machine, date_jour: date, heures_planifiees: 24, heures_marche: hours, heures_arret: downtimeMinutes/60,
      commentaire: req.body.commentaire || "", saisi_par: req.body.saisi_par || [req.user.nom,req.user.prenom].filter(Boolean).join(" "),
      source: "web", date_modification: localTimestamp()
    };
    let saved;
    if (existing.length) {
      const rows = await supabaseRequest("operating_time", { method: "PATCH", query: `?id=eq.${encodeURIComponent(existing[0].id)}&select=*`, prefer: "return=representation", body: payload });
      saved = rows?.[0] || { ...payload, id: existing[0].id, uuid: existing[0].uuid };
    } else {
      payload.uuid = crypto.randomUUID(); payload.date_creation = localTimestamp();
      const rows = await supabaseRequest("operating_time", { method: "POST", query: "?select=*", prefer: "return=representation", body: [payload] });
      saved = rows?.[0] || payload;
    }
    return res.status(201).json(saved);
  } catch (error) { return res.status(502).json({ error: `Enregistrement Operating Time impossible: ${error.message}` }); }
});



async function attachPieceToMachine(piece, machine) {
  if (!piece || !machine) return;
  const existing = await supabaseRequest("machine_pieces", {
    query: `?select=id&machine=eq.${encodeURIComponent(machine)}&piece_id=eq.${encodeURIComponent(piece.id)}&limit=1`
  });
  if (existing.length) return;
  await supabaseRequest("machine_pieces", {
    method: "POST",
    query: "?select=*",
    prefer: "return=representation",
    body: [{ machine, piece_id: piece.id, reference: piece.reference || null, nom: piece.nom, created_at: new Date().toISOString() }]
  });
}

app.put("/api/operating/:id",requireAuth,requirePermission("operating","edit"),async(req,res)=>{
  try{
    const existing=await supabaseRequest("operating_time",{query:"?select=*&id=eq."+encodeURIComponent(req.params.id)+"&limit=1"});
    const entry=existing[0];
    if(!entry)return res.status(404).json({error:"Relevé introuvable."});
    const [units,machines]=await Promise.all([
      allowedUnitsForUser(req.user),
      supabaseRequest("machines",{query:"?select=tag,unite,departement&tag=eq."+encodeURIComponent(entry.machine)+"&limit=1"})
    ]);
    const machine=machines[0];
    if(!machine||!units.includes(machine.unite)||!machineInDepartment(req.user,machine))
      return res.status(403).json({error:"Relevé hors de votre localisation ou département."});
    const running=Number(req.body.heures_marche),stopped=Number(entry.heures_arret||0);
    if(!Number.isFinite(running)||running<0||running>24||running+stopped>24.001)
      return res.status(400).json({error:"Heures de marche invalides (0 à 24 h)."});
    const updated=await supabaseRequest("operating_time",{
      method:"PATCH",query:"?id=eq."+encodeURIComponent(req.params.id)+"&select=*",
      prefer:"return=representation",
      body:{heures_marche:running,commentaire:String(req.body.commentaire||"").slice(0,2000)}
    });
    return res.json(updated?.[0]||{...entry,heures_marche:running});
  }catch(e){return res.status(502).json({error:"Modification Operating Time impossible : "+e.message});}
});

app.get("/api/pieces/context", requireAuth, requireModule("saisie"), async (req, res) => {
  try {
    const machine = String(req.query.machine || "").trim();
    if(machine){
      const found=await supabaseRequest("machines",{query:"?select=tag,unite,departement&tag=eq."+encodeURIComponent(machine)+"&limit=1"});
      const units=await allowedUnitsForUser(req.user);
      if(!found[0]||!units.includes(found[0].unite)||!machineInDepartment(req.user,found[0]))
        return res.status(403).json({error:"Machine hors de votre périmètre."});
    }
    const [catalog, links, history] = await Promise.all([
      supabaseRequest("pieces", { query: "?select=id,reference,nom,description,actif&actif=eq.true&order=nom.asc&limit=500" }),
      machine
        ? supabaseRequest("machine_pieces", { query: `?select=id,piece_id,reference,nom,machine&machine=eq.${encodeURIComponent(machine)}&order=nom.asc` })
        : Promise.resolve([]),
      machine
        ? supabaseRequest("panne_pieces", { query: `?select=id,panne_id,piece_id,machine,wo,reference,nom,quantite,date_utilisation,technicien&machine=eq.${encodeURIComponent(machine)}&order=date_utilisation.desc,id.desc&limit=200` })
        : Promise.resolve([])
    ]);
    const catalogById = new Map(catalog.map(piece => [String(piece.id), piece]));
    const machineParts = links.map(link => ({
      ...catalogById.get(String(link.piece_id)),
      id: link.piece_id,
      reference: link.reference || catalogById.get(String(link.piece_id))?.reference || "",
      nom: link.nom || catalogById.get(String(link.piece_id))?.nom || ""
    })).filter(piece => piece.nom);
    const visiblePannes=machine&&!isAdmin(req.user)?await remoteModuleRows("liste",req.user):[];
    const ids=new Set(visiblePannes.map(row=>String(row.id)));
    res.json({catalog,machineParts,history:isAdmin(req.user)?history:history.filter(h=>ids.has(String(h.panne_id)))});
  } catch (error) {
    res.status(502).json({ error: `Chargement du référentiel pièces impossible: ${error.message}` });
  }
});

app.post("/api/pieces", requireAuth, requirePermission("machines","edit"), async (req, res) => {
  try {
    const nom = String(req.body.nom || "").trim();
    const reference = String(req.body.reference || "").trim() || null;
    const description = String(req.body.description || "").trim() || null;
    const machine = String(req.body.machine || "").trim();
    if (!nom) return res.status(400).json({ error: "Le nom de la pièce est obligatoire" });
    if (reference) {
      const duplicate = await supabaseRequest("pieces", { query: `?select=id&reference=eq.${encodeURIComponent(reference)}&limit=1` });
      if (duplicate.length) return res.status(409).json({ error: "Cette référence existe déjà" });
    }
    const duplicateName = await supabaseRequest("pieces", { query: `?select=id&nom=ilike.${encodeURIComponent(nom)}&limit=1` });
    if (duplicateName.length) return res.status(409).json({ error: "Cette pièce existe déjà dans le référentiel" });
    if (machine) {
      const machines = await supabaseRequest("machines", { query: `?select=tag,unite,departement&tag=eq.${encodeURIComponent(machine)}&limit=1` });
      const allowed = await allowedUnitsForUser(req.user);
      if (!machines[0] || !allowed.includes(machines[0].unite) || !machineInDepartment(req.user,machines[0])) return res.status(403).json({ error: "Machine non autorisée" });
    }
    const rows = await supabaseRequest("pieces", {
      method: "POST", query: "?select=*", prefer: "return=representation",
      body: [{ reference, nom, description, actif: true }]
    });
    const piece = rows?.[0];
    if (!piece) throw new Error("Supabase n'a pas retourné la pièce créée");
    if (machine) await attachPieceToMachine(piece, machine);
    return res.status(201).json(piece);
  } catch (error) {
    res.status(502).json({ error: `Création pièce impossible: ${error.message}` });
  }
});

app.post("/api/pieces/:id/machines", requireAuth, requirePermission("machines","edit"), async (req, res) => {
  try {
    const machine = String(req.body.machine || "").trim();
    if (!machine) return res.status(400).json({ error: "Machine obligatoire" });
    const machines = await supabaseRequest("machines", { query: `?select=tag,unite,departement&tag=eq.${encodeURIComponent(machine)}&limit=1` });
    const allowed = await allowedUnitsForUser(req.user);
    if (!machines[0] || !allowed.includes(machines[0].unite) || !machineInDepartment(req.user,machines[0])) return res.status(403).json({ error: "Machine non autorisée" });
    const pieces = await supabaseRequest("pieces", { query: `?select=id,reference,nom&actif=eq.true&id=eq.${encodeURIComponent(req.params.id)}&limit=1` });
    if (!pieces[0]) return res.status(404).json({ error: "Pièce introuvable" });
    await attachPieceToMachine(pieces[0], machine);
    return res.json({ ok: true });
  } catch (error) {
    res.status(502).json({ error: `Association de la pièce impossible: ${error.message}` });
  }
});



// Tableau statistique unique : mêmes restrictions d'unités et métier que les modules.
// Aucun rôle ne peut élargir son périmètre via des paramètres de requête.
app.get("/api/stats/overview", requireAuth, requireModule("stats"), async (req,res)=>{
  try{
    const [units,pannes,pm,operating,machines]=await Promise.all([
      allowedUnitsForUser(req.user),
      remoteModuleRows("liste",req.user),
      remoteModuleRows("pm",req.user),
      remoteModuleRows("operating",req.user),
      visibleMachineRows(req.user)
    ]);
    const allowed=new Set(units);
    // Le périmètre d'un électricien s'applique aux WO/PM avant la consolidation.
    // Les relevés Operating Time concernent l'utilisation physique de la machine.
    const assets=machines.filter(m=>allowed.has(m.unite));
    const tags=new Set(assets.map(m=>m.tag));
    const safeOperating=operating.filter(o=>tags.has(o.machine));
    return res.json({
      pannes:pannes.map(p=>({
        id:p.id,wo:p.wo,machine:p.machine,unite:p.unite,service:p.service,
        date_panne:p.date_panne,statut:p.statut,downtime:p.downtime,
        technicien:p.technicien,probleme:p.probleme
      })),
      pm:pm.map(p=>({
        id:p.id,machine_tag:p.machine_tag,unite:p.unite,date_prevue:p.date_prevue,
        statut:p.statut,frequence:p.frequence,service_intervenant:p.service_intervenant
      })),
      operating:safeOperating.map(o=>({
        machine:o.machine,date_jour:o.date_jour,heures_marche:o.heures_marche,
        heures_planifiees:o.heures_planifiees,heures_arret:o.heures_arret
      })),
      machines:assets,
      units:[...allowed].sort((a,b)=>a.localeCompare(b,"fr")),
      scope:{electricite:isElectrician(req.user),site:"Unités autorisées"}
    });
  }catch(err){
    return res.status(502).json({error:"Statistiques : "+String(err.message||"Données indisponibles")});
  }
});

app.get("/api/dashboard",requireAuth,requireModule("accueil"),async(req,res)=>{
  try{
    const [units,machines,employees,pannes,pm]=await Promise.all([
      allowedUnitsForUser(req.user),visibleMachineRows(req.user),remoteEffectifWithUnits(req.user),
      remoteModuleRows("liste",req.user),remoteModuleRows("pm",req.user)
    ]);
    const month=localTimestamp().slice(0,7),realized=["Réalisée","Non conforme"];
    const allowedMachines=machines.filter(row=>Number(row.actif)===1);
    return res.json({
      machines:allowedMachines.length,
      techniciens:employees.filter(row=>row.actif===true).length,
      pannesOuvertes:pannes.filter(row=>!isClosedPanne(row.statut)).length,
      pannesFermees:pannes.filter(row=>isClosedPanne(row.statut)&&String(row.date_panne||"").startsWith(month)).length,
      pmProgrammee:pm.filter(row=>!realized.includes(row.statut)&&(String(row.date_prevue||"").startsWith(month)||String(row.date_prevue||"")<month+"-01")).length,
      pmRealisees:pm.filter(row=>realized.includes(row.statut)&&String(row.date_prevue||"").startsWith(month)).length,
      recentPannes:pannes.slice().sort((a,b)=>String(b.date_panne||"").localeCompare(String(a.date_panne||""))).slice(0,6),
      upcomingPM:pm.filter(row=>!realized.includes(row.statut)).slice().sort((a,b)=>String(a.date_prevue||"").localeCompare(String(b.date_prevue||""))).slice(0,5),
      scope:{department:isAdmin(req.user)?"Tous les départements":req.user.service||"Non affecté",
             locations:units,lead:isLead(req.user),admin:isAdmin(req.user)},month
    });
  }catch(error){return res.status(502).json({error:"Chargement du tableau de bord impossible : "+error.message});}
});


app.get("/api/modules/:module", requireAuth, (req, res, next) => requireModule(req.params.module)(req, res, next), async (req, res) => {
  const module = req.params.module;
  if (module === "machines") {
    try { return res.json(await visibleMachineRows(req.user)); }
    catch (error) { return res.status(502).json({ error: `Chargement machines impossible: ${error.message}` }); }
  }
  if (module === "effectif") {
    if(!isAdmin(req.user)&&!isLead(req.user))return res.status(403).json({error:"Module Effectif réservé aux responsables."});
    try { return res.json(await remoteEffectifWithUnits(req.user)); }
    catch (error) { return res.status(502).json({ error: `Chargement effectif impossible: ${error.message}` }); }
  }
  try {
    if (["liste", "saisie", "pm", "operating", "sop"].includes(module)) {
      return res.json(await remoteModuleRows(module, req.user));
    }
    if (module === "parametres") {
      return res.json(await desktopSettings.list());
    }
    return res.status(404).json({ error: "Module inconnu" });
  } catch (error) {
    return res.status(502).json({ error: `Chargement ${module} depuis Supabase impossible: ${error.message}` });
  }
});



app.post("/api/pm", requireAuth, requirePermission("pm","create"), async (req, res) => {
  try {
    const unit = String(req.body.unite || "");
    const tag = String(req.body.machine_tag || "");
    const allowed = pmLocationsForUser(req.user,await allowedUnitsForUser(req.user));
    if (!allowed.includes(unit)) return res.status(403).json({ error: "Localisation non autorisée" });
    const machines = await supabaseRequest("machines", { query: `?select=tag,designation,unite,departement&tag=eq.${encodeURIComponent(tag)}&actif=eq.1&limit=1` });
    const machine = machines[0];
    if (!machine || machine.unite !== unit || !machineInDepartment(req.user,machine)) return res.status(403).json({ error: "Machine ou département non autorisé" });
    const date = String(req.body.date_prevue || "");
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match || !req.body.frequence) return res.status(400).json({ error: "Date et fréquence obligatoires" });
    const duplicate = await supabaseRequest("pm_programmees", { query: `?select=id&machine_tag=eq.${encodeURIComponent(tag)}&date_prevue=eq.${date}&limit=1` });
    if (duplicate.length) return res.status(409).json({ error: "Cette PM existe déjà pour cette machine et cette date" });
    const months = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    const payload = {
      uuid: crypto.randomUUID(), machine_tag: tag, machine_designation: machine.designation || "",
      unite: unit, frequence: String(req.body.frequence),
      tolerance_jours: Number(req.body.tolerance_jours || 7), date_prevue: date,
      mois: months[Number(match[2])-1] || "", annee: Number(match[1]),
      statut: "Planifiée", responsable: [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim(),
      service_intervenant: req.user.role==="admin" ? (String(req.body.service_intervenant || "").trim() || null) : (req.user.service || null),
      commentaire: req.body.commentaire || "", motif_report: req.body.motif_report || "",
      date_creation: localTimestamp(), source: "web"
    };
    const created = await supabaseRequest("pm_programmees", { method: "POST", query: "?select=*", prefer: "return=representation", body: [payload] });
    return res.status(201).json(created?.[0] || payload);
  } catch (error) { return res.status(502).json({ error: `Création PM Supabase impossible: ${error.message}` }); }
});

// Attribution explicite des PM historiques (administrateur uniquement).
// N'altère ni les dates, ni les résultats, ni les affectations de techniciens.
app.put("/api/pm/:id/service", requireAuth, requireModule("parametres"), async (req,res) => {
  try {
    const service=String(req.body.service_intervenant || "").trim();
    const effectifs=await supabaseRequest("effectif",{query:"?select=service&limit=1000"});
    const permitted=new Set(effectifs.map(row=>normService(row.service)).filter(Boolean));
    if (service && !permitted.has(normService(service))) return res.status(400).json({error:"Service non référencé."});
    const updated=await supabaseRequest("pm_programmees",{
      method:"PATCH",query:`?id=eq.${encodeURIComponent(req.params.id)}&select=id,service_intervenant`,
      prefer:"return=representation",body:{service_intervenant:service || null}
    });
    if (!updated?.length) return res.status(404).json({error:"PM introuvable."});
    return res.json(updated[0]);
  } catch(err){return res.status(502).json({error:`Attribution du service impossible : ${err.message}`});}
});

app.post("/api/pm/:id/realiser", requireAuth, requirePermission("pm","edit"), async (req, res) => {
  try {
    const found = await supabaseRequest("pm_programmees", { query: `?select=*&id=eq.${encodeURIComponent(req.params.id)}&limit=1` });
    const pm = found[0];
    if (!pm) return res.status(404).json({ error: "PM introuvable" });
    if (pm.statut !== "Planifiée") return res.status(400).json({ error: "Cette PM n'est pas planifiée" });
    const allowed = pmLocationsForUser(req.user,await allowedUnitsForUser(req.user));
    if (!allowed.includes(pm.unite)) return res.status(403).json({ error: "Localisation non autorisée" });
    if (!pmInDepartment(req.user,pm)) return res.status(403).json({ error: "PM réservée à un autre département" });
    const machineRows=await supabaseRequest("machines",{query:"?select=tag,unite,departement&tag=eq."+encodeURIComponent(pm.machine_tag)+"&limit=1"});
    if(!machineRows[0]||machineRows[0].unite!==pm.unite||!machineInDepartment(req.user,machineRows[0]))
      return res.status(403).json({error:"Machine PM hors de votre département."});
    const startText = String(req.body.date_debut || "").replace("T", " ").slice(0,16);
    const endText = String(req.body.date_fin || "").replace("T", " ").slice(0,16);
    const start = new Date(startText.replace(" ","T")), end = new Date(endText.replace(" ","T"));
    if (!startText || !endText || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      return res.status(400).json({ error: "Les dates de début et de fin sont invalides" });
    }
    const technician = req.user.role === "admin" ? String(req.body.technicien || "").trim() : [req.user.nom, req.user.prenom].filter(Boolean).join(" ").trim();
    if (!technician) return res.status(400).json({ error: "Technicien obligatoire" });
    const now = localTimestamp();
    const payload = {
      uuid: crypto.randomUUID(), id_pm_prog: pm.id, machine_tag: pm.machine_tag,
      machine_designation: pm.machine_designation || "", unite: pm.unite, date_prevue: pm.date_prevue,
      date_debut: startText, date_fin: endText, downtime: Math.max(0, Math.round((end-start)/60000)),
      technicien: technician, ponctualite: "À l'heure", commentaire: req.body.commentaire || "",
      statut: "Réalisée", date_creation: now, source: "web"
    };
    const realized = await supabaseRequest("pm_realisees", { method: "POST", query: "?select=*", prefer: "return=representation", body: [payload] });
    await supabaseRequest("pm_programmees", { method: "PATCH", query: `?id=eq.${encodeURIComponent(pm.id)}`, prefer: "return=minimal", body: { statut: "Réalisée", date_modification: now } });
    return res.status(201).json(realized?.[0] || payload);
  } catch (error) { return res.status(502).json({ error: `Réalisation PM Supabase impossible: ${error.message}` }); }
});



// Activation explicite des comptes existants sans identifiants.
// Les comptes déjà protégés ne sont jamais réinitialisés automatiquement.
app.post("/api/users/:id/activate-login",requireAuth,requireModule("parametres"),async(req,res)=>{
 try{
  const id=String(req.params.id||"").trim();
  if(!id)return res.status(400).json({error:"Identifiant manquant."});
  const rows=await supabaseRequest("effectif",{
   query:"?select=id,matricule,nom,prenom,username,password_hash,role,actif&id=eq."+encodeURIComponent(id)+"&limit=1"
  });
  const account=rows[0];
  if(!account)return res.status(404).json({error:"Collaborateur introuvable."});
  if(!account.matricule||!account.nom||!account.prenom)
   return res.status(400).json({error:"Matricule, nom et prénom obligatoires."});
  if(account.username&&account.password_hash)
   return res.status(409).json({error:"Ce compte possède déjà des identifiants : aucune modification effectuée."});
  const username=account.username||
   await availableUsername(account.nom,account.prenom,account.matricule,supabaseRequest);
  const patch={
   username,
   ...(!account.password_hash?{password_hash:bcrypt.hashSync(String(account.matricule),10)}:{}),
   updated_at:new Date().toISOString()
  };
  const updated=await supabaseRequest("effectif",{method:"PATCH",
    query:"?id=eq."+encodeURIComponent(id)+"&select=id,username,matricule,actif",
    prefer:"return=representation",body:patch});
  if(!updated?.length)throw new Error("Activation non confirmée.");
  return res.json({ok:true,username,actif:updated[0].actif,requiresPasswordChange:true});
 }catch(e){return res.status(502).json({error:"Activation du compte impossible : "+e.message});}
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

app.get("/api/effectif/context", requireAuth, requireModule("effectif"), (req,res,next)=>isAdmin(req.user)?next():res.status(403).json({error:"Référentiel RH réservé à l’administrateur."}), async (req, res) => {
  try {
    const [machines, employees, references] = await Promise.all([
      Promise.all([supabaseRequest("machines", { query: "?select=unite&actif=eq.1" }),
                   supabaseRequest("effectif_unites", { query: "?select=unite" })]).then(parts=>parts.flat()),
      supabaseRequest("effectif", { query: "?select=service,fonction&actif=eq.true" }),
      desktopSettings.list()
    ]);
    const scoped=isAdmin(req.user)?employees:employees.filter(row=>sameDepartment(req.user,row.service));
    res.json({
      units: isAdmin(req.user)?[...new Set([...machines.map(row => row.unite),...references.filter(r=>r.type_liste==="unite"&&r.actif).map(r=>r.valeur),...LOCALISATION_CODES.map(r=>r.code),"SG01","SG02"].filter(Boolean))].sort():await allowedUnitsForUser(req.user),
      services: [...new Set([...(!isAdmin(req.user)?[]:references.filter(r=>r.type_liste==="service"&&r.actif).map(r=>r.valeur)),...scoped.map(row => row.service)].filter(Boolean))].sort(),
      functions: [...new Set([...(!isAdmin(req.user)?[]:references.filter(r=>r.type_liste==="fonction"&&r.actif).map(r=>r.valeur)),...scoped.map(row => row.fonction)].filter(Boolean))].sort()
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
    site: employee.site || null,
    initiale: employee.initiale || null,
    type_contrat: employee.type_contrat || null,
    date_fin_contrat: employee.date_fin_contrat || null,
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


const EF_SITES = ["Site 01", "Site 02"];
const EF_BOTH = "Site 01; Site 02";
const efSiteUnit = localisationSite;
function effectifRHPayload(body) {
  const units = body.toutes_unites ? [] : [...new Set((Array.isArray(body.units) ? body.units : []).map(x => String(x).trim()).filter(Boolean))];
  const affected = body.toutes_unites || body.is_admin ? EF_SITES : EF_SITES.filter(s => units.some(u => efSiteUnit(u) === s));
  const derived = affected.join("; ");
  const requested = String(body.site || "").trim();
  if (requested && ![...EF_SITES, EF_BOTH].includes(requested)) throw new Error("Site invalide.");
  if (derived && requested && derived !== requested) throw new Error("Le site ne correspond pas aux localisations affectées.");
  const type = String(body.type_contrat || "").trim().toUpperCase() || null;
  const start = String(body.date_debut_contrat || "").trim() || null;
  const end = String(body.date_fin_contrat || "").trim() || null;
  const dateValid = d => d && /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(new Date(d+"T12:00:00Z").valueOf()) &&
    new Date(d+"T12:00:00Z").toISOString().slice(0,10) === d;
  if (type && !["CDI","CDD","APPRENTISSAGE","AUTRE"].includes(type))
    throw new Error("Type de contrat invalide.");
  if (start && !dateValid(start)) throw new Error("Début de contrat invalide (AAAA-MM-JJ).");
  if (end && !dateValid(end)) throw new Error("Fin de contrat invalide (AAAA-MM-JJ).");
  if (type === "CDD" && !end) throw new Error("Date de fin du CDD obligatoire.");
  if (type === "CDI" && end) throw new Error("Un CDI ne peut pas avoir de date de fin.");
  if (start && end && end < start) throw new Error("Date de fin antérieure au début du contrat.");
  if (end && body.date_recrutement && end < String(body.date_recrutement).slice(0,10))
    throw new Error("Date de fin antérieure au recrutement.");
  return { units, rh: { site: derived || requested || null,
    initiale: String(body.initiale || "").trim() || null,
    type_contrat: type, date_debut_contrat: start, date_fin_contrat: end,
    commentaire_depart: String(body.commentaire_depart || "").trim().slice(0,2000) || null } };
}

app.post("/api/effectif", requireAuth, requirePermission("effectif","create"), (req,res,next)=>isAdmin(req.user)?next():res.status(403).json({error:"Gestion RH réservée à l’administrateur."}), async (req, res) => {
  const matricule = String(req.body.matricule || "").trim();
  const nom = String(req.body.nom || "").trim();
  const prenom = String(req.body.prenom || "").trim();
  const service = String(req.body.service || "").trim();
  const fonction = String(req.body.fonction || "").trim();
  if (!matricule || !nom || !service || !fonction) {
    return res.status(400).json({ error: "Matricule, nom, service et fonction sont obligatoires" });
  }
  try {
    if(!isAdmin(req.user)&&(!sameDepartment(req.user,service)||req.body.is_admin||req.body.toutes_unites))
      return res.status(403).json({error:"Création RH limitée à votre département, sans privilèges administrateur."});
    if(!isAdmin(req.user)){
      const allowed=await allowedUnitsForUser(req.user);
      if(!Array.isArray(req.body.units)||req.body.units.some(u=>!allowed.includes(u)))
        return res.status(403).json({error:"Localisations RH non autorisées."});
    }
    const duplicate = await supabaseRequest("effectif", {
      query: `?select=id&matricule=eq.${encodeURIComponent(matricule)}&limit=1`
    });
    if (duplicate.length) return res.status(409).json({ error: "Ce matricule existe déjà" });

    const username=await availableUsername(nom,prenom,matricule,supabaseRequest);

    const role = req.body.is_admin ? "admin" :
      (/superviseur|supervisor/i.test(fonction) ? "superviseur" : "technicien");
    const { rh, units } = effectifRHPayload(req.body);
    const payload = {
      matricule, nom, prenom, service, fonction, role, ...rh,
      ...(Object.prototype.hasOwnProperty.call(req.body,"telephone")?{telephone:String(req.body.telephone||"").trim()||null}:{}),
      ...(Object.prototype.hasOwnProperty.call(req.body,"email")?{email:String(req.body.email||"").trim()||null}:{}),
      actif: isAdmin(req.user)?req.body.actif !== false:false,
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

    if (units.length) {
      await supabaseRequest("effectif_unites", {
        method: "POST", prefer: "return=minimal",
        body: units.map(unite => ({ effectif_id: employee.id, unite }))
      });
    }
    const {password_hash,...safeEmployee}=employee;
    return res.status(201).json({ ...safeEmployee, is_admin: role === "admin", units });
  } catch (error) {
    return res.status(502).json({ error: `Création Supabase impossible: ${error.message}` });
  }
});

// La suppression RH est une opération administrative explicite.
// Les liens historiques/FK Supabase empêchent toute suppression dangereuse.
app.delete("/api/effectif/:id", requireAuth, (req,res,next)=>
  isAdmin(req.user)?next():res.status(403).json({error:"Suppression RH réservée aux administrateurs."}),
  async (req,res)=>{
    const id=String(req.params.id||"").trim();
    if(!id)return res.status(400).json({error:"Identifiant manquant."});
    if(id===String(req.user.supabase_id||req.user.id))
      return res.status(403).json({error:"Vous ne pouvez pas supprimer votre propre compte."});
    try{
      const rows=await supabaseRequest("effectif",{
        query:"?select=id,role,actif,username&id=eq."+encodeURIComponent(id)+"&limit=1"
      });
      const employee=rows?.[0];
      if(!employee)return res.status(404).json({error:"Collaborateur introuvable."});
      if(employee.role==="admin")return res.status(409).json({error:"Compte administrateur protégé : modifier son rôle séparément."});
      if(employee.actif||employee.username)
        return res.status(409).json({error:"Désactiver le compte et retirer ses accès avant toute suppression définitive."});
      const linked=await supabaseRequest("effectif_unites",{
        query:"?select=unite&effectif_id=eq."+encodeURIComponent(id)
      });
      if(linked?.length)return res.status(409).json({error:"Retirer les affectations de localisation avant suppression."});
      await supabaseRequest("effectif",{method:"DELETE",query:"?id=eq."+encodeURIComponent(id),prefer:"return=minimal"});
      return res.json({ok:true});
    }catch(error){return res.status(409).json({error:"Suppression impossible : ce collaborateur est peut-être lié à des historiques. "+error.message});}
  });

app.put("/api/effectif/:id", requireAuth, requirePermission("effectif","edit"), (req,res,next)=>isAdmin(req.user)?next():res.status(403).json({error:"Gestion RH réservée à l’administrateur."}), async (req, res) => {
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
    if(!isAdmin(req.user)){
      // RH déléguée : seules les coordonnées sont modifiables ; jamais le rôle, les sites ni les comptes.
      const existing=await supabaseRequest("effectif",{query:"?select=id,role,service&id=eq."+encodeURIComponent(id)+"&limit=1"});
      if(!existing[0]||existing[0].role==="admin"||!sameDepartment(req.user,existing[0].service))
        return res.status(403).json({error:"Collaborateur hors département ou compte protégé."});
      const payload={initiale:String(req.body.initiale||"").trim()||null,
        telephone:String(req.body.telephone||"").trim()||null,
        email:String(req.body.email||"").trim()||null,updated_at:new Date().toISOString()};
      const updated=await supabaseRequest("effectif",{method:"PATCH",query:"?id=eq."+encodeURIComponent(id)+"&select=*",prefer:"return=representation",body:payload});
      const {password_hash,...safe}=updated?.[0]||{};
      return res.json(safe);
    }
    const duplicate = await supabaseRequest("effectif", {
      query: `?select=id&matricule=eq.${encodeURIComponent(matricule)}&id=neq.${encodeURIComponent(id)}&limit=1`
    });
    if (duplicate.length) return res.status(409).json({ error: "Ce matricule existe déjà" });
    const role = req.body.is_admin ? "admin" :
      (/superviseur|supervisor/i.test(fonction) ? "superviseur" : "technicien");
    const { rh, units } = effectifRHPayload(req.body);
    const payload = {
      matricule, nom, prenom, service, fonction, role, ...rh,
      ...(Object.prototype.hasOwnProperty.call(req.body,"telephone")?{telephone:String(req.body.telephone||"").trim()||null}:{}),
      ...(Object.prototype.hasOwnProperty.call(req.body,"email")?{email:String(req.body.email||"").trim()||null}:{}),
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

app.post("/api/pannes", requireAuth, requirePermission("saisie","create"), async (req, res) => {
  try {
    const body = { ...req.body };
    const required = ["wo","date_panne","unite","machine","area","probleme","commentaire","statut"];
    const missing = required.filter(key => String(body[key] ?? "").trim() === "");
    if (missing.length) return res.status(400).json({ error: `Champs obligatoires manquants : ${missing.join(", ")}` });
    const allowed = await allowedUnitsForUser(req.user);
    if (!allowed.includes(body.unite)) return res.status(403).json({ error: "Localisation non autorisée" });
    const machineRows = await supabaseRequest("machines", { query: `?select=tag,unite,zone,departement&tag=eq.${encodeURIComponent(body.machine)}&limit=1` });
    const machine = machineRows[0];
    if (!machine || machine.unite !== body.unite || !machineInDepartment(req.user,machine)) return res.status(403).json({ error: "Machine ou département non autorisé" });
    const duplicate = await supabaseRequest("pannes", { query: `?select=id&wo=eq.${encodeURIComponent(String(body.wo).trim())}&limit=1` });
    if (duplicate.length) return res.status(409).json({ error: "Ce numéro WO existe déjà" });
    const split = value => {
      const text = String(value || "").trim().replace("T", " ");
      const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?/);
      return match ? { date: match[1], time: match[2] || "" } : { date: text.slice(0,10), time: "" };
    };
    const panneDate = split(body.date_panne);
    const dateStart = split(body.date_debut), dateEnd = split(body.date_fin);
    const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    const startDate = dateStart.date && dateStart.time ? `${dateStart.date} ${dateStart.time}` : String(body.date_debut || "");
    const endDate = dateEnd.date && dateEnd.time ? `${dateEnd.date} ${dateEnd.time}` : String(body.date_fin || "");
    const selectedParts = Array.isArray(body.pieces) ? body.pieces.filter(piece => String(piece.nom_piece || "").trim()) : [];
    const payload = {
      uuid: crypto.randomUUID(), wo: String(body.wo).trim(), date_panne: panneDate.date,
      heure_panne: body.heure_panne || panneDate.time || null,
      date_debut: startDate || null, date_fin: endDate || null, unite: body.unite,
      cree_par_effectif_id:req.user.supabase_id||null,
      machine: body.machine, probleme: body.probleme, area: String(body.area || machine.zone || "").trim(),
      service: req.user.role === "admin" ? body.service : (req.user.service || ""),
      mois: monthNames[Number(panneDate.date.slice(5,7))-1] || "",
      technicien: req.user.role === "admin" ? body.technicien : [req.user.nom,req.user.prenom].filter(Boolean).join(" "),
      downtime: Number(body.downtime || 0), statut: canonicalPanneStatus(body.statut),
      commentaire: body.commentaire,
      pieces_consommees: selectedParts.map(piece => `${piece.reference_piece ? piece.reference_piece+" — " : ""}${piece.nom_piece} (x${Math.max(1,Number(piece.quantite||1))})`).join("; ") || null,
      date_creation: localTimestamp(), source: "web"
    };
    if (!payload.heure_panne || !payload.date_debut || !payload.date_fin || !payload.service || !payload.technicien) {
      return res.status(400).json({ error: "Date/heure, début, fin, service et technicien sont obligatoires" });
    }
    const createdRows = await supabaseRequest("pannes", { method: "POST", query: "?select=*", prefer: "return=representation", body: [payload] });
    const created = createdRows?.[0];
    if (!created) throw new Error("La panne a été envoyée mais Supabase n'a retourné aucun enregistrement");
    if (selectedParts.length) {
      const historyRows = [];
      for (const part of selectedParts) {
        let pieceId = part.piece_id ? Number(part.piece_id) : null;
        if (pieceId) {
          const found = await supabaseRequest("pieces", { query: `?select=id,reference,nom&actif=eq.true&id=eq.${encodeURIComponent(pieceId)}&limit=1` });
          if (!found[0]) pieceId = null;
          else await attachPieceToMachine(found[0], body.machine);
        }
        historyRows.push({
          panne_id: created.id, piece_id: pieceId, machine: body.machine, wo: payload.wo,
          reference: part.reference_piece || null, nom: String(part.nom_piece).trim(),
          quantite: Math.max(1, Number(part.quantite || 1)), date_utilisation: panneDate.date,
          technicien: payload.technicien || null
        });
      }
      await supabaseRequest("panne_pieces", { method: "POST", query: "?select=*", prefer: "return=representation", body: historyRows });
    }
    return res.status(201).json(created);
  } catch (error) {
    return res.status(502).json({ error: `Enregistrement panne Supabase impossible: ${error.message}` });
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

app.put("/api/tables/pannes/:id",requireAuth,requirePermission("liste","edit"),async(req,res)=>{
  try{
    const found=await supabaseRequest("pannes",{query:"?select=*&id=eq."+encodeURIComponent(req.params.id)+"&limit=1"});
    const panne=found[0];
    if(!panne)return res.status(404).json({error:"Panne introuvable."});
    const units=await allowedUnitsForUser(req.user);
    if(!units.includes(panne.unite)||!panneInDepartment(req.user,panne))
      return res.status(403).json({error:"Panne hors de votre localisation ou département."});
    if(!await panneCanBeEdited(req.user,panne))
      return res.status(403).json({error:"Seul l'auteur ou un responsable de ce département peut modifier cette panne."});
    const newUnit=String(req.body.unite??panne.unite);
    if(!units.includes(newUnit))return res.status(403).json({error:"Localisation non autorisée."});
    const newTag=String(req.body.machine??panne.machine);
    const match=await supabaseRequest("machines",{query:"?select=tag,unite,departement&tag=eq."+encodeURIComponent(newTag)+"&limit=1"});
    if(!match[0]||match[0].unite!==newUnit||!machineInDepartment(req.user,match[0]))
      return res.status(403).json({error:"Machine ou département non autorisé."});
    const fields=isAdmin(req.user)?
      ["wo","date_panne","heure_panne","date_debut","date_fin","unite","machine","probleme","area","service","mois","technicien","downtime","statut","commentaire","pieces_consommees"]:
      isLead(req.user)?
      ["date_panne","heure_panne","date_debut","date_fin","unite","machine","probleme","area","mois","technicien","downtime","statut","commentaire","pieces_consommees"]:
      ["date_debut","date_fin","probleme","area","downtime","statut","commentaire","pieces_consommees"];
    const payload=Object.fromEntries(Object.entries(req.body).filter(([k])=>fields.includes(k)));
    if(!Object.keys(payload).length)return res.status(400).json({error:"Aucun champ modifiable fourni."});
    if(Object.prototype.hasOwnProperty.call(payload,"statut"))payload.statut=canonicalPanneStatus(payload.statut);
    payload.date_modification=localTimestamp();
    const rows=await supabaseRequest("pannes",{method:"PATCH",query:"?id=eq."+encodeURIComponent(req.params.id)+"&select=*",prefer:"return=representation",body:payload});
    return res.json({...rows[0],peut_modifier:true});
  }catch(e){return res.status(502).json({error:"Modification panne impossible : "+e.message});}
});


app.get("/api/tables/:table", requireAuth, async (req, res) => {
  const table = req.params.table;
  const key=({pannes:"liste",pm_programmees:"pm",pm_realisees:"pm",operating_time:"operating",ref_listes:"parametres"})[table]||table;
  if(!permissionAllowed(req.user,key,"view"))return res.status(403).json({error:"Lecture de ce module non autorisée."});
  if (!["machines","pannes","pm_programmees","pm_realisees","operating_time","sop","ref_listes"].includes(table)) return res.status(404).json({ error: "Table non disponible" });
  if(table==="ref_listes"&&!isAdmin(req.user))return res.status(403).json({error:"Réservé aux administrateurs."});
  try {
    if (["pannes","pm_programmees","operating_time","sop"].includes(table)) {
      const module = ({pannes:"liste",pm_programmees:"pm",operating_time:"operating",sop:"sop"})[table];
      return res.json(await remoteModuleRows(module, req.user));
    }
    if(table==="machines")return res.json(await visibleMachineRows(req.user));
    const rows=await supabaseReadAll(table,"?select=*&order=id.desc");
    if(table==="pm_realisees"&&!isAdmin(req.user)){
      const pms=await remoteModuleRows("pm",req.user);
      const allowedIds=new Set(pms.map(pm=>String(pm.id)));
      return res.json(rows.filter(row=>allowedIds.has(String(row.id_pm_prog))));
    }
    if(table==="ref_listes"&&!isAdmin(req.user))return res.status(403).json({error:"Réservé aux administrateurs."});
    return res.json(rows);
  } catch (error) { return res.status(502).json({ error: `Lecture Supabase impossible: ${error.message}` }); }
});




async function validateMachineLocation(body){
  const site=String(body.site||"").trim();
  const loc=String(body.unite||"").trim();
  if(!SITES.includes(site))throw new Error("Site obligatoire : Site 01 ou Site 02.");
  if(!loc||localisationSite(loc)!==site)throw new Error("La localisation doit correspondre au site choisi.");
  const refs=await desktopSettings.list();
  const valid=refs.some(x=>x.type_liste==="unite"&&x.valeur===loc&&x.actif);
  // When editing a legacy location, the existing machine list may contain a
  // code not yet registered in the shared settings. Preserve it when used.
  if(!valid){
    const existing=await supabaseRequest("machines",{query:"?select=id&unite=eq."+encodeURIComponent(loc)+"&limit=1"});
    if(!existing.length)throw new Error("Localisation non référencée dans Paramètres.");
  }
  return {site,unite:loc};
}

app.post("/api/tables/:table", requireAuth, async (req, res) => {
  const table = req.params.table;
  if(table==="machines"){
    if(!permissionAllowed(req.user,"machines","create"))return res.status(403).json({error:"Ajout de machine non autorisé."});
    try{
      const tag=String(req.body.tag||"").trim(),designation=String(req.body.designation||"").trim();
      if(!tag||!designation)return res.status(400).json({error:"Tag et désignation obligatoires."});
      const location=await validateMachineLocation(req.body);
      const allowed=await allowedUnitsForUser(req.user);
      if(!allowed.includes(location.unite))return res.status(403).json({error:"Localisation non autorisée."});
      if(!isAdmin(req.user)&&!req.user.service)return res.status(403).json({error:"Département non défini."});
      const duplicate=await supabaseRequest("machines",{query:"?select=id&tag=eq."+encodeURIComponent(tag)+"&limit=1"});
      if(duplicate.length)return res.status(409).json({error:"Ce tag machine existe déjà."});
      const body=machineFieldsFromBody({...req.body,...location,departement:isAdmin(req.user)?(String(req.body.departement||"").trim()||null):req.user.service},true);
      const rows=await supabaseRequest("machines",{method:"POST",query:"?select=*",prefer:"return=representation",body:[body]});
      return res.status(201).json(rows?.[0]||body);
    }catch(e){return res.status(400).json({error:"Machine : "+e.message});}
  }
  if (table === "sop") {
    if(!permissionAllowed(req.user,"sop","create"))return res.status(403).json({error:"Ajout SOP non autorisé."});
    try {
      const allowed=await allowedUnitsForUser(req.user);
      if(req.body.unite&&!allowed.includes(req.body.unite))return res.status(403).json({error:"Localisation non autorisée."});
      const payload = {
        uuid: crypto.randomUUID(), code: String(req.body.code || "").trim(),
        titre: String(req.body.titre || "").trim(), version: req.body.version || null,
        machine: req.body.machine || null, unite: req.body.unite || null,
        date_application: req.body.date_application || null, date_revision: req.body.date_revision || null,
        validateur: req.body.validateur || null, chemin_fichier: req.body.chemin_fichier || null,
        commentaire: req.body.commentaire || null, actif: Number(req.body.actif ?? 1),
        date_creation: localTimestamp(), source: "web"
      };
      if (!payload.code || !payload.titre) return res.status(400).json({ error: "Code et titre obligatoires" });
      const rows = await supabaseRequest("sop", { method: "POST", query: "?select=*", prefer: "return=representation", body: [payload] });
      return res.status(201).json(rows?.[0] || payload);
    } catch (error) { return res.status(502).json({ error: `Création SOP impossible: ${error.message}` }); }
  }
  if (table === "ref_listes" && req.user.role !== "admin") return res.status(403).json({ error: "Réservé aux administrateurs" });
  return res.status(400).json({ error: "Création non prise en charge pour cette table" });
});



app.put("/api/tables/:table/:id", requireAuth, async (req, res) => {
  const table = req.params.table;
  if(table==="machines"){
    if(!permissionAllowed(req.user,"machines","edit"))return res.status(403).json({error:"Modification de machine non autorisée."});
    try{
      const found=await supabaseRequest("machines",{query:"?select=*&id=eq."+encodeURIComponent(req.params.id)+"&limit=1"});
      if(!found.length)return res.status(404).json({error:"Machine introuvable."});
      const location=await validateMachineLocation({...found[0],...req.body});
      const allowed=await allowedUnitsForUser(req.user);
      if(!isAdmin(req.user)&&(!allowed.includes(found[0].unite)||!allowed.includes(location.unite)||!machineInDepartment(req.user,found[0])))return res.status(403).json({error:"Machine hors de votre localisation ou département."});
      const tag=String(req.body.tag??found[0].tag).trim(),designation=String(req.body.designation??found[0].designation).trim();
      if(!tag||!designation)return res.status(400).json({error:"Tag et désignation obligatoires."});
      // Changing the machine tag would disconnect all historical WO/PM/OT links.
      if(tag!==found[0].tag)return res.status(409).json({error:"Le tag d'une machine existante ne peut pas être changé : historique lié."});
      const newLoc=location.unite;
      if(newLoc!==found[0].unite){
        const [pannes,pm,ot]=await Promise.all([
          supabaseRequest("pannes",{query:"?select=id&machine=eq."+encodeURIComponent(tag)+"&limit=1"}),
          supabaseRequest("pm_programmees",{query:"?select=id&machine_tag=eq."+encodeURIComponent(tag)+"&limit=1"}),
          supabaseRequest("operating_time",{query:"?select=id&machine=eq."+encodeURIComponent(tag)+"&limit=1"})
        ]);
        if(pannes.length||pm.length||ot.length)
          return res.status(409).json({error:"Cette machine possède un historique : sa localisation ne peut pas être changée sans migration des interventions associées."});
      }
      const payload=machineFieldsFromBody({...req.body,...location,departement:isAdmin(req.user)?(String(req.body.departement??found[0].departement??"").trim()||null):found[0].departement},false);
      const rows=await supabaseRequest("machines",{method:"PATCH",query:"?id=eq."+encodeURIComponent(req.params.id)+"&select=*",prefer:"return=representation",body:payload});
      return res.json(rows?.[0]||{...found[0],...payload});
    }catch(e){return res.status(400).json({error:"Modification machine : "+e.message});}
  }
  if (table === "sop") {
    if(!permissionAllowed(req.user,"sop","edit"))return res.status(403).json({error:"Modification SOP non autorisée."});
    try {
      const existing=await supabaseRequest("sop",{query:"?select=unite&id=eq."+encodeURIComponent(req.params.id)+"&limit=1"});
      if(!existing[0])return res.status(404).json({error:"SOP introuvable."});
      const units=await allowedUnitsForUser(req.user);
      if((existing[0].unite&&!units.includes(existing[0].unite))||
         (req.body.unite&&!units.includes(req.body.unite)))return res.status(403).json({error:"SOP hors localisation."});
      const allowed = ["code","titre","version","machine","unite","date_application","date_revision","validateur","chemin_fichier","commentaire","actif"];
      const payload = Object.fromEntries(Object.entries(req.body).filter(([key])=>allowed.includes(key)));
      payload.date_modification = localTimestamp();
      const rows = await supabaseRequest("sop", { method: "PATCH", query: `?id=eq.${encodeURIComponent(req.params.id)}&select=*`, prefer: "return=representation", body: payload });
      if (!rows?.length) return res.status(404).json({ error: "SOP introuvable" });
      return res.json(rows[0]);
    } catch (error) { return res.status(502).json({ error: `Modification SOP impossible: ${error.message}` }); }
  }
  return res.status(400).json({ error: "Modification non prise en charge pour cette table" });
});



app.delete("/api/tables/:table/:id", requireAuth, async (req, res) => {
  if(req.params.table==="machines"){
    if(req.user.role!=="admin")return res.status(403).json({error:"Réservé aux administrateurs."});
    try{
      const found=await supabaseRequest("machines",{query:"?select=tag&id=eq."+encodeURIComponent(req.params.id)+"&limit=1"});
      if(!found.length)return res.status(404).json({error:"Machine introuvable."});
      const tag=found[0].tag;
      const deps=await Promise.all([
        supabaseRequest("pannes",{query:"?select=id&machine=eq."+encodeURIComponent(tag)+"&limit=1"}),
        supabaseRequest("pm_programmees",{query:"?select=id&machine_tag=eq."+encodeURIComponent(tag)+"&limit=1"}),
        supabaseRequest("operating_time",{query:"?select=id&machine=eq."+encodeURIComponent(tag)+"&limit=1"})
      ]);
      if(deps.some(rows=>rows.length))return res.status(409).json({error:"Machine liée à des pannes, PM ou relevés : suppression interdite."});
      await supabaseRequest("machines",{method:"DELETE",query:"?id=eq."+encodeURIComponent(req.params.id)});
      return res.json({ok:true});
    }catch(e){return res.status(502).json({error:e.message});}
  }
  if (req.params.table !== "sop") return res.status(400).json({ error: "Suppression non prise en charge pour cette table" });
  if(!isAdmin(req.user))return res.status(403).json({error:"Suppression réservée aux administrateurs."});
  try {
    await supabaseRequest("sop", { method: "DELETE", query: `?id=eq.${encodeURIComponent(req.params.id)}` });
    return res.json({ ok: true });
  } catch (error) { return res.status(502).json({ error: `Suppression SOP impossible: ${error.message}` }); }
});



registerExcelRoutes(app,{requireAuth,supabaseRequest,remoteEffectifWithUnits,localTimestamp});
accessManager.register(app,requireAuth);
const desktopSettings=createSettingsHandlers({supabaseRequest,remoteEffectifWithUnits});
desktopSettings.register(app,requireAuth);

const clientDist = path.resolve(__dirname, "../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));

export { app };
export { initDatabase };
// On Vercel, Supabase-backed endpoints must not await the legacy SQLite cache hydrate.
export const remoteDatabaseConfigured=Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY);

if (!process.env.VERCEL) {
  initDatabase().then(() => {
    app.listen(PORT, () => console.log(`Engineering Web API: http://localhost:${PORT}`));
  }).catch(error => { console.error(error); process.exit(1); });
}
