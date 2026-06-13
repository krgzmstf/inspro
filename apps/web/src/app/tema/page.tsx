"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  THEME_STORAGE_KEY,
  applyThemeVars,
  type ThemeOverrides,
} from "@/components/ThemeVars";

/* ──────────────────────────────────────────────────────────
   insPRO Tema Ayar Ekranı (/tema)
   Renkleri canlı seçin; seçim tarayıcıya kaydedilir ve tüm
   sitede (ana sayfa dahil) otomatik uygulanır.
   ────────────────────────────────────────────────────────── */

const TOKENS: { var: string; label: string; desc: string; default: string }[] =
  [
    {
      var: "--color-ink-950",
      label: "Mavi — En Koyu",
      desc: "Üst menü, hero ve footer zemini",
      default: "#126b85",
    },
    {
      var: "--color-ink-900",
      label: "Mavi — Koyu",
      desc: "Kart zeminleri, başlık metinleri",
      default: "#17809e",
    },
    {
      var: "--color-ink-800",
      label: "Mavi — Orta",
      desc: "İkincil zeminler",
      default: "#1e96b8",
    },
    {
      var: "--color-ink-700",
      label: "Mavi — Açık",
      desc: "Vurgu zeminleri, degradeler",
      default: "#28abd1",
    },
    {
      var: "--color-brand-400",
      label: "Sarı — Açık",
      desc: "Rozetler, ikincil vurgular",
      default: "#fcd34d",
    },
    {
      var: "--color-brand-500",
      label: "Sarı — Ana",
      desc: "Butonlar, ana vurgu rengi",
      default: "#f5b80b",
    },
    {
      var: "--color-brand-600",
      label: "Sarı — Koyu",
      desc: "Buton hover durumu",
      default: "#d99e06",
    },
  ];

const DEFAULTS: ThemeOverrides = Object.fromEntries(
  TOKENS.map((t) => [t.var, t.default]),
);

export default function TemaPage() {
  const [colors, setColors] = useState<ThemeOverrides>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  // Kayıtlı temayı yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) {
        const parsed = { ...DEFAULTS, ...JSON.parse(saved) };
        setColors(parsed);
        applyThemeVars(parsed);
      }
    } catch {
      /* yoksay */
    }
  }, []);

  function setColor(name: string, value: string) {
    const next = { ...colors, [name]: value };
    setColors(next);
    applyThemeVars(next);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
  }

  function reset() {
    setColors(DEFAULTS);
    applyThemeVars(DEFAULTS);
    localStorage.removeItem(THEME_STORAGE_KEY);
  }

  async function copyCss() {
    const css = TOKENS.map((t) => `  ${t.var}: ${colors[t.var]};`).join("\n");
    await navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-20">
      {/* Üst bar */}
      <header className="bg-ink-950 text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-xl font-extrabold">
            ins<span className="text-brand-500">PRO</span>{" "}
            <span className="ml-2 text-sm font-medium text-white/70">
              Tema Ayarları
            </span>
          </span>
          <Link
            href="/"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            ← Ana Sayfaya Dön
          </Link>
        </div>
      </header>

      <div className="mx-auto mt-10 grid max-w-5xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_360px]">
        {/* Renk seçiciler */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Marka renklerini ayarlayın
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Bir renge tıklayıp seçin — değişiklik anında bu sayfaya ve ana
            sayfaya uygulanır, tarayıcınıza kaydedilir. Beğendiğiniz
            kombinasyonu bana söyleyin (veya CSS&apos;i kopyalayıp gönderin),
            kalıcı hale getireyim.
          </p>

          <div className="mt-6 space-y-3">
            {TOKENS.map((t) => (
              <div
                key={t.var}
                className="flex items-center gap-4 rounded-xl border border-slate-200 p-3"
              >
                <input
                  type="color"
                  value={colors[t.var]}
                  onChange={(e) => setColor(t.var, e.target.value)}
                  className="h-12 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                  aria-label={t.label}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">{t.label}</div>
                  <div className="truncate text-xs text-slate-500">
                    {t.desc}
                  </div>
                </div>
                <code className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  {colors[t.var]}
                </code>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={copyCss}
              className="rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800"
            >
              {copied ? "✓ Kopyalandı!" : "CSS'i Kopyala"}
            </button>
            <button
              onClick={reset}
              className="rounded-xl border-2 border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Varsayılana Dön
            </button>
          </div>
        </section>

        {/* Canlı önizleme */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Canlı Önizleme
          </h2>

          {/* mini hero */}
          <div className="overflow-hidden rounded-2xl shadow-md">
            <div className="bg-ink-950 p-5 text-white">
              <span className="inline-block rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-[10px] font-semibold text-brand-400">
                Yapay zeka destekli
              </span>
              <h3 className="mt-3 text-xl font-extrabold leading-snug">
                İnşaatın <span className="text-brand-500">tüm süreçleri</span>,
                tek platformda.
              </h3>
              <div className="mt-4 flex gap-2">
                <span className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-white">
                  Ücretsiz Başla →
                </span>
                <span className="rounded-lg border border-white/25 px-4 py-2 text-xs font-semibold">
                  Nasıl çalışır?
                </span>
              </div>
            </div>
          </div>

          {/* mini panel kartı */}
          <div className="rounded-2xl bg-ink-900 p-4 text-white shadow-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Gökkuşağı Konutları</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">
                %62
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-brand-500 to-yellow-300" />
            </div>
            <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/10 p-2 text-[11px]">
              <span className="font-bold text-brand-400">🧠 AI:</span> Don
              bekleniyor, betonu erteleyin.
            </div>
          </div>

          {/* mini açık kart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-900 text-lg">
              📏
            </div>
            <div className="mt-2 text-sm font-bold text-ink-900">
              Keşif &amp; Metraj
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Plandan otomatik metraj taslağı çıkar.
            </p>
          </div>

          {/* renk şeridi */}
          <div className="flex overflow-hidden rounded-xl shadow-sm">
            {TOKENS.map((t) => (
              <div
                key={t.var}
                className="h-10 flex-1"
                style={{ backgroundColor: colors[t.var] }}
                title={`${t.label}: ${colors[t.var]}`}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
