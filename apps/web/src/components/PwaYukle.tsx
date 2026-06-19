"use client";

import { useEffect, useState } from "react";

/** beforeinstallprompt olayı (Chrome/Android). */
interface YuklemeOlayi extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Uygulamayı yükle" bandı.
 * - Android/Chrome: tek tık kurulum (beforeinstallprompt).
 * - iPhone/Safari: "Paylaş → Ana Ekrana Ekle" yönergesi.
 * Kapatılınca bir daha gösterilmez (localStorage).
 */
export default function PwaYukle() {
  const [olay, setOlay] = useState<YuklemeOlayi | null>(null);
  const [iosGoster, setIosGoster] = useState(false);
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as Navigator & { standalone?: boolean };
    const kurulu = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (kurulu) return;
    if (localStorage.getItem("pwa-yukle-kapali") === "1") return;

    const handler = (e: Event) => { e.preventDefault(); setOlay(e as YuklemeOlayi); setAcik(true); };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari'de beforeinstallprompt yok → yönerge göster
    const ios = /iphone|ipad|ipod/i.test(nav.userAgent);
    const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(nav.userAgent);
    if (ios && safari) { setIosGoster(true); setAcik(true); }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!acik) return null;

  function kapat() { setAcik(false); localStorage.setItem("pwa-yukle-kapali", "1"); }
  async function yukle() {
    if (!olay) return;
    await olay.prompt();
    await olay.userChoice;
    setOlay(null); setAcik(false);
  }

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[60] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl sm:bottom-3 sm:right-auto sm:w-80">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="insPRO" className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink-900">insPRO&apos;yu telefonuna kur</div>
          {iosGoster ? (
            <p className="mt-0.5 text-xs text-slate-500">Safari&apos;de <b>Paylaş</b> ⬆️ → <b>Ana Ekrana Ekle</b>&apos;ye dokun.</p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">Uygulama gibi tam ekran ve hızlı erişim.</p>
          )}
        </div>
        <button onClick={kapat} aria-label="Kapat" className="text-slate-400 hover:text-ink-900">✕</button>
      </div>
      {!iosGoster && (
        <button onClick={yukle} className="mt-2 w-full rounded-xl bg-brand-500 py-2 text-sm font-bold text-white transition hover:bg-brand-600">
          📲 Yükle
        </button>
      )}
    </div>
  );
}
