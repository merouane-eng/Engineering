import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "./registerSW";
import {
  Activity, BookOpen, CalendarClock, Gauge, LayoutDashboard, LogOut, Menu,
  Settings, Siren, Users, Wrench, ClipboardPlus, ClipboardList, Search, Plus, Save, X
} from "lucide-react";
import "./styles.css";

const modules = [
  ["accueil", "Accueil", LayoutDashboard],
  ["machines", "Machines", Wrench],
  ["effectif", "Effectif", Users],
  ["saisie", "Saisie panne", ClipboardPlus],
  ["liste", "Liste des pannes", ClipboardList],
  ["pm", "Maintenance préventive", CalendarClock],
  ["operating", "Operating Time", Gauge],
  ["stats", "Statistiques", Activity],
  ["sop", "SOP", BookOpen],
  ["parametres", "Paramètres", Settings]
];

const fieldsByModule = {
  machines: [
    ["tag", "Tag"], ["designation", "Désignation"], ["unite", "Unité"], ["groupe", "Groupe"],
    ["zone", "Zone"], ["marque", "Marque"], ["modele", "Modèle"], ["actif", "Actif", true]
  ],
  effectif: [
    ["matricule", "Matricule"], ["nom", "Nom"], ["prenom", "Prénom"], ["service", "Service"],
    ["fonction", "Fonction"], ["telephone", "Téléphone"], ["email", "Email"], ["actif", "Actif", true]
  ],
  saisie: [
    ["wo", "WO"], ["date_panne", "Date panne", "date"], ["unite", "Unité"], ["machine", "Machine"],
    ["probleme", "Problème"], ["service", "Service"], ["statut", "Statut"], ["technicien", "Technicien"]
  ],
  liste: [
    ["wo", "WO"], ["date_panne", "Date panne", "date"], ["unite", "Unité"], ["machine", "Machine"],
    ["probleme", "Problème"], ["statut", "Statut"], ["commentaire", "Commentaire"], ["pieces_consommees", "Pièces consommées"]
  ],
  pm: [
    ["machine_tag", "Machine"], ["machine_designation", "Désignation"], ["unite", "Unité"],
    ["frequence", "Fréquence"], ["date_prevue", "Date prévue", "date"], ["responsable", "Responsable"], ["statut", "Statut"]
  ],
  operating: [
    ["machine", "Machine"], ["date_jour", "Date", "date"], ["heures_planifiees", "Heures planifiées", "number"],
    ["heures_marche", "Heures marche", "number"], ["heures_arret", "Heures arrêt", "number"], ["commentaire", "Commentaire"]
  ],
  sop: [
    ["code", "Code"], ["titre", "Titre"], ["version", "Version"], ["machine", "Machine"],
    ["unite", "Unité"], ["date_application", "Date application", "date"], ["validateur", "Validateur"]
  ],
  parametres: [
    ["type_liste", "Type"], ["valeur", "Valeur"], ["parent", "Parent"], ["ordre", "Ordre", "number"], ["actif", "Actif", true]
  ]
};

const tables = {
  machines: "machines", effectif: "techniciens", saisie: "pannes", liste: "pannes",
  pm: "pm_programmees", operating: "operating_time", sop: "sop", parametres: "ref_listes"
};

async function api(path, options = {}) {
  const token = localStorage.getItem("engineering_token");
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem("engineering_token");
    localStorage.removeItem("engineering_user");
    window.location.reload();
  }
  if (!response.ok) throw new Error(body.error || "Erreur serveur");
  return body;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [usernames, setUsernames] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    api("/api/auth/usernames").then(setUsernames).catch(() => setUsernames([]));
  }, []);

  const suggestions = usernames.filter(value =>
    value.toLowerCase().includes(username.trim().toLowerCase())
  ).slice(0, 5);

  const submit = async event => {
    event.preventDefault();
    setError("");
    try {
      const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      localStorage.setItem("engineering_token", result.token);
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    }
  };
  return <main className="loginPage">
    <form className="loginCard" onSubmit={submit}>
      <div className="loginMark"><Wrench /></div>
      <h1>Engineering</h1>
      <p>Gestion de maintenance industrielle</p>
      <label>Nom d'utilisateur</label>
      <div className="usernameField">
        <input
          value={username}
          onChange={e => { setUsername(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
          autoComplete="username"
          autoFocus
        />
        {showSuggestions && username && suggestions.length > 0 && <div className="usernameSuggestions">
          {suggestions.map(value => <button
            type="button"
            key={value}
            onMouseDown={() => { setUsername(value); setShowSuggestions(false); }}
          >{value}</button>)}
        </div>}
      </div>
      <label>Mot de passe</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div className="formError">{error}</div>}
      <button className="primary" type="submit">Se connecter</button>
    </form>
  </main>;
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [cloud, setCloud] = useState(null);
  useEffect(() => {
    api("/api/dashboard").then(setData).catch(() => setData(null));
    api("/api/supabase/status").then(setCloud).catch(() => setCloud({ linked: false }));
  }, []);
  const cards = data ? [
    ["Machines actives", data.machines, Wrench],
    ["Techniciens actifs", data.techniciens, Users],
    ["Pannes ouvertes", data.pannesOuvertes, Siren],
    ["Pannes fermées ce mois", data.pannesFermees, Activity],
    ["PM à réaliser", data.pmProgrammee, CalendarClock],
    ["PM réalisées ce mois", data.pmRealisees, Gauge]
  ] : [];
  return <div>
    <div className="hero">
      <div><span className="eyebrow">PILOTAGE DU SITE</span><h2>Vue d'ensemble</h2><p>Situation maintenance en temps réel.</p></div>
      <div className={cloud?.linked ? "live" : "live offline"}>
        <span /> {cloud?.linked ? "Supabase connecté" : "Supabase indisponible"}
      </div>
    </div>
    <div className="statGrid">
      {cards.map(([label, value, Icon]) => <article className="statCard" key={label}>
        <div className="iconBox"><Icon /></div><div><strong>{value}</strong><span>{label}</span></div>
      </article>)}
    </div>
    {!data && <div className="empty">Chargement du tableau de bord…</div>}
  </div>;
}

function Stats() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api("/api/modules/liste").then(setRows).catch(() => setRows([])); }, []);
  const open = rows.filter(r => r.statut === "Open").length;
  const close = rows.filter(r => r.statut === "Close").length;
  return <div>
    <PageTitle title="Statistiques" subtitle="Indicateurs de maintenance" />
    <div className="statGrid">
      <article className="statCard"><div className="iconBox"><ClipboardList /></div><div><strong>{rows.length}</strong><span>Total pannes</span></div></article>
      <article className="statCard"><div className="iconBox"><Siren /></div><div><strong>{open}</strong><span>Ouvertes</span></div></article>
      <article className="statCard"><div className="iconBox"><Activity /></div><div><strong>{close}</strong><span>Fermées</span></div></article>
    </div>
  </div>;
}

