/* ============================================================
   Enregistrement du Service Worker — Engineering PWA
   ============================================================ */

export function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(registration => {
          console.log(
            "[PWA] Service Worker enregistré :",
            registration.scope
          );

          // Écoute les mises à jour du service worker
          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.addEventListener("statechange", () => {
              if (
                installingWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // Nouvelle version disponible — proposer le rechargement
                if (confirm("Une nouvelle version de l'application est disponible. Recharger maintenant ?")) {
                  registration.waiting.postMessage({ type: "SKIP_WAITING" });
                  window.location.reload();
                }
              }
            });
          });
        })
        .catch(error => {
          console.error("[PWA] Erreur d'enregistrement du Service Worker :", error);
        });
    });
  } else {
    console.warn("[PWA] Service Workers non supportés par ce navigateur.");
  }
}

export function unregisterSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.unregister().then(success => {
        console.log("[PWA] Service Worker désenregistré :", success);
      });
    });
  }
}