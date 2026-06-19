/* ──────────────────────────────────────────────────────────
   insPRO — API taban adresi (web vs. native)

   Web'de (Vercel) API route'ları aynı origin'dedir → göreli yol.
   Capacitor (native) uygulamada origin "capacitor://localhost" olur;
   sunucu API'leri orada yoktur → çağrılar CANLI web backend'ine gider.

   Offline iken bu çağrılar başarısız olur; çağıran kod yerel yedeğe
   (mkAiYerel, bilgiTabani vb.) düşer.
   ────────────────────────────────────────────────────────── */

const REMOTE = process.env.NEXT_PUBLIC_REMOTE_BASE || "https://inspro.yazeproje.com";

/** Native ortamda mı çalışıyoruz? (Capacitor enjekte eder)
    En sağlam tespit: Capacitor global'inin getPlatform() / isNativePlatform()
    metodlarını ve son çare olarak protokolü kontrol eder. */
export function nativeMi(): boolean {
  if (typeof window === "undefined") return false;
  const c = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; platform?: string };
  }).Capacitor;
  if (c) {
    if (typeof c.isNativePlatform === "function") return c.isNativePlatform() === true;
    const p = (typeof c.getPlatform === "function" ? c.getPlatform() : c.platform) || "web";
    if (p === "android" || p === "ios") return true;
  }
  // Son çare: Capacitor webview protokolü
  const proto = window.location.protocol;
  return proto === "capacitor:" || proto === "ionic:";
}

/** "/api/..." yolunu doğru tabana bağlar (native → canlı backend). */
export function apiUrl(yol: string): string {
  return nativeMi() ? REMOTE + yol : yol;
}

/** fetch sarmalı: native'de canlı backend'e, web'de göreli çağrı yapar. */
export function apiFetch(yol: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(yol), init);
}