function PageTitle({ title, subtitle }) {
  return <header className="pageTitle"><div><span className="eyebrow">ENGINEERING</span><h2>{title}</h2><p>{subtitle}</p></div></header>;
}

function DataPage({ module, user }) {
  const defs = fieldsByModule[module];
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const load = () => api(`/api/modules/${module}`).then(setRows);
  useEffect(() => { load().catch(() => setRows([])); }, [module]);
  const filtered = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  const save = async values => {
    const table = tables[module];
    await api(editing?.id ? `/api/tables/${table}/${editing.id}` : `/api/tables/${table}`, {
      method: editing?.id ? "PUT" : "POST", body: JSON.stringify(values)
    });
    setEditing(null);
    load();
  };
  const remove = async id => {
    if (!window.confirm("Supprimer cet élément ?")) return;
    await api(`/api/tables/${tables[module]}/${id}`, { method: "DELETE" });
    load();
  };
  const title = modules.find(item => item[0] === module)?.[1] || module;
  return <div>
    <PageTitle title={title} subtitle={`${rows.length} enregistrement(s)`} />
    <section className="toolbar">
      <div className="search"><Search /><input placeholder="Rechercher..." value={query} onChange={e => setQuery(e.target.value)} /></div>
      {module !== "liste" && <button className="primary" onClick={() => setEditing({})}><Plus /> Ajouter</button>}
    </section>
    <div className="tableWrap">
      <table><thead><tr>{defs.map(([key, label]) => <th key={key}>{label}</th>)}<th /></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}>
          {defs.map(([key]) => <td key={key}>{key === "actif" ? (row[key] ? "Oui" : "Non") : row[key] ?? "—"}</td>)}
          <td className="actions"><button onClick={() => setEditing(row)}>Modifier</button>{module !== "liste" && <button className="dangerText" onClick={() => remove(row.id)}>Supprimer</button>}</td>
        </tr>)}</tbody>
      </table>
      {!filtered.length && <div className="empty">Aucun résultat</div>}
    </div>
    {editing && <Editor fields={defs} values={editing} onClose={() => setEditing(null)} onSave={save} />}
  </div>;
}

