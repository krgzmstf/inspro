"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Project, loadProjects, getProject, formatTL } from "@/lib/projects";
import { loadMuhasebe } from "@/lib/muhasebe";
import { loadSaha } from "@/lib/saha";
import { loadIsSurecleri } from "@/lib/isSurecleri";
import {
  type RiskRapor, type RiskGirdi,
  mkAiRiskAnaliz, riskRenk, skorRenk, riskOzetMetni, SEVIYE_LABEL, KATEGORI_LABEL,
} from "@/lib/mkAi";
import { mkAiProjeDosyasi } from "@/lib/mkAiDosya";
import { pollinationsUrl } from "@/lib/gorsel";

interface AiYorum { yorum: string; oneriler: string[]; demoMode: boolean; saglayici: string | null; guven: number | null }

const SAGLAYICI_ETIKET: Record<string, string> = {
  groq: "Groq", gemini: "Gemini", deepseek: "DeepSeek", github: "GitHub Models",
};

export default function MkAiPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [girdi, setGirdi] = useState<RiskGirdi | null>(null);
  const [rapor, setRapor] = useState<RiskRapor | null>(null);
  const [ai, setAi] = useState<AiYorum | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [mesajlar, setMesajlar] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [soru, setSoru] = useState("");
  const [sohbetYukleniyor, setSohbetYukleniyor] = useState(false);
  const [sohbetSaglayici, setSohbetSaglayici] = useState<string | null>(null);
  const [gorselIstek, setGorselIstek] = useState("");
  const [gorselUrl, setGorselUrl] = useState("");
  const [gorselPrompt, setGorselPrompt] = useState("");
  const [gorselYukleniyor, setGorselYukleniyor] = useState(false);
  const [imgYukleniyor, setImgYukleniyor] = useState(false);
  const [gorselHata, setGorselHata] = useState("");

  useEffect(() => {
    const ps = loadProjects();
    setProjects(ps);
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && ps.some((p) => p.id === id) ? id : (ps[0]?.id ?? "");
    if (initial) seçProje(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seçProje(id: string) {
    setProjectId(id);
    setAi(null);
    setHata("");
    const project = getProject(id);
    if (!project) { setGirdi(null); setRapor(null); return; }
    const g: RiskGirdi = {
      project,
      muhasebe: loadMuhasebe(id),
      saha: loadSaha(id),
      isKalemleri: loadIsSurecleri(id),
    };
    setGirdi(g);
    setRapor(mkAiRiskAnaliz(g));
  }

  const proje = useMemo(() => (projectId ? getProject(projectId) : undefined), [projectId]);

  async function aiYorumAl() {
    if (!girdi || !rapor) return;
    setYukleniyor(true); setHata(""); setAi(null);
    try {
      const res = await fetch("/api/mk-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ozet: riskOzetMetni(girdi, rapor), skor: rapor.skor, seviye: rapor.seviye }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek başarısız.");
      setAi({
        yorum: data.yorum ?? "",
        oneriler: data.oneriler ?? [],
        demoMode: !!data.demoMode,
        saglayici: data.saglayici ?? null,
        guven: typeof data.guven === "number" ? data.guven : null,
      });
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setYukleniyor(false);
    }
  }

  async function soruGonder(e: React.FormEvent) {
    e.preventDefault();
    const q = soru.trim();
    if (!q || sohbetYukleniyor) return;
    const yeni = [...mesajlar, { role: "user" as const, content: q }];
    setMesajlar(yeni);
    setSoru("");
    setSohbetYukleniyor(true);
    try {
      const dosya = projectId ? mkAiProjeDosyasi(projectId) : "";
      const riskOzet = girdi && rapor ? riskOzetMetni(girdi, rapor) : "";
      const baglam = [dosya, riskOzet && `## RİSK ANALİZİ (kural motoru)\n${riskOzet}`]
        .filter(Boolean)
        .join("\n\n") || undefined;
      const res = await fetch("/api/mk-ai/sohbet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: yeni, baglam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek başarısız.");
      setSohbetSaglayici(data.saglayici ?? null);
      setMesajlar([...yeni, { role: "assistant", content: data.text ?? "" }]);
    } catch (err) {
      setMesajlar([...yeni, { role: "assistant", content: "⚠️ " + (err as Error).message }]);
    } finally {
      setSohbetYukleniyor(false);
    }
  }

  async function gorselUret() {
    if (gorselYukleniyor) return;
    setGorselYukleniyor(true);
    setGorselHata("");
    setGorselUrl("");
    try {
      const dosya = projectId ? mkAiProjeDosyasi(projectId) : "";
      const res = await fetch("/api/mk-ai/gorsel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baglam: dosya, istek: gorselIstek }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek başarısız.");
      setGorselPrompt(data.prompt ?? "");
      setImgYukleniyor(true);
      setGorselUrl(pollinationsUrl(data.prompt ?? "", { seed: Math.floor(Math.random() * 1_000_000) }));
    } catch (e) {
      setGorselHata((e as Error).message);
    } finally {
      setGorselYukleniyor(false);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <Baslik />
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🏗️</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Önce bir proje gerekli</h3>
          <Link href="/panel/yeni" className="mt-5 inline-block rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">+ Proje Oluştur</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Baslik />
        <select value={projectId} onChange={(e) => seçProje(e.target.value)}
          className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {rapor && (
        <>
          {/* Skor + özet */}
          <div className="mt-6 grid gap-5 sm:grid-cols-[200px_1fr]">
            <Gosterge rapor={rapor} />
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-lg px-2.5 py-1 text-xs font-extrabold text-white" style={{ background: riskRenk(rapor.seviye) }}>
                  {SEVIYE_LABEL[rapor.seviye].toUpperCase()} RİSK
                </span>
                <span className="text-xs text-slate-400">{proje?.name}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{rapor.ozet}</p>
              <button onClick={aiYorumAl} disabled={yukleniyor}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-50">
                {yukleniyor ? "🤖 mk_ai düşünüyor…" : "🤖 mk_ai yorumu al"}
              </button>
              {hata && <p className="mt-2 text-xs font-semibold text-red-600">{hata}</p>}
            </div>
          </div>

          {/* Kategori skorları */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rapor.kategoriler.map((k) => (
              <div key={k.kategori} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-500">{KATEGORI_LABEL[k.kategori]}</span>
                  <span className="text-sm font-extrabold" style={{ color: skorRenk(k.skor) }}>{k.skor}</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${k.skor}%`, background: skorRenk(k.skor) }} />
                </div>
              </div>
            ))}
          </div>

          {/* Projeksiyon (EVM + takvim) */}
          {(rapor.projeksiyon.nihaiMaliyet || rapor.projeksiyon.tahminiBitis || rapor.projeksiyon.yakmaHizi) && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-900">📈 Projeksiyon</h2>
              <p className="mt-0.5 text-xs text-slate-400">Mevcut ilerleme ve harcama hızına göre tahmin (EVM mantığı).</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {rapor.projeksiyon.nihaiMaliyet !== undefined && (
                  <Kutu l="Tahmini nihai maliyet (EAC)" v={formatTL(rapor.projeksiyon.nihaiMaliyet)}
                    alt={rapor.projeksiyon.butceAsimYuzde !== undefined ? `bütçe sapması %${Math.round(rapor.projeksiyon.butceAsimYuzde)}` : undefined}
                    renk={rapor.projeksiyon.butceAsimYuzde !== undefined && rapor.projeksiyon.butceAsimYuzde > 5 ? "#dc2626" : "#16a34a"} />
                )}
                {rapor.projeksiyon.cpi !== undefined && (
                  <Kutu l="Maliyet performansı (CPI)" v={rapor.projeksiyon.cpi.toFixed(2)}
                    alt={rapor.projeksiyon.cpi >= 1 ? "hedefte/altında" : "bütçe üstü"}
                    renk={rapor.projeksiyon.cpi >= 1 ? "#16a34a" : "#dc2626"} />
                )}
                {rapor.projeksiyon.tahminiBitis && (
                  <Kutu l="Tahmini bitiş" v={rapor.projeksiyon.tahminiBitis}
                    alt={rapor.projeksiyon.gecikmeGun ? `${rapor.projeksiyon.gecikmeGun > 0 ? "+" : ""}${rapor.projeksiyon.gecikmeGun} gün` : undefined}
                    renk={(rapor.projeksiyon.gecikmeGun ?? 0) > 7 ? "#dc2626" : "#16a34a"} />
                )}
                {rapor.projeksiyon.yakmaHizi !== undefined && rapor.projeksiyon.yakmaHizi > 0 && (
                  <Kutu l="Harcama hızı" v={`${formatTL(rapor.projeksiyon.yakmaHizi)}/gün`} alt="son 30 gün" renk="#0f172a" />
                )}
              </div>
            </div>
          )}

          {/* AI yorumu */}
          {ai && (
            <div className="mt-5 rounded-2xl border-2 border-ink-900/15 bg-gradient-to-br from-ink-900 to-ink-800 p-5 text-white shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h3 className="text-sm font-extrabold">mk_ai Değerlendirmesi</h3>
                {ai.demoMode && <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-amber-950">DEMO — anahtar yok</span>}
                {!ai.demoMode && ai.saglayici && (
                  <span className="rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-bold text-emerald-950">
                    {SAGLAYICI_ETIKET[ai.saglayici] ?? ai.saglayici}
                  </span>
                )}
                {!ai.demoMode && ai.guven != null && (
                  <span
                    className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white/90"
                    title="mk_ai'nin veri yeterliliğine göre bu değerlendirmeye güveni"
                  >
                    güven %{Math.round(ai.guven * 100)}
                  </span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{ai.yorum}</p>
              {ai.oneriler.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {ai.oneriler.map((o, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/90"><span className="text-brand-500">▸</span>{o}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* mk_ai sohbet */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">💬</span>
              <h3 className="text-sm font-extrabold text-slate-800">mk_ai&apos;ye Sor</h3>
              {sohbetSaglayici && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  {SAGLAYICI_ETIKET[sohbetSaglayici] ?? sohbetSaglayici}
                </span>
              )}
            </div>

            {mesajlar.length === 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Bu proje hakkında soru sor: <em>&quot;En büyük risk ne?&quot;</em>, <em>&quot;Bütçeyi nasıl
                toparlarım?&quot;</em>, <em>&quot;Hangi işe öncelik vermeliyim?&quot;</em>
              </p>
            ) : (
              <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
                {mesajlar.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                    <div
                      className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user" ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ))}
                {sohbetYukleniyor && <div className="text-xs text-slate-400">mk_ai yazıyor…</div>}
              </div>
            )}

            <form onSubmit={soruGonder} className="mt-3 flex gap-2">
              <input
                value={soru}
                onChange={(e) => setSoru(e.target.value)}
                placeholder="mk_ai'ye bir soru yaz…"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink-900"
              />
              <button
                type="submit"
                disabled={sohbetYukleniyor || !soru.trim()}
                className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Gönder
              </button>
            </form>
          </div>

          {/* mk_ai görsel üretimi */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <h3 className="text-sm font-extrabold text-slate-800">mk_ai Görsel Üret</h3>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">ücretsiz</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              mk_ai proje verisinden fotogerçekçi bir mimari render üretir. İstersen tarz belirt (ör.
              &quot;gece, modern cephe&quot;, &quot;kuş bakışı site&quot;).
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={gorselIstek}
                onChange={(e) => setGorselIstek(e.target.value)}
                placeholder="(opsiyonel) nasıl bir görsel istersin…"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink-900"
              />
              <button
                type="button"
                onClick={gorselUret}
                disabled={gorselYukleniyor}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {gorselYukleniyor ? "Hazırlanıyor…" : "🎨 Üret"}
              </button>
            </div>
            {gorselHata && <p className="mt-2 text-xs font-semibold text-rose-600">⚠️ {gorselHata}</p>}
            {gorselUrl && (
              <div className="mt-3">
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {imgYukleniyor && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                      mk_ai görseli çiziyor… (birkaç saniye)
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gorselUrl}
                    alt="mk_ai proje görseli"
                    className="aspect-video w-full object-cover"
                    onLoad={() => setImgYukleniyor(false)}
                    onError={() => {
                      setImgYukleniyor(false);
                      setGorselHata("Görsel yüklenemedi, tekrar deneyin.");
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {gorselPrompt && <p className="truncate text-[11px] italic text-slate-400" title={gorselPrompt}>{gorselPrompt}</p>}
                  <a href={gorselUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] font-bold text-violet-600 hover:underline">
                    Tam boyut ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Risk faktörleri */}
          <h2 className="mt-7 text-sm font-extrabold uppercase text-slate-500">Risk Faktörleri ({rapor.faktorler.length})</h2>
          {rapor.faktorler.length === 0 ? (
            <div className="mt-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-700">
              ✓ Belirgin risk yok. Veri girişi arttıkça mk_ai daha isabetli analiz eder.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {rapor.faktorler.map((f) => (
                <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: riskRenk(f.seviye) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{f.baslik}</h3>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: riskRenk(f.seviye) }}>{SEVIYE_LABEL[f.seviye]}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{f.detay}</p>
                      <p className="mt-1.5 text-sm text-ink-800"><span className="font-semibold">Öneri:</span> {f.oneri}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Güvenli alanlar */}
          {rapor.guvenli.length > 0 && (
            <>
              <h2 className="mt-7 text-sm font-extrabold uppercase text-slate-500">Sağlıklı Alanlar</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {rapor.guvenli.map((g, i) => (
                  <div key={i} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <span className="font-bold text-emerald-700">✓ {g.baslik}</span>
                    <span className="text-emerald-600"> — {g.detay}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="mt-6 text-[11px] text-slate-400">
            mk_ai; muhasebe, saha takibi ve iş süreçleri verinizi analiz eder. Veriler ne kadar güncelse analiz o kadar isabetli olur.
          </p>
        </>
      )}

      <div className="mt-6 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}

function Kutu({ l, v, alt, renk }: { l: string; v: string; alt?: string; renk: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold text-slate-500">{l}</div>
      <div className="mt-1 text-base font-extrabold" style={{ color: renk }}>{v}</div>
      {alt && <div className="text-[11px] text-slate-400">{alt}</div>}
    </div>
  );
}

function Baslik() {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
        🤖 mk_ai <span className="rounded-lg bg-ink-900 px-2 py-0.5 text-xs font-bold text-brand-500">Risk Asistanı</span>
      </h1>
      <p className="mt-1 text-sm text-slate-500">Proje verinizden otomatik risk skoru, faktör analizi ve öneriler.</p>
    </div>
  );
}

function Gosterge({ rapor }: { rapor: RiskRapor }) {
  const renk = riskRenk(rapor.seviye);
  const r = 52;
  const cevre = 2 * Math.PI * r;
  const dolu = (rapor.skor / 100) * cevre;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#eef2f6" strokeWidth="14" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={renk} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${dolu} ${cevre}`} transform="rotate(-90 70 70)" />
        <text x="70" y="64" textAnchor="middle" fontSize="34" fontWeight="800" fill={renk}>{rapor.skor}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="11" fill="#94a3b8">/ 100 risk</text>
      </svg>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide" style={{ color: renk }}>{SEVIYE_LABEL[rapor.seviye]} seviye</div>
    </div>
  );
}
