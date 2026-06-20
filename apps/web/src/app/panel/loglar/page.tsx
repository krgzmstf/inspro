"use client";

import { useEffect, useState, useCallback } from "react";
import { loglariGetir, type IslemLog, type LogOzet } from "@/lib/yonetimApi";
import { yetkiGetir } from "@/lib/rol";

const EYLEM_UI: Record<string, { etiket: string; sinif: string }> = {
  olustur: { etiket: "Oluşturma", sinif: "bg-emerald-100 text-emerald-700" },
  guncelle: { etiket: "Güncelleme", sinif: "bg-sky-100 text-sky-700" },
  sil: { etiket: "Silme", sinif: "bg-red-100 text-red-700" },
  "ice-aktar": { etiket: "İçe aktarma", sinif: "bg-violet-100 text-violet-700" },
  odeme: { etiket: "Ödeme", sinif: "bg-amber-100 text-amber-700" },
  giris: { etiket: "Giriş", sinif: "bg-slate-100 text-slate-600" },
  cikis: { etiket: "Çıkış", sinif: "bg-slate-100 text-slate-600" },
  indir: { etiket: "İndirme", sinif: "bg-indigo-100 text-indigo-700" },
};
const MODUL_ETIKET: Record<string, string> = {
  proje: "Proje", "is-kalemi": "İş Kalemi", muhasebe: "Muhasebe",
  personel: "Personel", poz: "Poz", oturum: "Oturum",
};