function FailureEntry({ user }) {
  const empty = { wo: "", statut: "Open", service: "", technicien: "", unite: "", machine: "", area: "", probleme: "", commentaire: "", date_panne: "", date_debut: "", date_fin: "", downtime: "" };
  const [context, setContext] = useState({ units: [], machines: [], services: [], zones: [], technicians: [], technician: "", service: "" });
  const [pieceContext, setPieceContext] = useState({ catalog: [], machineParts: [], history: [] });
  const [pieces, setPieces] = useState([]);
  const [pieceDraft, setPieceDraft] = useState({ selected: "", nom_piece: "", reference_piece: "", quantite: 1 });
  const [pieceFormOpen, setPieceFormOpen] = useState(false);
  const [newPiece, setNewPiece] = useState({ reference: "", nom: "", description: "" });
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api("/api/saisie/context").then(data => {
      setContext(data);
      setDraft(current => ({ ...current, unite: data.units[0] || "", technicien: data.technician, service: data.service }));
    }).catch(() => setError("Impossible de charger les unités autorisées"));
  }, []);
  useEffect(() => {
    api(`/api/pieces/context${draft.machine ? `?machine=${encodeURIComponent(draft.machine)}` : ""}`)
      .then(setPieceContext).catch(() => setPieceContext({ catalog: [], machineParts: [], history: [] }));
  }, [draft.machine]);
  const machines = context.machines.filter(row => !draft.unite || row.unite === draft.unite);
  const calculatedDowntime = () => {
    if (!draft.date_debut || !draft.date_fin) return "";
    const start = new Date(draft.date_debut);
    const end = new Date(draft.date_fin);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "";
    return Math.round((end - start) / 60000);
  };
  const downtime = calculatedDowntime();
  const selectPiece = id => {
    const selected = pieceContext.catalog.find(piece => String(piece.id) === String(id));
    setPieceDraft({ ...pieceDraft, selected: id, nom_piece: selected?.nom || "", reference_piece: selected?.reference || "" });
  };
  const addPiece = () => {
    if (!pieceDraft.nom_piece.trim()) return;
    setPieces(current => [...current, {
      nom_piece: pieceDraft.nom_piece.trim(),
      reference_piece: pieceDraft.reference_piece.trim(),
      quantite: Math.max(1, Number(pieceDraft.quantite || 1))
    }]);
    setPieceDraft({ selected: "", nom_piece: "", reference_piece: "", quantite: 1 });
  };
  const createPiece = async event => {
    event.preventDefault();
    if (!newPiece.nom.trim()) return;
    const piece = await api("/api/pieces", { method: "POST", body: JSON.stringify(newPiece) });
    await api(`/api/pieces/context${draft.machine ? `?machine=${encodeURIComponent(draft.machine)}` : ""}`).then(setPieceContext);
    setPieceDraft({ selected: String(piece.id), nom_piece: piece.nom, reference_piece: piece.reference || "", quantite: 1 });
    setPieceFormOpen(false);
    setNewPiece({ reference: "", nom: "", description: "" });
  };
  const selectTechnician = name => {
    const selected = context.technicians.find(item => item.name === name);
    setDraft(current => ({ ...current, technicien: name, service: selected?.service || current.service }));
  };
  const submit = async event => {
    event.preventEvent?.();
    event.preventDefault();
    setError(""); setSaved(false);
    try {
      const splitDateTime = value => {
        if (!value) return { date: "", time: "" };
        const [date, timeWithSeconds = ""] = String(value).replace("T", " ").split(" ");
        return { date, time: timeWithSeconds.slice(0, 5) };
      };
      const formatDesktopDateTime = value => {
        if (!value) return "";
        const { date, time } = splitDateTime(value);
        return date && time ? `${date} ${time}` : date;
      };
      const panneDateTime = splitDateTime(draft.date_panne);
      await api("/api/pannes", {
        method: "POST",
        body: JSON.stringify({
          ...draft,
          date_panne: panneDateTime.date,
          heure_panne: panneDateTime.time,
          date_debut: formatDesktopDateTime(draft.date_debut),
          date_fin: formatDesktopDateTime(draft.date_fin),
          wo: draft.wo.trim(),
          service: user.role === "admin" ? draft.service : context.service,
          technicien: user.role === "admin" ? draft.technicien : context.technician,
          downtime: downtime !== "" ? Number(downtime) : Number(draft.downtime || 0),
          pieces
        })
      });
      setSaved(true);
      setDraft({ ...empty, unite: context.units[0] || "", technicien: context.technician, service: context.service });
    } catch (err) { setError(err.message); }
  };
  return <div>
    <PageTitle title="Saisie panne" subtitle="Déclaration d'une intervention" />
    {saved && <div className="success">Panne enregistrée avec succès.</div>}
    {error && <div className="formError">{error}</div>}
    <form className="failureForm" onSubmit={submit}>
      <section>
        <h3>Identification</h3>
        <div className="formGrid">
          <label>N° WO<input required value={draft.wo || ""} onChange={e => setDraft({ ...draft, wo: e.target.value })} /></label>
          <label>Date et heure de la panne<input type="datetime-local" required value={draft.date_panne || ""} onChange={e => setDraft({ ...draft, date_panne: e.target.value })} /></label>
          <label>Unité<select required value={draft.unite} onChange={e => setDraft({ ...draft, unite: e.target.value, machine: "" })}><option value="">Sélectionner...</option>{context.units.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
          <label>Machine<select required value={draft.machine} onChange={e => setDraft({ ...draft, machine: e.target.value })}><option value="">Sélectionner...</option>{machines.map(machine => <option key={machine.tag} value={machine.tag}>{machine.tag} — {machine.designation || ""}</option>)}</select></label>
          <label>Zone<select required value={draft.area} onChange={e => setDraft({ ...draft, area: e.target.value })}><option value="">Sélectionner...</option>{context.zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label>
        </div>
      </section>
      <section><h3>Description</h3>
        <label className="fullField">Problème<textarea required value={draft.probleme} onChange={e => setDraft({ ...draft, probleme: e.target.value })} /></label>
        <label className="fullField">Commentaire<textarea required value={draft.commentaire} onChange={e => setDraft({ ...draft, commentaire: e.target.value })} /></label>
      </section>
      <section>
        <h3>Intervention</h3>
        <div className="formGrid">
          <label>Service<select required value={user.role === "admin" ? draft.service : context.service} disabled={user.role !== "admin"} onChange={e => setDraft({ ...draft, service: e.target.value })}><option value="">Sélectionner...</option>{context.services.map(service => <option key={service} value={service}>{service}</option>)}</select></label>
          <label>Technicien{user.role === "admin"
            ? <select required value={draft.technicien} onChange={e => selectTechnician(e.target.value)}><option value="">Sélectionner...</option>{context.technicians.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
            : <input value={context.technician} disabled />}</label>
          <label>Début<input required type="datetime-local" value={draft.date_debut || ""} onChange={e => setDraft({ ...draft, date_debut: e.target.value })} /></label>
          <label>Fin<input required type="datetime-local" value={draft.date_fin || ""} onChange={e => setDraft({ ...draft, date_fin: e.target.value })} /></label>
          <label>Downtime (minutes)<input type="number" min="0" readOnly value={draft.downtime || downtime} placeholder="Calcul automatique" /></label>
          <label>Statut<select value={draft.statut} onChange={e => setDraft({ ...draft, statut: e.target.value })}><option value="Open">Open</option><option value="Close">Close</option></select></label>
        </div>
      </section>
      <section>
        <h3>Pièces de rechange</h3>
        <button className="secondary" type="button" onClick={() => setPieceFormOpen(true)}><Plus /> Ajouter une pièce de rechange</button>
        <div className="piecePicker">
          <label>Pièce référencielle<select value={pieceDraft.selected} onChange={e => selectPiece(e.target.value)}><option value="">Saisir ou choisir une pièce...</option>{pieceContext.catalog.map(piece => <option key={piece.id} value={piece.id}>{piece.reference ? `${piece.reference} — ` : ""}{piece.nom}</option>)}</select></label>
          <label>Nom<input value={pieceDraft.nom_piece} onChange={e => setPieceDraft({ ...pieceDraft, nom_piece: e.target.value })} /></label>
          <label>Référence<input value={pieceDraft.reference_piece} onChange={e => setPieceDraft({ ...pieceDraft, reference_piece: e.target.value })} /></label>
          <label>Quantité<input type="number" min="1" value={pieceDraft.quantite} onChange={e => setPieceDraft({ ...pieceDraft, quantite: e.target.value })} /></label>
          <button className="secondary" type="button" onClick={addPiece}><Plus /> Ajouter</button>
        </div>
        {pieceContext.machineParts.length > 0 && <p className="hint">Pièces déjà associées à cette machine : {pieceContext.machineParts.map(piece => `${piece.reference ? `${piece.reference} — ` : ""}${piece.nom}`).join(", ")}</p>}
        <div className="usedParts">{pieces.map((piece, index) => <div key={`${piece.reference_piece}-${index}`}><strong>{piece.nom_piece}</strong><span>{piece.reference_piece || "Sans référence"} · Qté {piece.quantite}</span><button type="button" className="dangerText" onClick={() => setPieces(current => current.filter((_, itemIndex) => itemIndex !== index))}>Retirer</button></div>)}</div>
      </section>
      <section>
        <h3>Historique des pièces utilisées</h3>
        <div className="tableWrap"><table><thead><tr><th>Date</th><th>WO</th><th>Machine</th><th>Pièce</th><th>Référence</th><th>Quantité</th></tr></thead><tbody>
          {pieceContext.history.slice(0, 50).map(piece => <tr key={piece.id}><td>{piece.date_utilisation || "—"}</td><td>{piece.panne_wo || piece.wo || "—"}</td><td>{piece.machine}</td><td>{piece.nom_piece}</td><td>{piece.reference_piece || "—"}</td><td>{piece.quantite}</td></tr>)}
        </tbody></table></div>
        {!pieceContext.history.length && <div className="empty">Aucun historique de pièce</div>}
      </section>
      <div className="modalActions"><button className="primary" type="submit"><Save /> Enregistrer la panne</button></div>
    </form>
    {pieceFormOpen && <div className="modalBack"><form className="modal" onSubmit={createPiece}>
      <div className="modalHead"><h3>Nouvelle pièce de rechange</h3><button className="iconButton" type="button" onClick={() => setPieceFormOpen(false)}><X /></button></div>
      <div className="formGrid">
        <label>Nom<input required value={newPiece.nom} onChange={e => setNewPiece({ ...newPiece, nom: e.target.value })} /></label>
        <label>Référence<input value={newPiece.reference} onChange={e => setNewPiece({ ...newPiece, reference: e.target.value })} /></label>
        <label>Description<input value={newPiece.description} onChange={e => setNewPiece({ ...newPiece, description: e.target.value })} /></label>
      </div>
      <div className="modalActions"><button type="button" onClick={() => setPieceFormOpen(false)}>Annuler</button><button className="primary" type="submit"><Save /> Ajouter la pièce</button></div>
    </form></div>}
  </div>;
}

function Editor({ fields, values, onClose, onSave }) {
  const [draft, setDraft] = useState(values);
  const submit = event => { event.preventDefault(); onSave(draft); };
  return <div className="modalBack">
    <form className="modal" onSubmit={submit}>
      <div className="modalHead"><h3>{values.id ? "Modifier" : "Nouvel élément"}</h3><button type="button" className="iconButton" onClick={onClose}><X /></button></div>
      <div className="formGrid">{fields.map(([key, label, kind]) => <label key={key}>{label}
        {kind === true ? <select value={draft[key] ?? 1} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })}><option value={1}>Oui</option><option value={0}>Non</option></select>
          : kind === "date" ? <input type="date" value={draft[key] || ""} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
          : kind === "number" ? <input type="number" step="0.1" value={draft[key] ?? ""} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })} />
          : <input value={draft[key] ?? ""} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />}
      </label>)}</div>
      <div className="modalActions"><button type="button" onClick={onClose}>Annuler</button><button className="primary" type="submit"><Save /> Enregistrer</button></div>
    </form>
  </div>;
}

