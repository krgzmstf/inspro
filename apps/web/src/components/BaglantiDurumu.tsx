"use client";

import { useEffect, useState } from "react";
import { senkronAbone, senkronBaslat, kuyruguBosalt, type SenkronDurum } from "@/lib/senkronKuyruk";

/**
 * Çevrimiçi/çevrimdışı + senkron göstergesi.
 * - Çevrimdışı: "Çevrimdışı — değişiklikler cihazda" (sarı)
 * - Bekleyen var + online: "Eşitleniyor…" (mavi)
 * - Hepsi senkron: kısa "Eşitlendi" (yeşil, sonra gizlenir)
 * Ağ dinleyicilerini de başlatır (reconnect → otomatik push).
 */
export default function BaglantiDurumu() {
  const [d, setD] = useState<SenkronDurum>({ cevrimici: true, bekleyen: 0, eslesiyor: false });
  const [gizle, setGizle] = useState(false);

  useEffect(() => {
    const durdur = senkronBaslat();
    const cik = senkronAbone(setD);
    return () => { cik(); durdur(); };
  }, []);

  // Her şey senkronken birkaç saniye sonra gizle
  useEffect(() => {
    if (d.cevrimici && d.bekleyen === 0 && !d.eslesiyor) {
      const t = setTimeout(() => setGizle(true), 2500);
      return () => clearTimeout(t);
    }
    setGizle(false);
  }, [d]);

  if (gizle) return null;

  let renk = "bg-emerald-100 text-emerald-700 border-emerald-200";
  let metin = "Eşitlendi";
  let nokta = "bg-emerald-500";
  if (!d.cevrimici) {
    renk = "bg-amber-100 text-amber-800 border-amber-200";
    metin = d.bekleyen > 0 ? `Çevrimdışı — ${d.bekleyen} değişiklik cihazda` : "Çevrimdışı";
    nokta = "bg-amber-500";
  } else if (d.eslesiyor || d.bekleyen > 0) {
    renk = "bg-sky-100 text-sky-700 border-sky-200";
    metin = "Eşitleniyor…";
    nokta = "bg-sky-500 animate-pulse";
  }

  return (
    <button
      onClick={() => { if (d.cevrimici) void kuyruguBosalt(); }}
      title={d.cevrimici ? "Şimdi eşitle" : "İnternet yok — bağlanınca otomatik eşitlenecek"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${renk}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${nokta}`} />
      {metin}
    </button>
  );
}
