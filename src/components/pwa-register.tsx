"use client";

import { useEffect } from "react";

/** Registra o service worker (necessário para "instalar" a PWA). Silencioso em caso de erro. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
