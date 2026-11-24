// Statuts historiques bilingues : ne jamais interpréter « Clos » comme une panne ouverte.
const normalize = value => String(value??"").trim().normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ");

const CLOSED = new Set(["close","closed","clos","cloture","cloturee","cloturer","termine","terminee","resolved","resolu","resolue"]);
const OPEN = new Set(["open","opened","ouvert","ouverte","en cours","pending","a traiter","in progress"]);

export const isClosedPanne = value => CLOSED.has(normalize(value));
export const isOpenPanne = value => !isClosedPanne(value);
export const panneStatusLabel = (value, language="fr") =>
  isClosedPanne(value) ? (String(language).toLowerCase().startsWith("en") ? "Closed" : "Clôturé")
    : (String(language).toLowerCase().startsWith("en") ? "Open" : "Ouvert");
export const canonicalPanneStatus = value =>
  isClosedPanne(value) ? "Close" : OPEN.has(normalize(value)) ? "Open" : String(value??"").trim();