function AccessSettings({ user }) {
  const [users, setUsers] = useState([]);
  const load = () => api("/api/modules/effectif").then(setUsers);
  useEffect(() => { load().catch(() => setUsers([])); }, []);
  const changeRole = async (id, role) => { await api(`/api/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }); load(); };
  const changePassword = async id => {
    const password = window.prompt("Nouveau mot de passe (4 caractères minimum)");
    if (!password) return;
    await api(`/api/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) });
    alert("Mot de passe mis à jour.");
  };
  return <div>
    <PageTitle title="Paramètres & accès" subtitle="Gestion des rôles et comptes" />
    <div className="tableWrap"><table><thead><tr><th>Nom</th><th>Utilisateur</th><th>Fonction</th><th>Rôle</th><th /></tr></thead><tbody>
      {users.map(row => {
        const role = row.is_admin ? "admin" : /superviseur|supervisor/i.test(row.fonction || "") ? "superviseur" : "technicien";
        return <tr key={row.id}><td>{row.nom} {row.prenom || ""}</td><td>{row.username}</td><td>{row.fonction}</td>
          <td><select value={role} disabled={row.id === user.id} onChange={e => changeRole(row.id, e.target.value)}>
            <option value="technicien">Technicien</option><option value="superviseur">Superviseur</option><option value="admin">Administrateur</option>
          </select></td><td><button onClick={() => changePassword(row.id)}>Mot de passe</button></td></tr>;
      })}
    </tbody></table></div>
  </div>;
}

