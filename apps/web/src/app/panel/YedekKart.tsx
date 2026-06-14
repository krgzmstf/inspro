"use client";

import { useRef, useState } from "react";
import { yedekIndir, yedekDogrula, yedekGeriYukle, yedekOzeti } from "@/lib/yedek";

/* insPRO — Veri Yedekleme kartı (dashboard).
   Tüm projeleri/verileri JSON olarak indirir veya geri yükler.
   Veri yalnız tarayıcıda (localStorage) olduğundan düzenli yedek önerilir. */

export default function YedekKart() {
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [mesaj, setMesaj] = useState<{ tip: "ok" | "hata"; metin: string } | null>(null);

  function indir() {
    yedekIndir();
    setMesaj({ tip: "ok", metin: "Yedek indirildi. Güvenli bir yerde saklayın." });
  }

  function dosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) geriYukle(f);
    if (dosyaRef.current) dosyaRef.current.value = "";
  }

  function geriYukle(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (!yedekDogrula(obj)) {
          setMesaj({ tip: "hata", metin: "Bu dosya geçerli bir insPRO yedeği değil." });
          return;
        }
        const ozet = yedekOzeti(obj);
        const onay = window.confirm(
          `Yedeği geri yükle?\n\nTarih: ${new Date(ozet.tarih).toLocaleString("tr-TR")}\n` +
            `Proje: ${ozet.projeler} · Veri anahtarı: ${ozet.anahtar}\n\n` +
            "⚠️ Bu tarayıcıdaki MEVCUT insPRO verisi silinip yedekle değiştirilecek.",
        );
        if (!onay) return;
        const n = yedekGeriYukle(obj, "degistir");
        setMesaj({ tip: "ok", metin: `${n} veri anahtarı geri yüklendi. Sayfa yenileniyor…` });
        setTimeout(() => window.location.reload(), 900);
      } catch {
        setMesaj({ tip: "hata", metin: "Dosya okunamadı (geçersiz JSON)." });
      }
    };
    reader.readAsText(f);
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">💾</span>
        <h2 className="text-sm font-extrabold text-slate-800">Veri Yedekleme</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
          veriler bu tarayıcıda
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Tüm projeleriniz ve verileriniz şu an yalnızca bu tarayıcıda tutuluyor. Cihaz değişimi veya
        tarayıcı temizliğine karşı düzenli <strong>yedek indirin</strong>; başka cihazda{" "}
        <strong>geri yükleyin</strong>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={indir}
          className="inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-ink-800"
        >
          ⬇️ Yedek İndir (JSON)
        </button>
        <input ref={dosyaRef} type="file" accept="application/json,.json" onChange={dosyaSec} className="hidden" />
        <button
          onClick={() => dosyaRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-ink-900 hover:text-ink-900"
        >
          ⬆️ Yedekten Geri Yükle
        </button>
      </div>
      {mesaj && (
        <p className={`mt-2 text-xs font-semibold ${mesaj.tip === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
          {mesaj.tip === "ok" ? "✓ " : "⚠️ "}
          {mesaj.metin}
        </p>
      )}
    </div>
  );
}
