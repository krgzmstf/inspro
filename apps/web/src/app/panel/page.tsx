"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type Project,
  TYPE_LABELS,
  loadProjects,
  saveProjects,
  deleteProject,
  projectProgress,
  formatTL,
} from "@/lib/projects";
import { loadMuhasebe, muhasebeOzeti, loadAllMuhasebe, saveMuhasebe } from "@/lib/muhasebe";
import { loadSaha } from "@/lib/saha";
import { loadIsSurecleri, isOzeti } from "@/lib/isSurecleri";
import { projeleriSenkronla } from "@/lib/projeSenkron";
import { muhasebeSenkronla } from "@/lib/muhasebeSenkron";
import YedekKart from "./YedekKart";

interface ProjeStat {
  gelir: number; gider: number;
  acikKusur: number; gecikenIs: number; isIlerleme: number;
}

export default function PanelPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statlar, setStatlar] = useState<Record<string, ProjeStat>>({});

  function hesaplaStatlar(list: Project[]) {
    const s: Record<string, ProjeStat> = {};
    for (const p of list) {
      const mu = muhasebeOzeti(loadMuhasebe(p.id));
      const saha = loadSaha(p.id);
      const is = isOzeti(loadIsSurecleri(p.id));
      s[p.id] = {
        gelir: mu.toplamGelir,
        gider: mu.toplamGider,
        acikKusur: saha.filter((k) => k.tip === "kusur" && k.durum !== "tamam").length,
        gecikenIs: is.geciken,
        isIlerleme: is.genelIlerleme,
      };
    }
    setStatlar(s);
  }

  useEffect(() => {
    const list = loadProjects();
    setProjects(list);
    setLoaded(true);
    hesaplaStatlar(list);
    
    // Bulut senkronu (Supabase oturumu varsa)
    projeleriSenkronla(list).then((bulut) => {
      let guncelProjeler = list;
      if (bulut) {
        saveProjects(bulut);
        setProjects(bulut);
        guncelProjeler = bulut;
      }
      
      // Muhasebe senkronu
      const yerelMuhasebe = loadAllMuhasebe();
      muhasebeSenkronla(yerelMuhasebe).then((bulutMu) => {
        if (bulutMu) {
          saveMuhasebe(bulutMu);
        }
        hesaplaStatlar(guncelProjeler);
      });
    });
  }, []);

  function handleDelete(id: string, projectName: string) {
    if (!confirm(`"${projectName}" projesi silinsin mi? Bu işlem geri alınamaz.`)) return;
    deleteProject(id);
    setProjects(loadProjects());
  }

  const totalArea = projects.reduce((s, p) => s + p.area, 0);
  const avgProgress = projects.length
    ? Math.round(projects.reduce((s, p) => s + projectProgress(p), 0) / projects.length)
    : 0;

  const genel = useMemo(() => {
    const v = Object.values(statlar);
    return {
      gelir: v.reduce((s, x) => s + x.gelir, 0),
      gider: v.reduce((s, x) => s + x.gider, 0),
      acikKusur: v.reduce((s, x) => s + x.acikKusur, 0),
      gecikenIs: v.reduce((s, x) => s + x.gecikenIs, 0),
    };
  }, [statlar]);

  const dikkat = projects.filter((p) => {
    const st = statlar[p.id];
    return st && (st.gecikenIs > 0 || st.acikKusur > 0 || (p.budget && st.gider > p.budget));
  });

  return (
    <div className="mx-auto max-w-6xl">
      {/* Başlık + Yeni Proje */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Projeler</h1>        
          <p className="mt-1 text-sm text-slate-500">
            Tüm şantiyelerinizi tek ekrandan yönetin.
          </p>
        </div>
        <Link
          href="/panel/yeni"
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
        >
          + Yeni Proje
        </Link>
      </div>

      {/* Özet kartları — komuta merkezi */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Aktif Proje", String(projects.length), "🏗️"],
          ["Toplam Alan", `${totalArea.toLocaleString("tr-TR")} m²`, "📐"],
        ].map(([label, value, icon]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-lg">{icon}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="text-base font-extrabold text-slate-900">{value}</div>    
          </div>
        ))}
      </div>

      {/* Dikkat gerektirenler */}
      {dikkat.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-amber-800">⚠️ Dikkat Gerektiren Projeler ({dikkat.length})</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {dikkat.map((p) => {
              const st = statlar[p.id];
              const asim = p.budget != null && st.gider > p.budget;
              return (
                <Link key={p.id} href={`/panel/proje/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm transition hover:border-amber-400">      
                  <span className="min-w-0 truncate font-semibold text-slate-800">{p.name}</span>
                  <span className="flex shrink-0 gap-1.5 text-[11px] font-bold">      
                    {st.gecikenIs > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-600">{st.gecikenIs} geciken iş</span>}
                    {st.acikKusur > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{st.acikKusur} kusur</span>}
                    {asim && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-600">bütçe aşımı</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Proje listesi */}
      <div className="mt-8">
        {loaded && projects.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="text-4xl">🏗️</div>
            <h3 className="mt-3 text-lg font-bold text-slate-900">
              Henüz proje yok
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              İlk projenizi oluşturun; kat planı yükleyin, 13 aşamalı yol haritası otomatik kurulsun.
            </p>
            <Link
              href="/panel/yeni"
              className="mt-5 inline-block rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
            >
              + İlk Projeyi Oluştur
            </Link>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((p) => {
            const progress = projectProgress(p);
            const activePhase =
              p.phases.find((ph) => ph.status === "devam")?.name ??
              p.phases.find((ph) => ph.status === "bekliyor")?.name ??
              "Tamamlandı 🎉";
            return (
              <div
                key={p.id}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-500/50 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/panel/proje/${p.id}`}
                      className="block truncate text-lg font-bold text-slate-900 transition group-hover:text-ink-800"
                    >
                      {p.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {p.city} · {TYPE_LABELS[p.type]} ·{" "}
                      {p.area.toLocaleString("tr-TR")} m² · {p.floors} kat
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-ink-900 px-3 py-1 text-xs font-bold text-white">
                    %{progress}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">  
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-300 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">      
                  <span className="text-slate-500">
                    Sıradaki: <b className="text-slate-700">{activePhase}</b>        
                  </span>
                  {p.budget != null && (
                    <span className="font-semibold text-slate-600">
                      Bütçe: {formatTL(p.budget)}
                    </span>
                  )}
                </div>
                {statlar[p.id] && (statlar[p.id].gider > 0 || statlar[p.id].gecikenIs > 0 || statlar[p.id].acikKusur > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold"> 
                    {statlar[p.id].gider > 0 && (
                      <span className={`rounded-full px-2 py-0.5 ${p.budget && statlar[p.id].gider > p.budget ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                        Gider: {formatTL(statlar[p.id].gider)}
                      </span>
                    )}
                    {statlar[p.id].gecikenIs > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-600">⌚ {statlar[p.id].gecikenIs}</span>}
                    {statlar[p.id].acikKusur > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">⚠️ {statlar[p.id].acikKusur}</span>}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/panel/proje/${p.id}`}
                    className="flex-1 rounded-xl bg-ink-900 py-2 text-center text-xs font-bold text-white transition hover:bg-ink-800"
                  >
                    Projeyi Aç →
                  </Link>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-red-300 hover:text-red-500"        
                    title="Projeyi sil"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Veri yedekleme / geri yükleme */}
        <YedekKart />
      </div>
    </div>
  );
}