function Effectif({ user }) {
  const [rows, setRows] = useState([]);
  const [context, setContext] = useState({ units: [], services: [], functions: [] });
  const [form, setForm] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const load = () => api("/api/modules/effectif").then(setRows);
  useEffect(() => {
    load().catch(() => setRows([]));
    api("/api/effectif/context").then(setContext).catch(() => setContext({ units: [], services: [], functions: [] }));
  }, []);
  const openNew = () => setForm({
    matricule: "", nom: "", prenom: "", service: "", fonction: "",
    telephone: "", email: "", date_recrutement: "", date_depart: "",
    actif: true, is_admin: false,
    toutes_unites: false, units: []
  });
  const openEdit = row => setForm({
    ...row, actif: Boolean(row.actif), is_admin: Boolean(row.is_admin),
    toutes_unites: Boolean(row.toutes_unites), units: row.units || [],
  });
  const save = async event => {
    event.preventDefault();
    setError("");
    if (!form.matricule || !form.nom || !form.service || !form.fonction) {
      setError("Matricule, nom, service et fonction sont obligatoires.");
      return;
    }
    try {
      await api(form.id ? `/api/effectif/${form.id}` : "/api/effectif", {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify(form)
      });
      setForm(null);
      load();
    } catch (err) { setError(err.message); }
  };
  const toggleUnit = unite => setForm(current => ({
    ...current,
    units: current.units.includes(unite) ? current.units.filter(value => value !== unite) : [...current.units, unite]
  }));
  const filtered = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return <div>
    <PageTitle title="Effectif" subtitle={`${rows.length} technicien(s)`} />
    <section className="toolbar">
      <div className="search"><Search /><input placeholder="Rechercher..." value={query} onChange={e => setQuery(e.target.value)} /></div>
      {user.role === "admin" && <button className="primary" onClick={openNew}><Plus /> Ajouter</button>}
    </section>
    <div className="tableWrap"><table><thead><tr><th>Matricule</th><th>Nom</th><th>Service</th><th>Fonction</th><th>Actif</th><th /></tr></thead>
      <tbody>{filtered.map(row => <tr key={row.id}><td>{row.matricule}</td><td>{row.nom} {row.prenom || ""}</td><td>{row.service}</td><td>{row.fonction}</td><td>{row.actif ? "Oui" : "Non"}</td>
        <td className="actions">{user.role === "admin" && <button onClick={() => openEdit(row)}>Modifier</button>}</td></tr>)}</tbody>
    </table></div>
    {form && <div className="modalBack"><form className="modal" onSubmit={save}>
      <div className="modalHead"><h3>{form.id ? "Modifier l'effectif" : "Ajouter un technicien"}</h3><button type="button" className="iconButton" onClick={() => setForm(null)}><X /></button></div>
      <div className="formGrid">
        <label>Matricule *<input required value={form.matricule} onChange={e => setForm({ ...form, matricule: e.target.value })} /></label>
        <label>Nom *<input required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} /></label>
        <label>Prénom<input value={form.prenom || ""} onChange={e => setForm({ ...form, prenom: e.target.value })} /></label>
        <label>Service *<select required value={form.service || ""} onChange={e => setForm({ ...form, service: e.target.value })}><option value="">Sélectionner</option>{context.services.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Fonction *<select required value={form.fonction || ""} onChange={e => setForm({ ...form, fonction: e.target.value })}><option value="">Sélectionner</option>{context.functions.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Téléphone<input value={form.telephone || ""} onChange={e => setForm({ ...form, telephone: e.target.value })} /></label>
        <label>Email<input type="email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label>Date de recrutement<input type="date" value={form.date_recrutement || ""} onChange={e => setForm({ ...form, date_recrutement: e.target.value })} /></label>
        <label>Date de départ<input type="date" value={form.date_depart || ""} onChange={e => setForm({ ...form, date_depart: e.target.value })} /></label>
      </div>
      <fieldset className="unitPicker"><legend>Unités</legend>
        <label><input type="checkbox" checked={Boolean(form.toutes_unites)} onChange={e => setForm({ ...form, toutes_unites: e.target.checked })} /> Toutes les unités</label>
        {!form.toutes_unites && <div className="unitGrid">{context.units.map(unite => <label key={unite}><input type="checkbox" checked={form.units.includes(unite)} onChange={() => toggleUnit(unite)} /> {unite}</label>)}</div>}
      </fieldset>
      <div className="formGrid">
        <label><input type="checkbox" checked={Boolean(form.actif)} onChange={e => setForm({ ...form, actif: e.target.checked })} /> Actif</label>
        <label><input type="checkbox" checked={Boolean(form.is_admin)} onChange={e => setForm({ ...form, is_admin: e.target.checked })} /> Administrateur</label>
      </div>
      {error && <div className="formError">{error}</div>}
      <div className="modalActions"><button type="button" onClick={() => setForm(null)}>Annuler</button><button className="primary" type="submit"><Save /> Enregistrer</button></div>
    </form></div>}
  </div>;
}

function PreventiveMaintenance({ user }) {
  const [rows, setRows] = useState([]);
  const [context, setContext] = useState({ units: [], machines: [], technicians: [], technician: "", frequencies: [] });
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [realization, setRealization] = useState(null);
  const [error, setError] = useState("");
  const [realizationDraft, setRealizationDraft] = useState({ date_debut: "", date_fin: "", commentaire: "", technicien: "" });

  const load = () => api("/api/modules/pm").then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
    api("/api/pm/context").then(data => {
      setContext(data);
      setRealizationDraft(current => ({ ...current, technicien: data.technician }));
    }).catch(() => setContext({ units: [], machines: [], technicians: [], technician: "", frequencies: [] }));
  }, []);

  const filteredMachines = context.machines.filter(machine => !form?.unite || machine.unite === form.unite);
  const filtered = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  const canPlan = user.role === "admin" || user.role === "superviseur";

  const openForm = () => setForm({
    unite: context.units[0] || "",
    machine_tag: "",
    frequence: context.frequencies[0] || "",
    tolerance_jours: 7,
    date_prevue: "",
    responsable: [user.nom, user.prenom].filter(Boolean).join(" ").trim(),
    commentaire: ""
  });

  const save = async event => {
    event.preventEvent?.();
    event.preventDefault();
    setError("");
    try {
      await api("/api/pm", { method: "POST", body: JSON.stringify(form) });
      setForm(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const openRealization = row => {
    setRealization(row);
    setRealizationDraft({ date_debut: "", date_fin: "", commentaire: "", technicien: context.technician });
  };

  const realize = async event => {
    event.preventEvent?.();
    event.preventDefault();
    setError("");
    try {
      await api(`/api/pm/${realization.id}/realiser`, {
        method: "POST",
        body: JSON.stringify(realizationDraft)
      });
      setRealization(null);
      load();
    } catch (err) { setError(err.message); }
  };

  return <div>
    <PageTitle title="Maintenance préventive" subtitle={`${rows.length} PM programmée(s)`} />
    {error && <div className="formError">{error}</div>}
    <section className="toolbar">
      <div className="search"><Search /><input placeholder="Rechercher..." value={query} onChange={e => setQuery(e.target.value)} /></div>
      {canPlan && <button className="primary" onClick={openForm}><Plus /> Ajouter une PM</button>}
    </section>
    <div className="tableWrap">
      <table>
        <thead><tr><th>Date prévue</th><th>Unité</th><th>Machine</th><th>Fréquence</th><th>Responsable</th><th>Statut</th><th /></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}>
          <td>{row.date_prevue}</td><td>{row.unite}</td>
          <td>{row.machine_tag} — {row.machine_designation || ""}</td><td>{row.frequence}</td>
          <td>{row.responsable || "—"}</td><td>{row.statut}</td>
          <td className="actions">{row.statut === "Planifiée" &&
            <button className="primary" onClick={() => openRealization(row)}>Réaliser</button>}</td>
        </tr>)}</tbody>
      </table>
      {!filtered.length && <div className="empty">Aucune maintenance préventive</div>}
    </div>
    {form && <div className="modalBack"><form className="modal" onSubmit={save}>
      <div className="modalHead"><h3>Programmer une PM</h3><button type="button" className="iconButton" onClick={() => setForm(null)}><X /></button></div>
      <div className="formGrid">
        <label>Unité<select required value={form.unite} onChange={e => setForm({ ...form, unite: e.target.value, machine_tag: "" })}><option value="">Sélectionner...</option>{context.units.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
        <label>Machine<select required value={form.machine_tag} onChange={e => {
          const machine = filteredMachines.find(item => item.tag === e.target.value);
          setForm(current => ({ ...current, machine_tag: e.target.value, unite: machine?.unite || current.unite }));
        }}><option value="">Sélectionner...</option>{filteredMachines.map(machine => <option key={machine.tag} value={machine.tag}>{machine.tag} — {machine.designation || ""}</option>)}</select></label>
        <label>Date prévue<input required type="date" value={form.date_prevue} onChange={e => setForm({ ...form, date_prevue: e.target.value })} /></label>
        <label>Fréquence<select required value={form.frequence} onChange={e => setForm({ ...form, frequence: e.target.value })}><option value="">Sélectionner...</option>{context.frequencies.map(frequency => <option key={frequency} value={frequency}>{frequency}</option>)}</select></label>
        <label>Tolérance (jours)<input required type="number" min="0" value={form.tolerance_jours} onChange={e => setForm({ ...form, tolerance_jours: Number(e.target.value) })} /></label>
        <label>Responsable<input required value={form.responsable} disabled /></label>
        <label className="fullField">Commentaire<textarea value={form.commentaire} onChange={e => setForm({ ...form, commentaire: e.target.value })} /></label>
      </div>
      <div className="modalActions"><button type="button" onClick={() => setForm(null)}>Annuler</button><button className="primary" type="submit"><Save /> Enregistrer</button></div>
    </form></div>}
    {realization && <div className="modalBack"><form className="modal" onSubmit={realize}>
      <div className="modalHead"><h3>Réaliser la PM — {realization.machine_tag}</h3><button type="button" className="iconButton" onClick={() => setRealization(null)}><X /></button></div>
      <div className="formGrid">
        <label>Unité<input value={realization.unite} disabled /></label>
        <label>Machine<input value={`${realization.machine_tag} — ${realization.machine_designation || ""}`} disabled /></label>
        <label>Technicien{user.role === "admin"
          ? <select required value={realizationDraft.technicien} onChange={e => setRealizationDraft({ ...realizationDraft, technicien: e.target.value })}><option value="">Sélectionner...</option>{context.technicians.map(technician => <option key={technician.id} value={technician.name}>{technician.name}</option>)}</select>
          : <input value={context.technician} disabled />}</label>
        <label>Date début<input required type="datetime-local" value={realizationDraft.date_debut} onChange={e => setRealizationDraft({ ...realizationDraft, date_debut: e.target.value })} /></label>
        <label>Date fin<input required type="datetime-local" value={realizationDraft.date_fin} onChange={e => setRealizationDraft({ ...realizationDraft, date_fin: e.target.value })} /></label>
        <label className="fullField">Commentaire<textarea value={realizationDraft.commentaire} onChange={e => setRealizationDraft({ ...realizationDraft, commentaire: e.target.value })} /></label>
      </div>
      <div className="modalActions"><button type="button" onClick={() => setRealization(null)}>Annuler</button><button className="primary" type="submit"><Save /> Valider la réalisation</button></div>
    </form></div>}
  </div>;
}

