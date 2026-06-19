"use client";

import { useEffect } from "react";
import { nativeMi } from "@/lib/apiTaban";

/** Native (Capacitor) ortamında durum çubuğu rengini ayarlar ve splash'i kapatır.
    Web'de hiçbir şey yapmaz. */
export default function NativeInit() {
  useEffect(() => {
    if (!nativeMi()) return;
    document.documentElement.classList.add("native");
    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: "#15315c" }); // marka koyu lacivert
        await StatusBar.setStyle({ style: Style.Light }); // koyu zeminde açık ikonlar
      } catch { /* eklenti yoksa yok say */ }
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch { /* yok say */ }
    })();
  }, []);
  return null;
}
