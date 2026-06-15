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
import {
  type AsamaKalem,
  type KalemDurum,
  type AsamaOzet,
  VARSAYILAN_KALEMLER,
  loadAsamaKalemleri,
  addAsamaKalem,
  updateAsamaKalem,
  deleteAsamaKalem,
  tasiKalem,
  varsayilanYukle,
  projeAsamaSayilari,
  asamaToplamFiyat,
  asamaToplamAlinan,
  projeTumKalemler,
} from "@/lib/asamaKalem";
import { type Personel, loadPersonel } from "@/lib/personel";
import { senkronAsamaMuhasebe, senkronAsamaIsSurecleri } from "@/lib/entegrasyon";

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

  // Aşama kalemleri (yol haritası alt adımları)
  const [acikAsama, setAcikAsama] = useState<string | null>(null);
  const [kalemler, setKalemler] = useState<AsamaKalem[]>([]);
  const [sayilar, setSayilar] = useState<Record<string, AsamaOzet>>({});
  const [takipler, setTakipler] = useState<Record<string, AsamaKalem[]>>({});

  useEffect(() => {
    setProject(getProject(id) ?? null);
    setSayilar(projeAsamaSayilari(id));
    setTakipler(projeTumKalemler(id));
  }, [id]);

  function takipYenile() {
    senkronAsamaMuhasebe(id);       // İş Takibi → Muhasebe (planlanan açık)
    senkronAsamaIsSurecleri(id);    // İş Takibi → İş Süreçleri (Gantt)
    setTakipler(projeTumKalemler(id));
    setSayilar(projeAsamaSayilari(id));
  }

  function cyclePhase(index: number) {
    if (!project) return;
    const phases = project.phases.map((ph, i) =>
      i === index ? { ...ph, status: STATUS_FLOW[ph.status] } : ph,
    );
    const updated = { ...project, phases };
    updateProject(updated);
    setProject(updated);
  }

  function setPhaseStatus(asama: string, status: PhaseStatus) {
    if (!project) return;
    const phases = project.phases.map((ph) => (ph.name === asama ? { ...ph, status } : ph));
    const updated = { ...project, phases };
    updateProject(updated);
    setProject(updated);
  }

  function asamaAc(asama: string) {
    setAcikAsama(asama);
    setKalemler(loadAsamaKalemleri(id, asama));
  }

  function kalemleriYenile(asama: string) {
    senkronAsamaMuhasebe(id);       // değişiklikleri muhasebeye yansıt
    senkronAsamaIsSurecleri(id);    // İş Süreçleri'ne yansıt
    setKalemler(loadAsamaKalemleri(id, asama));
    setSayilar(projeAsamaSayilari(id));
    setTakipler(projeTumKalemler(id));
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
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-300 transition-all"
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
            Aşamaya tıklayıp içine iş kalemleri açın
          </span>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {project.phases.map((ph, i) => {
            const ui = STATUS_UI[ph.status];
            const oz = sayilar[ph.name];
            return (
              <li key={ph.name}>
                <button
                  onClick={() => asamaAc(ph.name)}
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
                    <span className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${ui.chip}`}
                      >
                        {ui.label}
                      </span>
                      {oz && oz.toplam > 0 && (
                        <span className="text-[10px] font-bold text-slate-400">
                          {oz.tamam}/{oz.toplam} kalem · %{oz.yuzde}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-slate-300">›</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Aşama takip sayfası (kaydedilen kalemler: onay + ödeme) */}
      {project.phases.some((ph) => (takipler[ph.name]?.length ?? 0) > 0) && (
        <section className="mt-10">
          <h2 className="text-lg font-extrabold text-slate-900">✅ İş Takibi</h2>
          <p className="mt-1 text-xs text-slate-500">
            İşler yapıldıkça onaylayın (bitiş tarihini o an girin); ödeme durumunu işaretleyin.
          </p>
          <div className="mt-4 space-y-4">
            {project.phases
              .filter((ph) => (takipler[ph.name]?.length ?? 0) > 0)
              .map((ph) => (
                <TakipPanel
                  key={ph.name}
                  asama={ph.name}
                  kalemler={takipler[ph.name]}
                  onYenile={takipYenile}
                  onDuzenle={() => asamaAc(ph.name)}
                />
              ))}
          </div>
        </section>
      )}

      {/* Aşama kalemleri modalı (planlama) */}
      {acikAsama && project && (
        <AsamaModal
          projeId={id}
          asama={acikAsama}
          durum={project.phases.find((p) => p.name === acikAsama)?.status ?? "bekliyor"}
          kalemler={kalemler}
          onKapat={() => { setAcikAsama(null); takipYenile(); }}
          onYenile={() => kalemleriYenile(acikAsama)}
          onDurum={(s) => setPhaseStatus(acikAsama, s)}
        />
      )}

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

/* ── Aşama kalemleri modalı ──────────────────────────────── */

const KALEM_DURUM_FLOW: Record<KalemDurum, KalemDurum> = {
  bekliyor: "devam", devam: "tamam", tamam: "bekliyor",
};
const KALEM_DURUM_UI: Record<KalemDurum, { nokta: string; etiket: string }> = {
  bekliyor: { nokta: "bg-slate-300", etiket: "Bekliyor" },
  devam: { nokta: "bg-brand-500", etiket: "Devam" },
  tamam: { nokta: "bg-emerald-500", etiket: "Tamam" },
};

function AsamaModal({
  projeId, asama, durum, kalemler, onKapat, onYenile, onDurum,
}: {
  projeId: string;
  asama: string;
  durum: PhaseStatus;
  kalemler: AsamaKalem[];
  onKapat: () => void;
  onYenile: () => void;
  onDurum: (s: PhaseStatus) => void;
}) {
  const [yeniAd, setYeniAd] = useState("");
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const sablonVar = (VARSAYILAN_KALEMLER[asama]?.length ?? 0) > 0;

  useEffect(() => { setPersoneller(loadPersonel(projeId)); }, [projeId, kalemler]);

  const tamam = kalemler.filter((k) => k.durum === "tamam").length;
  const yuzde = kalemler.length ? Math.round((tamam / kalemler.length) * 100) : 0;
  const toplam = asamaToplamFiyat(kalemler);

  function ekle(e: React.FormEvent) {
    e.preventDefault();
    if (!yeniAd.trim()) return;
    addAsamaKalem(projeId, asama, yeniAd);
    setYeniAd("");
    onYenile();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onKapat}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Başlık */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-brand-600">İnşaat Yol Haritası</div>
            <h3 className="text-lg font-extrabold text-slate-900">{asama}</h3>
            {kalemler.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold text-slate-500">
                <span>{tamam}/{kalemler.length} kalem tamam · %{yuzde}</span>
                {toplam > 0 && <span className="text-brand-600">Toplam: {formatTL(toplam)}</span>}
              </div>
            )}
          </div>
          <button onClick={onKapat} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        {/* Aşama durumu */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <span className="text-xs font-semibold text-slate-500">Aşama durumu:</span>
          {(["bekliyor", "devam", "tamam"] as PhaseStatus[]).map((s) => (
            <button key={s} onClick={() => onDurum(s)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                durum === s
                  ? s === "tamam" ? "bg-emerald-500 text-white" : s === "devam" ? "bg-brand-500 text-white" : "bg-slate-400 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}>
              {STATUS_UI[s].label}
            </button>
          ))}
        </div>

        {/* Kalem listesi */}
        <div className="max-h-[50vh] overflow-y-auto p-5">
          {kalemler.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">Bu aşamada henüz iş kalemi yok.</p>
              {sablonVar && (
                <button onClick={() => { varsayilanYukle(projeId, asama); onYenile(); }}
                  className="mt-3 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">
                  ⚡ Hazır iş sırasını yükle ({VARSAYILAN_KALEMLER[asama].length} kalem)
                </button>
              )}
            </div>
          ) : (
            <ol className="space-y-2">
              {kalemler.map((k, i) => {
                const ui = KALEM_DURUM_UI[k.durum];
                return (
                  <li key={k.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
                    {/* Üst satır: sıra · durum · ad · sırala · sil */}
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                      <button
                        onClick={() => { updateAsamaKalem(k.id, { durum: KALEM_DURUM_FLOW[k.durum] }); onYenile(); }}
                        title={ui.etiket}
                        className={`h-4 w-4 shrink-0 rounded-full ${ui.nokta} ring-2 ring-white transition`}
                      />
                      <input
                        value={k.ad}
                        onChange={(e) => { updateAsamaKalem(k.id, { ad: e.target.value }); onYenile(); }}
                        className={`min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none ${k.durum === "tamam" ? "text-slate-400 line-through" : "text-slate-800"}`}
                      />
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button onClick={() => { tasiKalem(projeId, asama, k.id, -1); onYenile(); }} disabled={i === 0}
                          className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 disabled:opacity-30">▲</button>
                        <button onClick={() => { tasiKalem(projeId, asama, k.id, 1); onYenile(); }} disabled={i === kalemler.length - 1}
                          className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 disabled:opacity-30">▼</button>
                        <button onClick={() => { deleteAsamaKalem(k.id); onYenile(); }}
                          className="rounded px-1.5 py-1 text-xs text-slate-300 hover:bg-red-50 hover:text-red-500">🗑</button>
                      </div>
                    </div>
                    {/* Alt satır: başlangıç · kişi · planlanan fiyat */}
                    <div className="mt-2 grid grid-cols-2 gap-2 pl-7 sm:grid-cols-3">
                      <label className="block text-[10px] font-semibold text-slate-400">Başlangıç
                        <input type="date" value={k.baslangic ?? ""}
                          onChange={(e) => { updateAsamaKalem(k.id, { baslangic: e.target.value }); onYenile(); }}
                          className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500" />
                      </label>
                      <div className="block text-[10px] font-semibold text-slate-400">Kişi (personelden)
                        <PersonelPicker
                          personeller={personeller}
                          seciliId={k.personelId}
                          seciliAd={k.personelAd}
                          projeId={projeId}
                          onSec={(p) => { updateAsamaKalem(k.id, { personelId: p?.id, personelAd: p ? `${p.ad} ${p.soyad}`.trim() : undefined }); onYenile(); }}
                        />
                      </div>
                      <label className="block text-[10px] font-semibold text-slate-400">Planlanan fiyat (₺)
                        <input type="number" min="0" step="0.01" value={k.fiyat ?? ""}
                          onChange={(e) => { updateAsamaKalem(k.id, { fiyat: e.target.value === "" ? undefined : Number(e.target.value) }); onYenile(); }}
                          placeholder="0"
                          className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500" />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Yeni kalem ekleme */}
        <form onSubmit={ekle} className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-4">
          <input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Yeni iş kalemi ekle (17, 18, 19…)"
            className="min-w-[180px] flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          <button type="submit" className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-ink-800">+ Ekle</button>
        </form>
        <p className="px-4 text-[11px] text-slate-400">
          Kişiyi listeden seçebilmek için önce <a href={`/panel/personel?proje=${projeId}`} className="font-semibold text-brand-600 hover:underline">Personel &amp; Puantaj</a> modülüne ekleyin; burada ad/telefon ile arayıp çağırırsınız.
        </p>
        {/* Kaydet */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
          <span className="mr-auto text-[11px] text-slate-400">Değişiklikler otomatik kaydedilir.</span>
          <button onClick={onKapat} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
            💾 Kaydet ve Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Aşama İş Takibi paneli (onay + bitiş tarihi + ödeme) ── */

function TakipPanel({
  asama, kalemler, onYenile, onDuzenle,
}: {
  asama: string;
  kalemler: AsamaKalem[];
  onYenile: () => void;
  onDuzenle: () => void;
}) {
  const tamam = kalemler.filter((k) => k.durum === "tamam").length;
  const toplamPlan = asamaToplamFiyat(kalemler);
  const toplamAlinan = asamaToplamAlinan(kalemler);

  function onayla(k: AsamaKalem) {
    // İş bitti onayı: tamam yap, bitiş tarihi boşsa bugünü gir
    updateAsamaKalem(k.id, {
      durum: "tamam",
      bitis: k.bitis || new Date().toISOString().slice(0, 10),
    });
    onYenile();
  }
  function onayGeriAl(k: AsamaKalem) {
    updateAsamaKalem(k.id, { durum: "devam" });
    onYenile();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">{asama}</h3>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] font-semibold text-slate-500">
            <span>{tamam}/{kalemler.length} onaylı</span>
            <span>Planlanan: {formatTL(toplamPlan)}</span>
            <span className="text-emerald-600">Alınan: {formatTL(toplamAlinan)}</span>
          </div>
        </div>
        <button onClick={onDuzenle} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-white">
          ✎ Kalemleri düzenle
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase text-slate-500">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">İş / Kişi</th>
              <th className="px-3 py-2">Başlangıç</th>
              <th className="px-3 py-2">Bitiş</th>
              <th className="px-3 py-2 text-center">Onay</th>
              <th className="px-3 py-2 text-right">Alınan (₺)</th>
              <th className="px-3 py-2 text-center">Ödeme</th>
            </tr>
          </thead>
          <tbody>
            {kalemler.map((k, i) => {
              const onayli = k.durum === "tamam";
              return (
                <tr key={k.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className={`text-sm font-semibold ${onayli ? "text-slate-400 line-through" : "text-slate-800"}`}>{k.ad}</div>
                    {k.personelAd && <div className="text-[11px] text-slate-400">👤 {k.personelAd}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{k.baslangic || "—"}</td>
                  <td className="px-3 py-2">
                    {onayli ? (
                      <input type="date" value={k.bitis ?? ""}
                        onChange={(e) => { updateAsamaKalem(k.id, { bitis: e.target.value }); onYenile(); }}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500" />
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {onayli ? (
                      <button onClick={() => onayGeriAl(k)} title="Onayı geri al"
                        className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-200">✓ Onaylı</button>
                    ) : (
                      <button onClick={() => onayla(k)}
                        className="rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold text-white hover:bg-brand-600">Onayla</button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min="0" step="0.01" value={k.alinan ?? ""}
                      onChange={(e) => { updateAsamaKalem(k.id, { alinan: e.target.value === "" ? undefined : Number(e.target.value) }); onYenile(); }}
                      placeholder={k.fiyat ? String(k.fiyat) : "0"}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs text-slate-700 outline-none focus:border-brand-500" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => { updateAsamaKalem(k.id, { odendi: !k.odendi }); onYenile(); }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                        k.odendi ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      }`}>
                      {k.odendi ? "Ödendi" : "Bekliyor"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Personel seçici (ad/telefon ile ara → çağır) ────────── */

function PersonelPicker({
  personeller, seciliId, seciliAd, projeId, onSec,
}: {
  personeller: Personel[];
  seciliId?: string;
  seciliAd?: string;
  projeId: string;
  onSec: (p: Personel | null) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [ara, setAra] = useState("");

  const secili = personeller.find((p) => p.id === seciliId);
  const gosterilen = secili ? `${secili.ad} ${secili.soyad}`.trim() : seciliAd;

  const q = ara.trim().toLowerCase();
  const sonuc = q
    ? personeller.filter((p) =>
        `${p.ad} ${p.soyad}`.toLowerCase().includes(q) ||
        p.telefon.toLowerCase().includes(q) ||
        p.gorev.toLowerCase().includes(q) ||
        p.tc.includes(q),
      )
    : personeller;

  return (
    <div className="relative mt-0.5">
      <button type="button" onClick={() => setAcik((v) => !v)}
        className={`flex w-full items-center justify-between gap-1 rounded-lg border px-2 py-1 text-left text-xs outline-none transition ${
          gosterilen ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-400 hover:border-slate-300"
        }`}>
        <span className="truncate">{gosterilen || "Kişi seç…"}</span>
        <span className="shrink-0">{gosterilen ? "▾" : "🔍"}</span>
      </button>

      {acik && (
        <div className="absolute left-0 z-10 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <input autoFocus value={ara} onChange={(e) => setAra(e.target.value)}
            placeholder="Ad / telefon / görev ara…"
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500" />
          <div className="mt-1 max-h-44 overflow-y-auto">
            {gosterilen && (
              <button type="button" onClick={() => { onSec(null); setAcik(false); setAra(""); }}
                className="block w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-red-500 hover:bg-red-50">
                ✕ Seçimi kaldır
              </button>
            )}
            {personeller.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-slate-400">
                Kayıtlı personel yok.<br />
                <a href={`/panel/personel?proje=${projeId}`} className="font-semibold text-brand-600 hover:underline">Personel modülüne ekle →</a>
              </p>
            ) : sonuc.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-slate-400">Eşleşen kişi yok.</p>
            ) : (
              sonuc.map((p) => (
                <button key={p.id} type="button" onClick={() => { onSec(p); setAcik(false); setAra(""); }}
                  className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
                  <span className="block text-xs font-semibold text-slate-800">{p.ad} {p.soyad}</span>
                  <span className="block text-[10px] text-slate-400">{[p.gorev, p.telefon].filter(Boolean).join(" · ") || "—"}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
