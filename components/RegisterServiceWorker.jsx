"use client";

import { useEffect } from "react";

// Registra o service worker em toda página — é pré-requisito técnico
// pro navegador considerar o site "instalável" como app (junto com o
// manifest.js). Sem componente visual nenhum.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