function OperatingTime({ user }) {
  const [rows, setRows] = useState([]);
  const [context, setContext] = useState({ units: [], machines: [], operator: "" });
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ unite: "", machine: "", date_jour: "", hours: 0, minutes: 0, commentaire: "" });
  const [error, setError] = useState("");

  const load = () => api("/api/modules/operating").then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
    api("/api/operating/context").then(data => {
      setContext(data);
      setDraft(current => ({ ...current, unite: data.units[0] || "" }));
    }).catch(() => setContext({ units: [], machines: [], operator: "" }));
  }, []);

  const filtered = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  const unitMachines = context.machines.filter(machine => !draft.unite || machine.unite === draft.unite);
  const save = async event => {
    event.preventEvent?.();
    event.preventDefault();
    setError("");
    try {
      const hours = Number(draft.hours || 0);
      const minutes = Number(draft.minutes || 0);
      await api("/api/operating", {
        method: "POST",
        body: JSON.stringify({
          unite: draft.unite,
          machine: draft.machine,
          date_jour: draft.date_jour,
          heures_marche: hours + minutes / 60,
          commentaire: draft.commentaire,
          saisi_par: context.operator
        })
      });
      setEditing(null);
      setDraft({ unite: context.units[0] || "", machine: "", date_jour: "", hours: 0, minutes: 0, commentaire: "" });
      load();
    } catch (err) { setError(err.message); }
  };

  const openEditor = () => {
    setError("");
    setDraft({ unite: context.units[0] || "", machine: "", date_jour: "", hours: 0, minutes: 0, commentaire: "" });
    setEditing(true);
  };

  return <div>
    <PageTitle title="Operating Time" subtitle={`${rows.length} saisie(s)`} />
    {error && <div className="formError">{error}</div>}
    <section className="toolbar">
      <div className="search"><Search /><input placeholder="Rechercher..." value={query} onChange={e => setQuery(e.target.value)} /></div>
      <button className="primary" onClick={openEditor}><Plus /> Ajouter</button>
    </section>
    <div className="tableWrap">
      <table><thead><tr><th>Date</th><th>Machine</th><th>Marche</th><th>Arrêt</th><th>Commentaire</th><th>Saisi par</th><th /></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}><td>{row.date_jour}</td><td>{row.machine}</td><td>{Number(row.heures_marche || 0).toFixed(2)} h</td><td>{Number(row.heures_arret || 0).toFixed(2)} h</td><td>{row.commentaire || "—"}</td><td>{row.saisi_par || "—"}</td><td /></tr>)}</tbody>
      </table>
      {!filtered.length && <div className="empty">Aucune saisie Operating Time</div>}
    </div>
    {editing && <div className="modalBack"><form className="modal" onSubmit={save}>
      <div className="modalHead"><h3>Ajouter Operating Time</h3><button type="button" className="iconButton" onClick={() => setEditing(null)}><X /></button></div>
      <div className="formGrid">
        <label>Unité<select required value={draft.unite} onChange={e => setDraft({ ...draft, unite: e.target.value, machine: "" })}><option value="">Sélectionner...</option>{context.units.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
        <label>Machine<select required value={draft.machine} onChange={e => setDraft({ ...draft, machine: e.target.value })}><option value="">Sélectionner...</option>{unitMachines.map(machine => <option key={machine.tag} value={machine.tag}>{machine.tag} — {machine.designation || ""}</option>)}</select></label>
        <label>Date<input required type="date" value={draft.date_jour} onChange={e => setDraft({ ...draft, date_jour: e.target.value })} /></label>
        <label>Heures<input required type="number" min="0" max="24" value={draft.hours} onChange={e => setDraft({ ...draft, hours: e.target.value })} /></label>
        <label>Minutes<input required type="number" min="0" max="59" value={draft.minutes} onChange={e => setDraft({ ...draft, minutes: e.target.value })} /></label>
        <label>Nom / Saisi par<input value={context.operator} disabled /></label>
        <label className="fullField">Commentaire<textarea value={draft.commentaire} onChange={e => setDraft({ ...draft, commentaire: e.target.value })} /></label>
      </div>
      <div className="modalActions"><button type="button" onClick={() => setEditing(null)}>Annuler</button><button className="primary" type="submit"><Save /> Enregistrer</button></div>
    </form></div>}
  </div>;
}

