"use client";

import { useEffect } from "react";

/** Service worker'ı sayfa yüklenince sessizce kaydeder (PWA için). */
export default function PwaKayit() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const kayit = () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); };
    if (document.readyState === "complete") kayit();
    else window.addEventListener("load", kayit, { once: true });
  }, []);
  return null;
}
