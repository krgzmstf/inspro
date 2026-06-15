"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Project, loadProjects, formatTL } from "@/lib/projects";
import {
  type Personel,
  type PuantajDeger,
  loadPersonel,
  bosPersonel,
  savePersonel,
  deletePersonel,
  loadPuantajAy,
  setPuantaj,
  ayinGunleri,
  personelGun,
} from "@/lib/personel";
import { senkronPuantajMuhasebe } from "@/lib/entegrasyon";

type Sekme = "calisanlar" | "puantaj";

const PUANTAJ_DONGU: (PuantajDeger | null)[] = [null, 1, 0.5, 0];
const PUANTAJ_SEM: Record<string, { s: string; c: string }> = {
  "1": { s: "T", c: "bg-emerald-500 text-white" },
  "0.5": { s: "Y", c: "bg-amber-400 text-white" },
  "0": { s: "✕", c: "bg-red-400 text-white" },
};

export default function PersonelPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [sekme, setSekme] = useState<Sekme>("calisanlar");
  const [liste, setListe] = useState<Personel[]>([]);

  // çalışan formu
  const [form, setForm] = useState<Personel | null>(null);

  // puantaj
  const [ay, setAy] = useState(new Date().toISOString().slice(0, 7));
  const [puantaj, setPuantajMap] = useState<Map<string, PuantajDeger>>(new Map());
  const [muhMesaj, setMuhMesaj] = useState("");

  function ayiMuhasebeyeIsle() {
    if (!projectId) return;
    const s = senkronPuantajMuhasebe(projectId, ay);
    const toplam = s.olusturulan + s.guncellenen;
    setMuhMesaj(
      toplam === 0 && s.silinen === 0
        ? "Değişiklik yok (bu ay için kayıtlar güncel)."
        : `✓ Muhasebeye işlendi: ${s.olusturulan} yeni, ${s.guncellenen} güncellendi${s.silinen ? `, ${s.silinen} kaldırıldı` : ""}. Muhasebede "İşçilik" açık gideri olarak görünür.`,
    );
  }

  useEffect(() => {
    const list = loadProjects();
    setProjects(list);
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && list.some((p) => p.id === id) ? id : (list[0]?.id ?? "");
    if (initial) {
      setProjectId(initial);
      setListe(loadPersonel(initial));
    }
  }, []);

  useEffect(() => {
    if (projectId) setPuantajMap(loadPuantajAy(projectId, ay));
  }, [projectId, ay, liste]);

  function switchProject(id: string) {
    setProjectId(id);
    setListe(loadPersonel(id));
    setForm(null);
  }
  function yenile() { setListe(loadPersonel(projectId)); }

  function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.ad.trim()) return;
    savePersonel({ ...form, ad: form.ad.trim(), soyad: form.soyad.trim() });
    setForm(null);
    yenile();
  }
  function sil(id: string) {
    if (!confirm("Çalışan ve puantaj kayıtları silinsin mi?")) return;
    deletePersonel(id);
    yenile();
  }

  const gunler = useMemo(() => ayinGunleri(ay), [ay]);
  function hucreTikla(personelId: string, tarih: string) {
    const mevcut = puantaj.get(`${personelId}_${tarih}`) ?? null;
    const i = PUANTAJ_DONGU.indexOf(mevcut);
    const yeni = PUANTAJ_DONGU[(i + 1) % PUANTAJ_DONGU.length];
    setPuantaj(projectId, personelId, tarih, yeni);
    setPuantajMap(loadPuantajAy(projectId, ay));
  }

  const aktifListe = liste; // tümü
  const puantajToplam = aktifListe.reduce((s, p) => s + personelGun(puantaj, p.id, gunler) * p.yevmiye, 0);

  function haftaSonu(tarih: string) {
    const g = new Date(tarih).getDay();
    return g === 0 || g === 6;
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-extrabold text-slate-900">👷 Personel & Puantaj</h1>
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🏗️</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Önce bir proje gerekli</h3>
          <Link href="/panel/yeni" className="mt-5 inline-block rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">+ Proje Oluştur</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">👷 Personel & Puantaj</h1>
          <p className="mt-1 text-sm text-slate-500">Çalışan listesi (SGK, kişisel bilgiler) ve aylık puantaj.</p>
        </div>
        <select value={projectId} onChange={(e) => switchProject(e.target.value)}
          className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Sekmeler */}
      <div className="mt-5 flex gap-2">
        {([["calisanlar", `👥 Çalışan Listesi (${liste.length})`], ["puantaj", "🗓️ Puantaj"]] as const).map(([s, l]) => (
          <button key={s} onClick={() => setSekme(s)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${sekme === s ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ───── ÇALIŞAN LİSTESİ ───── */}
      {sekme === "calisanlar" && (
        <div className="mt-5">
          {!form && (
            <button onClick={() => setForm(bosPersonel(projectId))}
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">+ Çalışan Ekle</button>
          )}

          {form && (
            <form onSubmit={kaydet} className="rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-md">
              <h2 className="text-base font-bold text-slate-900">{form.ad ? "Çalışanı Düzenle" : "Yeni Çalışan"}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <F label="Ad *"><input value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} className={inp} /></F>
                <F label="Soyad"><input value={form.soyad} onChange={(e) => setForm({ ...form, soyad: e.target.value })} className={inp} /></F>
                <F label="Görev / Meslek"><input value={form.gorev} onChange={(e) => setForm({ ...form, gorev: e.target.value })} placeholder="ör: Demirci, Kalıpçı" className={inp} /></F>
                <F label="T.C. Kimlik No"><input value={form.tc} onChange={(e) => setForm({ ...form, tc: e.target.value })} inputMode="numeric" className={inp} /></F>
                <F label="Telefon"><input value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} inputMode="tel" placeholder="05.." className={inp} /></F>
                <F label="Günlük Yevmiye (₺)"><input type="number" min="0" value={form.yevmiye || ""} onChange={(e) => setForm({ ...form, yevmiye: parseFloat(e.target.value) || 0 })} className={inp} /></F>
                <F label="SGK Giriş Tarihi"><input type="date" value={form.sgkGiris} onChange={(e) => setForm({ ...form, sgkGiris: e.target.value })} className={inp} /></F>
                <F label="SGK Çıkış Tarihi"><input type="date" value={form.sgkCikis} onChange={(e) => setForm({ ...form, sgkCikis: e.target.value })} className={inp} /></F>
                <F label="İşe Giriş Tarihi"><input type="date" value={form.iseGiris} onChange={(e) => setForm({ ...form, iseGiris: e.target.value })} className={inp} /></F>
                <F label="IBAN"><input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="TR.." className={inp} /></F>
                <F label="Adres"><input value={form.adres} onChange={(e) => setForm({ ...form, adres: e.target.value })} className={inp} /></F>
                <F label="Not"><input value={form.not} onChange={(e) => setForm({ ...form, not: e.target.value })} className={inp} /></F>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="h-4 w-4 accent-[var(--color-brand-500)]" />
                Aktif çalışıyor
              </label>
              <div className="mt-4 flex gap-2">
                <button type="submit" className="rounded-xl bg-ink-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">Kaydet</button>
                <button type="button" onClick={() => setForm(null)} className="rounded-xl border-2 border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600">Vazgeç</button>
              </div>
            </form>
          )}

          {liste.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500">
                    <th className="px-3 py-2.5">Ad Soyad</th>
                    <th className="px-3 py-2.5">Görev</th>
                    <th className="px-3 py-2.5">Telefon</th>
                    <th className="px-3 py-2.5 text-right">Yevmiye</th>
                    <th className="px-3 py-2.5">SGK Giriş–Çıkış</th>
                    <th className="px-3 py-2.5">Durum</th>
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {liste.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-semibold text-slate-800">{p.ad} {p.soyad}
                        {p.tc && <div className="text-[10px] font-normal text-slate-400">TC: {p.tc}</div>}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{p.gorev || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{p.telefon || "—"}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900">{p.yevmiye ? formatTL(p.yevmiye) : "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{p.sgkGiris || "—"}{p.sgkCikis ? ` → ${p.sgkCikis}` : ""}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.aktif && !p.sgkCikis ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {p.aktif && !p.sgkCikis ? "Aktif" : "Çıkış"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setForm(p)} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100" title="Düzenle">✎</button>
                        <button onClick={() => sil(p.id)} className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {liste.length === 0 && !form && (
            <p className="mt-4 text-sm text-slate-400">Henüz çalışan yok. &quot;Çalışan Ekle&quot; ile başlayın.</p>
          )}
        </div>
      )}

      {/* ───── PUANTAJ ───── */}
      {sekme === "puantaj" && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-semibold text-slate-600">
              Ay
              <input type="month" value={ay} onChange={(e) => setAy(e.target.value)}
                className="ml-2 rounded-lg border-2 border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
            </label>
            <span className="text-xs text-slate-500">Hücreye tıkla: boş → <b className="text-emerald-600">T</b>am → <b className="text-amber-500">Y</b>arım → <b className="text-red-500">✕</b> gelmedi</span>
          </div>

          {liste.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Önce &quot;Çalışan Listesi&quot;nden çalışan ekleyin.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Çalışan</th>
                    {gunler.map((g) => {
                      const gun = parseInt(g.slice(-2));
                      return <th key={g} className={`w-7 px-0 py-2 text-center font-bold ${haftaSonu(g) ? "bg-slate-200 text-slate-400" : ""}`}>{gun}</th>;
                    })}
                    <th className="px-3 py-2 text-right">Gün</th>
                    <th className="px-3 py-2 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((p) => {
                    const gun = personelGun(puantaj, p.id, gunler);
                    return (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="sticky left-0 z-10 bg-white px-3 py-1 font-semibold text-slate-700 whitespace-nowrap">{p.ad} {p.soyad}</td>
                        {gunler.map((g) => {
                          const v = puantaj.get(`${p.id}_${g}`);
                          const sem = v !== undefined ? PUANTAJ_SEM[String(v)] : null;
                          return (
                            <td key={g} className={`px-0 py-0.5 text-center ${haftaSonu(g) ? "bg-slate-100" : ""}`}>
                              <button onClick={() => hucreTikla(p.id, g)}
                                className={`mx-auto flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold transition ${sem ? sem.c : "text-slate-300 hover:bg-slate-100"}`}>
                                {sem ? sem.s : "·"}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-1 text-right font-bold text-slate-900">{gun}</td>
                        <td className="px-3 py-1 text-right font-bold text-emerald-700">{formatTL(gun * p.yevmiye)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-right font-extrabold uppercase text-slate-500" colSpan={gunler.length + 2}>Toplam İşçilik (puantaj)</td>
                    <td className="px-3 py-2 text-right font-extrabold text-ink-900">{formatTL(puantajToplam)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {liste.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={ayiMuhasebeyeIsle}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">
                📒 Bu ayı muhasebeye işle (işçilik)
              </button>
              {muhMesaj && <span className="text-xs font-semibold text-slate-600">{muhMesaj}</span>}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">💡 Tam gün = 1, yarım = 0,5. Tutar = toplam gün × yevmiye. Kişi başı bir &quot;İşçilik&quot; açık gideri oluşturur (cari = çalışan); ödeme yapınca muhasebede &quot;ödendi&quot; yapın.</p>
        </div>
      )}

      <div className="mt-8 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><div className="mt-1">{children}</div></label>;
}
