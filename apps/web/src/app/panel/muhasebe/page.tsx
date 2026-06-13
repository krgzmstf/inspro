"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type Project,
  loadProjects,
  getProject,
  formatTL,
} from "@/lib/projects";
import {
  type MuhasebeKayit,
  type KayitTipi,
  GIDER_KATEGORILERI,
  GELIR_KATEGORILERI,
  loadMuhasebe,
  addMuhasebe,
  deleteMuhasebe,
  muhasebeOzeti,
} from "@/lib/muhasebe";
import { type Poz, ensurePozlarSeeded } from "@/lib/pozlar";
import { kesifHesapla } from "@/lib/kesifEslesme";

function bugun() {
  return new Date().toISOString().slice(0, 10);
}

export default function MuhasebePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [kayitlar, setKayitlar] = useState<MuhasebeKayit[]>([]);
  const [pozlar, setPozlar] = useState<Poz[]>([]);

  // form
  const [tip, setTip] = useState<KayitTipi>("gider");
  const [kategori, setKategori] = useState<string>(GIDER_KATEGORILERI[0]);
  const [aciklama, setAciklama] = useState("");
  const [taraf, setTaraf] = useState("");
  const [tutar, setTutar] = useState("");
  const [tarih, setTarih] = useState(bugun());
  const [error, setError] = useState("");

  useEffect(() => {
    const list = loadProjects();
    setProjects(list);
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && list.some((p) => p.id === id) ? id : (list[0]?.id ?? "");
    if (initial) {
      setProjectId(initial);
      setKayitlar(loadMuhasebe(initial));
    }
  }, []);

  const projeObj = useMemo(() => (projectId ? getProject(projectId) : undefined), [projectId, kayitlar]);

  useEffect(() => {
    const lib = projeObj?.pozKutuphane === "kut1" ? "kut1" : "kut2";
    ensurePozlarSeeded(lib).then(setPozlar);
  }, [projeObj?.pozKutuphane]);

  // Keşif (planlanan maliyet) — bütçe karşılaştırması için
  const kesif = useMemo(
    () => (projeObj && pozlar.length ? kesifHesapla(projeObj, pozlar) : []),
    [projeObj, pozlar],
  );
  const kesifCsb = kesif.reduce((s, r) => s + r.csbTutar, 0);
  const kesifPiyasa = kesif.reduce((s, r) => s + r.piyasaTutar, 0);

  const ozet = useMemo(() => muhasebeOzeti(kayitlar), [kayitlar]);

  const kategoriler = tip === "gider" ? GIDER_KATEGORILERI : GELIR_KATEGORILERI;

  function switchProject(id: string) {
    setProjectId(id);
    setKayitlar(id ? loadMuhasebe(id) : []);
  }

  function handleTipDegis(t: KayitTipi) {
    setTip(t);
    setKategori((t === "gider" ? GIDER_KATEGORILERI : GELIR_KATEGORILERI)[0]);
  }

  function handleEkle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const t = parseFloat(tutar);
    if (!projectId) return setError("Önce bir proje seçin.");
    if (!t || t <= 0) return setError("Geçerli bir tutar girin.");
    addMuhasebe({ projectId, tip, kategori, aciklama: aciklama.trim(), taraf: taraf.trim(), tutar: t, tarih });
    setKayitlar(loadMuhasebe(projectId));
    setAciklama(""); setTaraf(""); setTutar("");
  }

  function handleSil(id: string) {
    deleteMuhasebe(id);
    setKayitlar(loadMuhasebe(projectId));
  }

  function csvIndir() {
    if (!projeObj) return;
    const head = "Tarih;Tip;Kategori;Açıklama;Taraf;Tutar (TL)";
    const rows = kayitlar.map((k) =>
      [k.tarih, k.tip === "gider" ? "Gider" : "Gelir", k.kategori, k.aciklama, k.taraf,
       k.tutar.toFixed(2).replace(".", ",")].join(";"),
    );
    const csv = "﻿" + [head, ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `muhasebe-${projeObj.name.replaceAll(" ", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-extrabold text-slate-900">📒 Muhasebe</h1>
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🏗️</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Önce bir proje gerekli</h3>
          <Link href="/panel/yeni" className="mt-5 inline-block rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
            + Proje Oluştur
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">📒 Muhasebe</h1>
          <p className="mt-1 text-sm text-slate-500">Proje gelir-gider takibi, bakiye ve bütçe karşılaştırması.</p>
        </div>
        <select value={projectId} onChange={(e) => switchProject(e.target.value)}
          className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Özet kartları */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-emerald-600">Toplam Gelir</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">{formatTL(ozet.toplamGelir)}</div>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-red-600">Toplam Gider</div>
          <div className="mt-1 text-2xl font-extrabold text-red-700">{formatTL(ozet.toplamGider)}</div>
        </div>
        <div className={`rounded-2xl border-2 p-5 shadow-sm ${ozet.bakiye >= 0 ? "border-ink-900 bg-ink-950 text-white" : "border-red-400 bg-red-100"}`}>
          <div className={`text-xs font-semibold uppercase ${ozet.bakiye >= 0 ? "text-white/60" : "text-red-600"}`}>Bakiye (Gelir − Gider)</div>
          <div className={`mt-1 text-2xl font-extrabold ${ozet.bakiye >= 0 ? "text-brand-400" : "text-red-700"}`}>{formatTL(ozet.bakiye)}</div>
        </div>
      </div>

      {/* Bütçe vs gerçekleşen */}
      {(kesifPiyasa > 0 || projeObj?.budget) && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-700">📊 Bütçe vs Gerçekleşen</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {projeObj?.budget != null && (
              <Karsilastir etiket="Planlanan Bütçe" deger={projeObj.budget} gider={ozet.toplamGider} />
            )}
            {kesifCsb > 0 && <Karsilastir etiket="Keşif (ÇŞB)" deger={kesifCsb} gider={ozet.toplamGider} />}
            {kesifPiyasa > 0 && <Karsilastir etiket="Keşif (Piyasa)" deger={kesifPiyasa} gider={ozet.toplamGider} />}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Gerçekleşen gider, keşif tahmininin altındaysa yeşil (kârda), üstündeyse kırmızı (bütçe aşımı).
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Kayıt ekleme */}
        <form onSubmit={handleEkle} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-700">Yeni Kayıt</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => handleTipDegis("gider")}
              className={`rounded-xl border-2 py-2 text-sm font-bold transition ${tip === "gider" ? "border-red-400 bg-red-50 text-red-600" : "border-slate-200 text-slate-500"}`}>
              − Gider
            </button>
            <button type="button" onClick={() => handleTipDegis("gelir")}
              className={`rounded-xl border-2 py-2 text-sm font-bold transition ${tip === "gelir" ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-slate-200 text-slate-500"}`}>
              + Gelir
            </button>
          </div>
          <label className="mt-3 block text-sm font-semibold text-slate-700">
            Kategori
            <select value={kategori} onChange={(e) => setKategori(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
              {kategoriler.map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-700">
            Tutar (₺) *
            <input type="number" min="0" value={tutar} onChange={(e) => setTutar(e.target.value)}
              placeholder="0" className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-700">
            {tip === "gider" ? "Tedarikçi / Usta" : "Müşteri / Taraf"}
            <input value={taraf} onChange={(e) => setTaraf(e.target.value)}
              placeholder="ör: Demir Yapı Ltd." className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-700">
            Açıklama
            <input value={aciklama} onChange={(e) => setAciklama(e.target.value)}
              placeholder="ör: 12 ton nervürlü demir" className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-700">
            Tarih
            <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
          <button type="submit"
            className={`mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white transition ${tip === "gider" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
            {tip === "gider" ? "Gider Ekle" : "Gelir Ekle"}
          </button>
        </form>

        {/* Kayıt listesi */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-700">Hareketler ({kayitlar.length})</h2>
            <button onClick={csvIndir} disabled={kayitlar.length === 0}
              className="rounded-xl bg-ink-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-ink-800 disabled:opacity-40">
              ⬇ CSV
            </button>
          </div>
          {kayitlar.length === 0 ? (
            <div className="mt-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-500">
              Henüz kayıt yok. Soldan gelir/gider ekleyin.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                    <th className="px-3 py-2.5">Tarih</th>
                    <th className="px-3 py-2.5">Kategori / Açıklama</th>
                    <th className="px-3 py-2.5">Taraf</th>
                    <th className="px-3 py-2.5 text-right">Tutar</th>
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.map((k) => (
                    <tr key={k.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-xs text-slate-500">{k.tarih}</td>
                      <td className="px-3 py-2">
                        <span className={`mr-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${k.tip === "gider" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>{k.kategori}</span>
                        <div className="text-xs text-slate-600">{k.aciklama}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{k.taraf}</td>
                      <td className={`px-3 py-2 text-right font-bold ${k.tip === "gider" ? "text-red-600" : "text-emerald-600"}`}>
                        {k.tip === "gider" ? "−" : "+"}{formatTL(k.tutar)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => handleSil(k.id)} className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Kategori dağılımı */}
          {ozet.giderKategorileri.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-extrabold uppercase text-slate-600">Gider Dağılımı</h3>
              <div className="mt-2 space-y-2">
                {ozet.giderKategorileri.map((g) => {
                  const pct = ozet.toplamGider ? Math.round((g.tutar / ozet.toplamGider) * 100) : 0;
                  return (
                    <div key={g.kategori}>
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{g.kategori}</span>
                        <span className="font-bold text-slate-900">{formatTL(g.tutar)} <span className="text-slate-400">%{pct}</span></span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-ink-700 to-red-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}

/* Bütçe vs gerçekleşen kart */
function Karsilastir({ etiket, deger, gider }: { etiket: string; deger: number; gider: number }) {
  const fark = deger - gider;
  const asim = fark < 0;
  const pct = deger > 0 ? Math.min(100, Math.round((gider / deger) * 100)) : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase text-slate-500">{etiket}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-900">{formatTL(deger)}</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${asim ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`mt-1 text-[11px] font-bold ${asim ? "text-red-600" : "text-emerald-600"}`}>
        Gerçekleşen %{pct} · {asim ? "Aşım" : "Kalan"} {formatTL(Math.abs(fark))}
      </div>
    </div>
  );
}