function zaman(s: string): string {
  try {
    return new Date(s).toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
}

export default function LoglarPage() {
  const [yetkili, setYetkili] = useState<boolean | null>(null);
  const [loglar, setLoglar] = useState<IslemLog[]>([]);
  const [ozet, setOzet] = useState<LogOzet[]>([]);
  const [yuk, setYuk] = useState(true);
  const [hata, setHata] = useState("");

  const [seciliKullanici, setSeciliKullanici] = useState<string | null>(null);
  const [eylem, setEylem] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");

  useEffect(() => { yetkiGetir().then((y) => setYetkili(y.superAdmin)); }, []);

  const yenile = useCallback(async () => {
    setYuk(true); setHata("");
    try {
      const r = await loglariGetir({ kullanici: seciliKullanici ?? undefined, eylem: eylem || undefined, q: q || undefined, limit: 400 });
      setLoglar(r.loglar); setOzet(r.ozet);
    } catch (e) { setHata(e instanceof Error ? e.message : "Yüklenemedi."); }
    finally { setYuk(false); }
  }, [seciliKullanici, eylem, q]);

  useEffect(() => { if (yetkili) yenile(); }, [yetkili, yenile]);

  if (yetkili === null) return <div className="p-6 text-sm text-slate-500">Yükleniyor…</div>;
  if (!yetkili) return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <div className="text-3xl">🔒</div>
      <h1 className="mt-2 text-base font-bold text-red-700">Yalnızca süper admin</h1>
      <p className="mt-1 text-sm text-red-600">Bu panel platform yöneticilerine özeldir.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 sm:text-2xl">🧭 İşlem Kayıtları</h1>
          <p className="mt-0.5 text-xs text-slate-500">Kim ne yaptı — oluşturma, silme, içe aktarma, ödeme, giriş (web + mobil).</p>
        </div>
        <button onClick={yenile} className="rounded-xl bg-ink-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-ink-800">↻ Yenile</button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Kişi aktivite özeti */}
        <aside className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Kişiler ({ozet.length})</h2>
            {seciliKullanici && (
              <button onClick={() => setSeciliKullanici(null)} className="text-[11px] font-bold text-brand-600 hover:underline">tümü</button>
            )}
          </div>
          <div className="mt-2 max-h-[60vh] space-y-1.5 overflow-y-auto">
            {ozet.length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-400">Henüz kayıt yok.</p>}
            {ozet.map((o) => (
              <button key={o.kullanici_id} onClick={() => setSeciliKullanici(seciliKullanici === o.kullanici_id ? null : o.kullanici_id)}
                className={`block w-full rounded-xl border p-2 text-left transition ${
                  seciliKullanici === o.kullanici_id ? "border-brand-500 bg-white shadow-sm" : "border-transparent bg-white/60 hover:bg-white"
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-slate-800">{o.email || "—"}</span>
                  <span className="shrink-0 rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">{o.adet}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(o.eylemler).map(([e, n]) => (
                    <span key={e} className={`rounded px-1 py-0.5 text-[9px] font-bold ${EYLEM_UI[e]?.sinif ?? "bg-slate-100 text-slate-500"}`}>
                      {EYLEM_UI[e]?.etiket ?? e}·{n}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-[9px] text-slate-400">son: {zaman(o.son)}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Log listesi */}
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <select value={eylem} onChange={(e) => setEylem(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-brand-500">
              <option value="">Tüm eylemler</option>
              {Object.entries(EYLEM_UI).map(([k, v]) => <option key={k} value={k}>{v.etiket}</option>)}
            </select>
            <form onSubmit={(e) => { e.preventDefault(); setQ(qInput.trim()); }} className="flex flex-1 gap-1">
              <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Kayıt / e-posta ara…"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500" />
              <button type="submit" className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600">Ara</button>
              {q && <button type="button" onClick={() => { setQ(""); setQInput(""); }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">✕</button>}
            </form>
          </div>

          {hata && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{hata}</p>}

          <div className="mt-3 overflow-x-auto rounded-2xl border border-sky-200 bg-[#f2f8fd]">
            <table className="w-full min-w-0 text-[11px] sm:min-w-[680px] sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[9px] font-bold uppercase text-slate-500 sm:text-[10px]">
                  <th className="px-1.5 py-1.5 sm:px-3 sm:py-2">Zaman</th>
                  <th className="px-1.5 py-1.5 sm:px-3 sm:py-2">Kişi</th>
                  <th className="px-1.5 py-1.5 sm:px-3 sm:py-2">Eylem</th>
                  <th className="px-1.5 py-1.5 sm:px-3 sm:py-2">Modül</th>
                  <th className="px-1.5 py-1.5 sm:px-3 sm:py-2">Kayıt</th>
                  <th className="hidden px-1.5 py-1.5 sm:table-cell sm:px-3 sm:py-2">Cihaz</th>
                </tr>
              </thead>
              <tbody>
                {yuk ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">Yükleniyor…</td></tr>
                ) : loglar.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">Kayıt bulunamadı.</td></tr>
                ) : loglar.map((l) => {
                  const e = EYLEM_UI[l.eylem];
                  return (
                    <tr key={l.id} className="border-b border-slate-100 align-top hover:bg-white/60">
                      <td className="whitespace-nowrap px-1.5 py-1.5 text-[10px] text-slate-500 sm:px-3 sm:py-2 sm:text-xs">{zaman(l.created_at)}</td>
                      <td className="px-1.5 py-1.5 sm:px-3 sm:py-2"><span className="block max-w-[120px] truncate text-[10px] font-semibold text-slate-700 sm:max-w-none sm:text-xs">{l.email || "—"}</span></td>
                      <td className="px-1.5 py-1.5 sm:px-3 sm:py-2">
                        <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:text-[10px] ${e?.sinif ?? "bg-slate-100 text-slate-500"}`}>{e?.etiket ?? l.eylem}</span>
                      </td>
                      <td className="px-1.5 py-1.5 text-[10px] text-slate-600 sm:px-3 sm:py-2 sm:text-xs">{MODUL_ETIKET[l.modul] ?? l.modul}</td>
                      <td className="px-1.5 py-1.5 sm:px-3 sm:py-2"><span className="block max-w-[140px] truncate text-[10px] text-slate-700 sm:max-w-[260px] sm:text-xs">{l.kayit || "—"}</span></td>
                      <td className="hidden px-1.5 py-1.5 text-[10px] text-slate-400 sm:table-cell sm:px-3 sm:py-2 sm:text-xs">{l.platform || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Son {loglar.length} kayıt gösteriliyor. Daha eskisi için kişi/eylem filtresi kullanın.</p>
        </section>
      </div>
    </div>
  );
}
