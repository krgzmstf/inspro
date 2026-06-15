"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { type Project, loadProjects } from "@/lib/projects";
import {
  type IsKalemi,
  loadIsSurecleri,
  addIsKalemi,
  updateIsKalemi,
  deleteIsKalemi,
  isOzeti,
} from "@/lib/isSurecleri";
import { senkronAsamaIsSurecleri } from "@/lib/entegrasyon";

const GUN_MS = 86400000;
const ETIKET_W = 176; // px — sol iş adı sütunu
const SATIR_H = 30;    // px — Gantt satır yüksekliği
const BAR_H = 20;      // px

export default function IsSurecleriPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [kalemler, setKalemler] = useState<IsKalemi[]>([]);
  const [acikDep, setAcikDep] = useState<string | null>(null); // bağımlılık editörü açık iş id

  const timelineRef = useRef<HTMLDivElement>(null);
  const [tlW, setTlW] = useState(600);

  useEffect(() => {
    const list = loadProjects();
    setProjects(list);
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && list.some((p) => p.id === id) ? id : (list[0]?.id ?? "");
    if (initial) {
      setProjectId(initial);
      senkronAsamaIsSurecleri(initial); // İş Takibi kalemlerini programa yansıt
      setKalemler(loadIsSurecleri(initial));
    }
  }, []);

  // Timeline genişliğini ölç (ok koordinatları için)
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const olc = () => setTlW(el.clientWidth);
    olc();
    const ro = new ResizeObserver(olc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [kalemler]);

  function switchProject(id: string) {
    setProjectId(id);
    if (id) senkronAsamaIsSurecleri(id);
    setKalemler(id ? loadIsSurecleri(id) : []);
    setAcikDep(null);
  }
  function guncelle(id: string, patch: Partial<IsKalemi>) {
    updateIsKalemi(id, patch);
    setKalemler(loadIsSurecleri(projectId));
  }
  function depToggle(id: string, oncekiId: string) {
    const k = kalemler.find((x) => x.id === id);
    if (!k) return;
    const set = new Set(k.oncekiler ?? []);
    if (set.has(oncekiId)) set.delete(oncekiId);
    else set.add(oncekiId);
    guncelle(id, { oncekiler: [...set] });
  }
  function ekle() {
    const bugun = new Date().toISOString().slice(0, 10);
    const bitis = new Date(Date.now() + 13 * GUN_MS).toISOString().slice(0, 10);
    addIsKalemi({ projectId, ad: "Yeni iş kalemi", grup: "Genel", sorumlu: "", baslangic: bugun, bitis, ilerleme: 0, oncekiler: [] });
    setKalemler(loadIsSurecleri(projectId));
  }
  function sil(id: string) {
    deleteIsKalemi(id);
    setKalemler(loadIsSurecleri(projectId));
  }

  const ozet = useMemo(() => isOzeti(kalemler), [kalemler]);

  // Gantt zaman aralığı + konum haritası
  const tarihli = useMemo(() => kalemler.filter((k) => k.baslangic && k.bitis), [kalemler]);
  const { minT, totalDays } = useMemo(() => {
    if (tarihli.length === 0) return { minT: 0, totalDays: 1 };
    let min = Infinity, max = -Infinity;
    for (const k of tarihli) {
      min = Math.min(min, new Date(k.baslangic).getTime());
      max = Math.max(max, new Date(k.bitis).getTime());
    }
    return { minT: min, totalDays: Math.max(1, (max - min) / GUN_MS + 1) };
  }, [tarihli]);

  // id → {satır, leftPx, widthPx, midY}
  const konum = useMemo(() => {
    const m = new Map<string, { r: number; leftPx: number; widthPx: number; endPx: number; midY: number }>();
    tarihli.forEach((k, r) => {
      const bas = new Date(k.baslangic).getTime();
      const bit = new Date(k.bitis).getTime();
      const leftPx = ((bas - minT) / GUN_MS / totalDays) * tlW;
      const widthPx = Math.max(4, ((bit - bas) / GUN_MS + 1) / totalDays * tlW);
      m.set(k.id, { r, leftPx, widthPx, endPx: leftPx + widthPx, midY: r * SATIR_H + BAR_H / 2 + 4 });
    });
    return m;
  }, [tarihli, minT, totalDays, tlW]);

  const bugunPx = ((Date.now() - minT) / GUN_MS / totalDays) * tlW;
  const ganttH = tarihli.length * SATIR_H;

  // Çizilecek ok yolları
  const oklar = useMemo(() => {
    const out: { d: string; ax: number; ay: number }[] = [];
    for (const k of tarihli) {
      const dep = konum.get(k.id);
      if (!dep) continue;
      for (const onceId of k.oncekiler ?? []) {
        const pred = konum.get(onceId);
        if (!pred) continue;
        const x1 = pred.endPx, y1 = pred.midY;
        const x2 = dep.leftPx, y2 = dep.midY;
        const mx = Math.max(x1 + 8, x2 - 12);
        // dirsekli yol: pred sonundan → sağa → dep başına dik → dep başına
        const d = `M ${x1} ${y1} H ${mx} V ${y2} H ${x2 - 2}`;
        out.push({ d, ax: x2 - 2, ay: y2 });
      }
    }
    return out;
  }, [tarihli, konum]);

  function csvIndir() {
    const proje = projects.find((p) => p.id === projectId);
    if (!proje) return;
    const adById = new Map(kalemler.map((k) => [k.id, k.ad]));
    const head = "İş Kalemi;Grup;Sorumlu;Başlangıç;Bitiş;İlerleme %;Bağımlı Olduğu İşler";
    const rows = kalemler.map((k) =>
      [k.ad, k.grup, k.sorumlu, k.baslangic, k.bitis, k.ilerleme,
       (k.oncekiler ?? []).map((id) => adById.get(id) ?? "").join(" | ")].join(";"),
    );
    const csv = "﻿" + [head, ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `is-programi-${proje.name.replaceAll(" ", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-extrabold text-slate-900">📋 İş Süreçleri</h1>
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
          <h1 className="text-2xl font-extrabold text-slate-900">📋 İş Süreçleri</h1>
          <p className="mt-1 text-sm text-slate-500">İş programı, sorumlu, tarih, ilerleme + <b>bağımlılık okları</b> ile Gantt.</p>
        </div>
        <select value={projectId} onChange={(e) => switchProject(e.target.value)}
          className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Özet */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Genel İlerleme", `%${ozet.genelIlerleme}`, "📊"],
          ["Toplam İş", String(ozet.toplam), "📋"],
          ["Tamamlanan", String(ozet.tamamlanan), "✅"],
          ["Geciken", String(ozet.geciken), "⏰"],
        ].map(([l, v], idx) => (
          <div key={l} className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm ${idx === 3 && ozet.geciken > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-500">{l}</div>
              <div className={`text-xl font-extrabold ${idx === 3 && ozet.geciken > 0 ? "text-red-600" : "text-slate-900"}`}>{v}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Gantt + bağımlılık okları */}
      {tarihli.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-700">📅 Gantt — Bağımlılık Okları</h2>
            <span className="text-xs text-slate-400">{Math.round(totalDays)} gün · oklar: önce biten → sonra başlayan</span>
          </div>
          <div className="relative mt-5 min-w-[640px]" style={{ height: ganttH + 8 }}>
            {/* satırlar */}
            {tarihli.map((k) => {
              const p = konum.get(k.id)!;
              const gecikti = k.bitis < new Date().toISOString().slice(0, 10) && k.ilerleme < 100;
              return (
                <div key={k.id} className="absolute left-0 flex items-center" style={{ top: p.r * SATIR_H, height: SATIR_H, width: "100%" }}>
                  <div className="shrink-0 truncate pr-2 text-xs font-semibold text-slate-700" style={{ width: ETIKET_W }} title={k.ad}>{k.ad}</div>
                  <div className="relative" style={{ width: `calc(100% - ${ETIKET_W}px)`, height: BAR_H }}>
                    <div className={`absolute rounded ${gecikti ? "bg-red-200" : "bg-ink-700/25"}`} style={{ left: p.leftPx, width: p.widthPx, height: BAR_H }}>
                      <div className={`h-full rounded ${gecikti ? "bg-red-500" : "bg-gradient-to-r from-ink-700 to-brand-500"}`} style={{ width: `${k.ilerleme}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90">{k.ilerleme > 12 ? `%${k.ilerleme}` : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* SVG ok katmanı (timeline alanı üzerinde) */}
            <div ref={timelineRef} className="absolute top-0" style={{ left: ETIKET_W, width: `calc(100% - ${ETIKET_W}px)`, height: ganttH, pointerEvents: "none" }}>
              <svg width={tlW} height={ganttH} className="overflow-visible">
                {/* bugün çizgisi */}
                {bugunPx >= 0 && bugunPx <= tlW && (
                  <>
                    <line x1={bugunPx} y1={0} x2={bugunPx} y2={ganttH} stroke="var(--color-brand-500)" strokeWidth={1.5} strokeDasharray="3 3" />
                  </>
                )}
                {oklar.map((o, i) => (
                  <g key={i}>
                    <path d={o.d} fill="none" stroke="#64748b" strokeWidth={1.5} />
                    <polygon points={`${o.ax},${o.ay} ${o.ax - 5},${o.ay - 3} ${o.ax - 5},${o.ay + 3}`} fill="#64748b" />
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Tablo */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-700">İş Kalemleri</h2>
          <div className="flex gap-2">
            <button onClick={ekle} className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600">+ İş Ekle</button>
            <button onClick={csvIndir} className="rounded-xl bg-ink-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-ink-800">⬇ CSV</button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500">
                <th className="px-3 py-2.5">İş Kalemi</th>
                <th className="px-3 py-2.5">Sorumlu</th>
                <th className="px-3 py-2.5">Başlangıç</th>
                <th className="px-3 py-2.5">Bitiş</th>
                <th className="px-3 py-2.5">İlerleme</th>
                <th className="px-3 py-2.5">Bağımlılık</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {kalemler.map((k) => {
                const oncekiAdlar = (k.oncekiler ?? []).map((id) => kalemler.find((x) => x.id === id)?.ad).filter(Boolean);
                return (
                  <tr key={k.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-1.5">
                      <input value={k.ad} onChange={(e) => guncelle(k.id, { ad: e.target.value })}
                        className="w-48 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold outline-none focus:border-brand-500" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input value={k.sorumlu} onChange={(e) => guncelle(k.id, { sorumlu: e.target.value })} placeholder="—"
                        className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="date" value={k.baslangic} onChange={(e) => guncelle(k.id, { baslangic: e.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-500" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="date" value={k.bitis} onChange={(e) => guncelle(k.id, { bitis: e.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-500" />
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <input type="range" min="0" max="100" step="5" value={k.ilerleme}
                          onChange={(e) => guncelle(k.id, { ilerleme: parseInt(e.target.value) })}
                          className="w-20 accent-[var(--color-brand-500)]" />
                        <span className="w-9 text-right text-xs font-bold text-slate-700">%{k.ilerleme}</span>
                      </div>
                    </td>
                    <td className="relative px-3 py-1.5">
                      <button onClick={() => setAcikDep(acikDep === k.id ? null : k.id)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-500">
                        ↳ {oncekiAdlar.length ? `${oncekiAdlar.length} iş` : "ekle"}
                      </button>
                      {acikDep === k.id && (
                        <div className="absolute right-2 top-9 z-20 max-h-56 w-60 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                          <div className="mb-1 text-[10px] font-bold uppercase text-slate-400">Önce bitmesi gerekenler</div>
                          {kalemler.filter((o) => o.id !== k.id).map((o) => (
                            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-50">
                              <input type="checkbox" checked={(k.oncekiler ?? []).includes(o.id)}
                                onChange={() => depToggle(k.id, o.id)} className="h-3.5 w-3.5 accent-[var(--color-brand-500)]" />
                              <span className="truncate text-slate-600">{o.ad}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {oncekiAdlar.length > 0 && (
                        <div className="mt-1 max-w-40 truncate text-[10px] text-slate-400" title={oncekiAdlar.join(", ")}>{oncekiAdlar.join(", ")}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => sil(k.id)} className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          💡 &quot;Bağımlılık&quot; sütununda bir işin <b>önce bitmesi gereken</b> işleri seçin; Gantt&apos;ta ok ile gösterilir. İş kalemleri ilk açılışta yol haritasından oluşturulur.
        </p>
      </div>

      <div className="mt-8 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}
