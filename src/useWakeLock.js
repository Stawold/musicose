import { useEffect } from "react";

// Empêche la mise en veille de l'écran tant que `active` est vrai (Screen Wake Lock API).
// Le navigateur libère le verrou quand l'onglet passe en arrière-plan : on le redemande
// au retour, et à la première interaction si la première demande a été refusée.
// Nécessite HTTPS (ou localhost) ; sans support, le hook ne fait rien.
export default function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.wakeLock) return;

    let sentinel = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      try {
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) { s.release().catch(() => {}); return; }
        sentinel = s;
        s.addEventListener("release", () => { if (sentinel === s) sentinel = null; });
      } catch (e) {
        // refusé (économie d'énergie, onglet caché…) : on réessaiera plus tard
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", acquire);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", acquire);
      if (sentinel) sentinel.release().catch(() => {});
    };
  }, [active]);
}
