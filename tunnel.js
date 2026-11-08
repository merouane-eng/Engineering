import localtunnel from "localtunnel";

const PORT = 5173;

(async () => {
  try {
    console.log("Initialisation du tunnel HTTPS securise...");
    const tunnel = await localtunnel({ port: PORT });

    console.log("\n========================================================");
    console.log("   APPLICATION ENGINEERING - LIEN MOBILE (ANDROID & iOS)");
    console.log("========================================================");
    console.log(`\nURL PUBLIQUE HTTPS :\n👉  ${tunnel.url}\n`);
    console.log("Copiez cette adresse dans le navigateur de votre smartphone.");
    console.log("Note : La premiere fois, cliquez sur 'Click to Continue'.");
    console.log("========================================================\n");

    tunnel.on("close", () => {
      console.log("Le tunnel a ete ferme.");
    });

    tunnel.on("error", (err) => {
      console.error("Erreur tunnel:", err.message);
    });
  } catch (err) {
    console.error("Impossible de creer le tunnel:", err.message);
    console.log("\nVous pouvez toujours utiliser l'adresse Wi-Fi locale : http://192.168.1.6:5173");
  }
})();
