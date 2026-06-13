"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type Project,
  type PhaseStatus,
  TYPE_LABELS,
  FLOOR_USAGE_LABELS,
  ROOF_LABELS,
  getProject,
  updateProject,
  projectProgress,
  formatTL,
} from "@/lib/projects";

const STATUS_FLOW: Record<PhaseStatus, PhaseStatus> = {
  bekliyor: "devam",
  devam: "tamam",
  tamam: "bekliyor",
};

const STATUS_UI: Record<
  PhaseStatus,
  { label: string; chip: string; ring: string }
> = {
  bekliyor: {
    label: "Bekliyor",
    chip: "bg-slate-100 text-slate-500",
    ring: "border-slate-200 bg-white",
  },
  devam: {
    label: "Devam Ediyor",
    chip: "bg-brand-500/15 text-brand-600",
    ring: "border-brand-500/50 bg-brand-500/5",
  },
  tamam: {
    label: "Tamamlandı ✓",
    chip: "bg-emerald-100 text-emerald-600",
    ring: "border-emerald-300 bg-emerald-50/50",
  },
};

export default function ProjeDetayPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);

  useEffect(() => {
    setProject(getProject(id) ?? null);
  }, [id]);

  function cyclePhase(index: number) {
    if (!project) return;
    const phases = project.phases.map((ph, i) =>
      i === index ? { ...ph, status: STATUS_FLOW[ph.status] } : ph,
    );
    const updated = { ...project, phases };
    updateProject(updated);
    setProject(updated);
  }

  if (project === undefined) {
    return <div className="p-8 text-sm text-slate-500">Yükleniyor…</div>;
  }

  if (project === null) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="text-4xl">🤔</div>
        <h1 className="mt-3 text-lg font-bold text-slate-900">Proje bulunamadı</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bu proje silinmiş olabilir ya da farklı bir tarayıcıda oluşturulmuş
          olabilir (demo veriler tarayıcıya kaydedilir).
        </p>
        <Link
          href="/panel"
          className="mt-5 inline-block rounded-xl bg-ink-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-ink-800"
        >
          ← Projelere Dön
        </Link>
      </div>
    );
  }

  const progress = projectProgress(project);
  const done = project.phases.filter((p) => p.status === "tamam").length;
  const inProgress = project.phases.filter((p) => p.status === "devam").length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Üst başlık */}
      <Link
        href="/panel"
        className="text-sm font-semibold text-slate-500 transition hover:text-ink-800"
      >
        ← Projeler
      </Link>

      <div className="mt-3 rounded-2xl bg-ink-950 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{project.name}</h1>
            <p className="mt-1 text-sm text-white/70">
              {project.city} · {TYPE_LABELS[project.type]} ·{" "}
              {project.area.toLocaleString("tr-TR")} m² · {project.floors} kat
              {project.budget != null && <> · Bütçe: {formatTL(project.budget)}</>}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/panel/yeni?duzenle=${project.id}`}
              className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
            >
              ✎ Düzenle
            </Link>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-brand-400">%{progress}</div>
              <div className="text-xs text-white/60">genel ilerleme</div>
            </div>
          </div>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-yellow-300 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/70">
          <span>✓ {done} aşama tamamlandı</span>
          <span>⏳ {inProgress} aşama devam ediyor</span>
          <span>○ {project.phases.length - done - inProgress} aşama bekliyor</span>
        </div>
      </div>

      {/* Yol haritası */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">
            🏗️ İnşaat Yol Haritası
          </h2>
          <span className="text-xs text-slate-500">
            Bir aşamaya tıklayarak durumunu değiştirin
          </span>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {project.phases.map((ph, i) => {
            const ui = STATUS_UI[ph.status];
            return (
              <li key={ph.name}>
                <button
                  onClick={() => cyclePhase(i)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition hover:shadow-md ${ui.ring}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold ${
                      ph.status === "tamam"
                        ? "bg-emerald-500 text-white"
                        : ph.status === "devam"
                          ? "bg-brand-500 text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {ph.status === "tamam" ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {ph.name}
                    </span>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${ui.chip}`}
                    >
                      {ui.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Bina & kat/daire özeti */}
      {(project.bina || (project.katlar && project.katlar.length > 0)) && (
        <section className="mt-10">
          <h2 className="text-lg font-extrabold text-slate-900">🏢 Bina & Daire Bilgileri</h2>

          {project.bina && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Kat Yüksekliği", project.bina.katYuksekligi != null ? `${project.bina.katYuksekligi} m` : null],
                ["Çatı", project.bina.catiTipi ? `${ROOF_LABELS[project.bina.catiTipi]}${project.bina.catiAlan ? ` · ${project.bina.catiAlan} m²` : ""}` : null],
                ["Toplam Daire", project.bina.toplamDaire != null ? String(project.bina.toplamDaire) : null],
                ["Asansör", project.bina.asansorAdet != null ? `${project.bina.asansorAdet} ad${project.bina.asansorDurak ? ` · ${project.bina.asansorDurak} durak` : ""}` : null],
                ["Merdiven", project.bina.merdivenBasamak != null ? `${project.bina.merdivenBasamak} basamak${project.bina.merdivenAlan ? ` · ${project.bina.merdivenAlan} m²` : ""}` : null],
                ["Bina Holü", project.bina.binaHol != null ? `${project.bina.binaHol} m²` : null],
                ["Yangın Merdiveni", project.bina.yanginMerdiveni ? "Var" : null],
                ["Asansör Cinsi", project.bina.asansorCins || null],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{k}</div>
                    <div className="mt-0.5 text-sm font-bold text-slate-900">{v}</div>
                  </div>
                ))}
            </div>
          )}

          {project.katlar && project.katlar.length > 0 && (
            <div className="mt-4 space-y-3">
              {project.katlar.map((kat) => (
                <div key={kat.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-bold text-white">{kat.ad}</span>
                    {kat.benzerAdet && kat.benzerAdet > 1 && (
                      <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600">×{kat.benzerAdet} benzer kat</span>
                    )}
                    <span className="text-xs text-slate-500">{FLOOR_USAGE_LABELS[kat.kullanim]}</span>
                    {kat.pdfAdi && <span className="text-xs text-emerald-600">📎 plandan okundu</span>}
                  </div>
                  {kat.daireler.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {kat.daireler.map((d) => (
                        <div key={d.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                          <b className="text-ink-800">{d.tip}</b>
                          {d.adet > 1 && <span className="text-slate-500"> ×{d.adet}</span>}
                          {(() => {
                            const odaToplam = (d.detay.odaAlanlar ?? []).reduce((s, v) => s + (v || 0), 0);
                            const salonToplam = (d.detay.salonAlanlar ?? []).reduce((s, v) => s + (v || 0), 0);
                            const islak = (d.detay.mutfakAlan ?? 0) + (d.detay.banyoAlan ?? 0) + (d.detay.wcAlan ?? 0);
                            const toplam = d.detay.alan ?? odaToplam + salonToplam + islak;
                            const odaSay = (d.detay.odaAlanlar ?? []).length;
                            return (
                              <>
                                {toplam > 0 && <span className="ml-2 text-slate-600">{Math.round(toplam)} m²</span>}
                                {odaSay > 0 && <span className="ml-2 text-slate-400">{odaSay} oda</span>}
                              </>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">Tanımlı bölüm yok.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Yakında gelecek modüller */}
      <section className="mt-10">
        <h2 className="text-lg font-extrabold text-slate-900">Proje Modülleri</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/panel/metraj?proje=${project.id}`}
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md"
          >
            <div className="text-2xl">📏</div>
            <div className="mt-2 text-sm font-bold text-slate-900">
              Keşif &amp; Metraj
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Mahal bazlı metraj girin, keşif özeti alın
            </p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">
              Metraja Git →
            </span>
          </Link>
          <Link
            href={`/panel/maliyet?proje=${project.id}`}
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md"
          >
            <div className="text-2xl">💰</div>
            <div className="mt-2 text-sm font-bold text-slate-900">
              Maliyet Tahmini
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Bu projenin verileriyle hızlı maliyet hesapla
            </p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">
              Hesapla →
            </span>
          </Link>
          <Link href={`/panel/is-surecleri?proje=${project.id}`}
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md">
            <div className="text-2xl">📋</div>
            <div className="mt-2 text-sm font-bold text-slate-900">İş Süreçleri</div>
            <p className="mt-1 text-xs text-slate-500">İş programı + Gantt zaman çizelgesi</p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">Programa Git →</span>
          </Link>
          <Link href={`/panel/saha?proje=${project.id}`}
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md">
            <div className="text-2xl">📸</div>
            <div className="mt-2 text-sm font-bold text-slate-900">Saha Takibi</div>
            <p className="mt-1 text-xs text-slate-500">Fotoğraflı ilerleme + onay akışı</p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">Sahaya Git →</span>
          </Link>
          <Link href={`/panel/teklif?proje=${project.id}`}
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md">
            <div className="text-2xl">📄</div>
            <div className="mt-2 text-sm font-bold text-slate-900">Teklif</div>
            <p className="mt-1 text-xs text-slate-500">Keşiften müşteriye PDF teklif</p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">Teklif Hazırla →</span>
          </Link>
          <Link href={`/panel/mk-ai?proje=${project.id}`}
            className="group rounded-2xl border-2 border-ink-900/30 bg-gradient-to-br from-ink-900 to-ink-800 p-5 shadow-sm transition hover:border-ink-900 hover:shadow-md">
            <div className="text-2xl">🤖</div>
            <div className="mt-2 text-sm font-bold text-white">mk_ai — Risk Asistanı</div>
            <p className="mt-1 text-xs text-white/70">Otomatik risk skoru + öneriler</p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-500 transition group-hover:translate-x-0.5">Analiz Et →</span>
          </Link>
          <Link href="/panel/plan3d"
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md">
            <div className="text-2xl">🧊</div>
            <div className="mt-2 text-sm font-bold text-slate-900">Plan → 3B Stüdyo</div>
            <p className="mt-1 text-xs text-slate-500">PDF/DXF/JPEG → 3B model + animasyon + video</p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">Stüdyoyu Aç →</span>
          </Link>
          <Link href={`/panel/3d?proje=${project.id}`}
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md">
            <div className="text-2xl">🏢</div>
            <div className="mt-2 text-sm font-bold text-slate-900">3B Görselleştirme</div>
            <p className="mt-1 text-xs text-slate-500">Kat verisinden otomatik bina kütlesi</p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">3B Görüntüle →</span>
          </Link>
          <Link href={`/panel/hakedis?proje=${project.id}`}
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md">
            <div className="text-2xl">🧾</div>
            <div className="mt-2 text-sm font-bold text-slate-900">Hakediş</div>
            <p className="mt-1 text-xs text-slate-500">Taşeron dönemsel istihkak ödemesi</p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">Hakediş Düzenle →</span>
          </Link>
          <Link href={`/panel/personel?proje=${project.id}`}
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md">
            <div className="text-2xl">👷</div>
            <div className="mt-2 text-sm font-bold text-slate-900">Personel & Puantaj</div>
            <p className="mt-1 text-xs text-slate-500">Çalışan listesi (SGK) + aylık puantaj</p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">Personele Git →</span>
          </Link>
          <Link href={`/panel/muhasebe?proje=${project.id}`}
            className="group rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md">
            <div className="text-2xl">📒</div>
            <div className="mt-2 text-sm font-bold text-slate-900">Muhasebe</div>
            <p className="mt-1 text-xs text-slate-500">Gelir-gider, bütçe vs gerçekleşen</p>
            <span className="mt-2 inline-block text-xs font-bold text-brand-600 transition group-hover:translate-x-0.5">Muhasebeye Git →</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
