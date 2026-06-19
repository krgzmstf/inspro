"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type Project,
  type ProjectType,
  TYPE_LABELS,
  loadProjects,
  getProject,
  updateProject,
  formatTL,
} from "@/lib/projects";
import {
  type Quality,
  type EstimateResult,
  QUALITY_LABELS,
  CITY_MULTIPLIERS,
  PRICE_DATA_DATE,
  estimateCost,
} from "@/lib/calc/maliyet";

const CITIES = Object.keys(CITY_MULTIPLIERS);

export default function MaliyetPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [area, setArea] = useState("");
  const [floors, setFloors] = useState("1");
  const [type, setType] = useState<ProjectType>("konut");
  const [quality, setQuality] = useState<Quality>("standart");
  const [city, setCity] = useState("İstanbul");

  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  // Projeleri yükle; URL'de ?proje=<id> varsa formu ondan doldur
  useEffect(() => {
    const list = loadProjects();
    setProjects(list);
    const id = new URLSearchParams(window.location.search).get("proje");
    if (id && list.some((p) => p.id === id)) fillFromProject(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fillFromProject(id: string) {
    const p = getProject(id);
    if (!p) return;
    setSelectedProjectId(id);
    setArea(String(p.area));
    setFloors(String(p.floors));
    setType(p.type);
    setCity(CITY_MULTIPLIERS[p.city] !== undefined ? p.city : "Diğer");
    setResult(null);
    setSavedMsg("");
  }

  function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSavedMsg("");
    try {
      setResult(
        estimateCost({
          area: parseFloat(area),
          floors: parseInt(floors) || 1,
          type,
          quality,
          city,
        }),
      );
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Hesaplama hatası.");
    }
  }

  function saveAsBudget() {
    if (!result || !selectedProjectId) return;
    const p = getProject(selectedProjectId);
    if (!p) return;
    updateProject({ ...p, budget: Math.round(result.totalAvg) });
    setSavedMsg(`✓ "${p.name}" projesinin bütçesi güncellendi.`);
  }

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-extrabold text-slate-900">
        💰 Hızlı Maliyet Tahmini
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        m² bazlı anahtar teslim yapım maliyeti — birim fiyat verisi:{" "}
        <b>{PRICE_DATA_DATE}</b>
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* ── Form ── */}
        <form
          onSubmit={handleCalculate}
          className="h-fit rounded-2xl border border-sky-200 bg-[#f2f8fd] p-6 shadow-sm"
        >
          {projects.length > 0 && (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Projeden doldur{" "}
                <span className="font-normal text-slate-400">— opsiyonel</span>
              </span>
              <select
                value={selectedProjectId}
                onChange={(e) =>
                  e.target.value
                    ? fillFromProject(e.target.value)
                    : setSelectedProjectId("")
                }
                className="mt-1.5 w-full rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-4 py-2.5 text-sm outline-none transition focus:border-brand-500"
              >
                <option value="">— Elle gireceğim —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-700">
              Toplam İnşaat Alanı (m²) *
            </span>
            <span className="block text-xs text-slate-400">
              Tüm katlar dahil brüt alan — kat sayısıyla tekrar çarpılmaz
            </span>
            <input
              type="number"
              min="1"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="ör: 2400"
              className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500"
            />
          </label>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Kat Sayısı
              </span>
              <input
                type="number"
                min="1"
                max="60"
                value={floors}
                onChange={(e) => setFloors(e.target.value)}
                className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Şehir</span>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1.5 w-full rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-4 py-2.5 text-sm outline-none transition focus:border-brand-500"
              >
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-700">Yapı Tipi</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_LABELS) as ProjectType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-xl border-2 px-2 py-2 text-xs font-bold transition ${
                    type === t
                      ? "border-brand-500 bg-brand-500/10 text-brand-600"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {TYPE_LABELS[t].split(" / ")[0]}
                </button>
              ))}
            </div>
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-700">
              Kalite Seviyesi
            </span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(Object.keys(QUALITY_LABELS) as Quality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`rounded-xl border-2 px-2 py-2 text-xs font-bold transition ${
                    quality === q
                      ? "border-brand-500 bg-brand-500/10 text-brand-600"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {QUALITY_LABELS[q]}
                </button>
              ))}
            </div>
          </label>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
          >
            📊 Maliyeti Hesapla
          </button>
        </form>

        {/* ── Sonuç ── */}
        <div>
          {!result ? (
            <div className="flex h-full min-h-72 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center">
              <div>
                <div className="text-4xl">📐</div>
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Bilgileri girip <b>Maliyeti Hesapla</b>&apos;ya basın
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Sonuçlar kalite, yapı tipi, şehir ve kat çarpanlarıyla hesaplanır
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Ana sonuç */}
              <div className="rounded-2xl bg-ink-950 p-6 text-white shadow-lg">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  Tahmini Toplam Maliyet
                </div>
                <div className="mt-1 text-3xl font-extrabold text-brand-400 sm:text-4xl">
                  {formatTL(result.totalAvg)}
                </div>
                <div className="mt-1 text-sm text-white/70">
                  Aralık: {formatTL(result.totalMin)} — {formatTL(result.totalMax)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["Birim Ortalama", `${formatTL(result.unitAvg)}/m²`],
                    [
                      "Birim Aralığı",
                      `${formatTL(result.unitMin)} — ${formatTL(result.unitMax)}`,
                    ],
                    [
                      "Çarpanlar",
                      `tip ×${result.multipliers.type} · şehir ×${result.multipliers.city} · kat ×${result.multipliers.floor.toFixed(3)}`,
                    ],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="text-[10px] text-white/50">{k}</div>
                      <div className="mt-0.5 text-xs font-bold leading-snug">
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedProject && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={saveAsBudget}
                      className="rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-brand-600"
                    >
                      💾 &quot;{selectedProject.name}&quot; bütçesi olarak kaydet
                    </button>
                    {savedMsg && (
                      <span className="text-xs font-semibold text-emerald-300">
                        {savedMsg}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Kalem dağılımı */}
              <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-6 shadow-sm">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
                  Maliyet Kalemi Dağılımı
                </h2>
                <div className="mt-4 space-y-3">
                  {result.breakdown.map((b) => (
                    <div key={b.name}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">
                          {b.name}
                        </span>
                        <span className="shrink-0 font-bold text-slate-900">
                          {formatTL(b.amount)}{" "}
                          <span className="text-xs font-semibold text-slate-400">
                            %{b.pct}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-ink-700 to-brand-500"
                          style={{ width: `${b.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                ⚠️ Bu hesaplama <b>ön fizibilite tahminidir</b>; arsa bedeli, zemin
                koşulları, proje detayı ve piyasa dalgalanmalarına göre değişir.
                Kesin maliyet için Keşif &amp; Metraj modülüyle poz bazlı hesap
                yapın ve profesyonel destek alın.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-sm">
        <Link
          href="/panel"
          className="font-semibold text-slate-500 transition hover:text-ink-800"
        >
          ← Projelere dön
        </Link>
      </div>
    </div>
  );
}