function App() {
  const saved = localStorage.getItem("engineering_user");
  const [user, setUser] = useState(saved ? JSON.parse(saved) : null);
  const [module, setModule] = useState("accueil");
  const [menuOpen, setMenuOpen] = useState(false);
  const login = value => { localStorage.setItem("engineering_user", JSON.stringify(value)); setUser(value); };
  const logout = async () => { try { await api("/api/auth/logout", { method: "POST" }); } catch {} localStorage.removeItem("engineering_token"); localStorage.removeItem("engineering_user"); setUser(null); };
  if (!user) return <Login onLogin={login} />;
  const allowed = item => item === "parametres" ? user.role === "admin" : true;
  const content = module === "accueil" ? <Dashboard /> : module === "stats" ? <Stats /> : module === "saisie" ? <FailureEntry user={user} /> : module === "pm" ? <PreventiveMaintenance user={user} /> : module === "operating" ? <OperatingTime user={user} /> : module === "effectif" ? <Effectif user={user} /> :
    module === "parametres" ? <AccessSettings user={user} /> : <DataPage key={module} module={module} user={user} />;
  return <div className="appShell">
    <aside className={menuOpen ? "sidebar open" : "sidebar"}>
      <div className="brand"><div><Wrench /></div><span><strong>Engineering</strong><small>Maintenance web</small></span></div>
      <nav>{modules.filter(([id]) => allowed(id)).map(([id, label, Icon]) => <button key={id} className={module === id ? "active" : ""} onClick={() => { setModule(id); setMenuOpen(false); }}><Icon /><span>{label}</span></button>)}</nav>
      <div className="userBlock"><div className="avatar">{user.nom?.[0]}{user.prenom?.[0]}</div><div><strong>{user.nom} {user.prenom || ""}</strong><small>{user.role}</small></div><button title="Déconnexion" onClick={logout}><LogOut /></button></div>
    </aside>
    {menuOpen && <button className="backdrop" aria-label="Fermer" onClick={() => setMenuOpen(false)} />}
    <main className="main"><button className="mobileMenu" onClick={() => setMenuOpen(true)}><Menu /></button>{content}</main>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);

// Enregistrement du Service Worker PWA
registerSW();
