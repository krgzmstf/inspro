"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { loadBilgiler } from "@/lib/bilgiTabani";
import {
  type Tespit, type YerelCevap,
  mkAiSorgu, mkAiTespitler, uygulaTespit,
} from "@/lib/mkAiYerel";
import { pollinationsUrl } from "@/lib/gorsel";

interface AiYorum { yorum: string; oneriler: string[]; demoMode: boolean; saglayici: string | null; guven: number | null }
interface Kaynak { id: string; baslik: string; kaynak: string }
interface Mesaj { role: "user" | "assistant"; content: string; kaynaklar?: Kaynak[]; demo?: boolean }

const SAGLAYICI_ETIKET: Record<string, string> = {
  groq: "Groq", gemini: "Gemini", deepseek: "DeepSeek", github: "GitHub Models",
};

const HIZLI_SORULAR = [
  "Bu projedeki en büyük risk ne, nasıl kapatırım?",
  "Ön bahçe çekme mesafesi ne kadar olmalı?",
  "Betonarmede pas payı kaç mm olmalı?",
  "Otopark sayısı nasıl hesaplanır?",
];

export default function MkAiPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [girdi, setGirdi] = useState<RiskGirdi | null>(null);
  const [rapor, setRapor] = useState<RiskRapor | null>(null);
  const [ai, setAi] = useState<AiYorum | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [soru, setSoru] = useState("");
  const [sohbetYukleniyor, setSohbetYukleniyor] = useState(false);
  const [sohbetSaglayici, setSohbetSaglayici] = useState<string | null>(null);
  const sohbetSonuRef = useRef<HTMLDivElement>(null);
  const [gorselIstek, setGorselIstek] = useState("");
  const [gorselUrl, setGorselUrl] = useState("");
  const [gorselPrompt, setGorselPrompt] = useState("");
  const [gorselYukleniyor, setGorselYukleniyor] = useState(false);
  const [imgYukleniyor, setImgYukleniyor] = useState(false);
  const [gorselHata, setGorselHata] = useState("");
  const [yuklenenGorsel, setYuklenenGorsel] = useState<{ dataUrl: string; mime: string } | null>(null);
  const [gorselMotor, setGorselMotor] = useState<string | null>(null);
  const dosyaRef = useRef<HTMLInputElement>(null);
  // Yerel asistan (AI'sız)
  const [yerelSoru, setYerelSoru] = useState("");
  const [yerelGecmis, setYerelGecmis] = useState<(YerelCevap & { soru: string })[]>([]);
  const [tespitler, setTespitler] = useState<Tespit[]>([]);
  const [duzeltId, setDuzeltId] = useState<string | null>(null);
  const [duzeltMesaj, setDuzeltMesaj] = useState("");

  useEffect(() => {
    const ps = loadProjects();
    setProjects(ps);
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && ps.some((p) => p.id === id) ? id : (ps[0]?.id ?? "");
    if (initial) seçProje(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Yeni mesaj geldikçe sohbeti en alta kaydır.
  useEffect(() => {
    sohbetSonuRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mesajlar, sohbetYukleniyor]);

  function seçProje(id: string) {
    setProjectId(id);
    setAi(null);
    setHata("");
    // Proje değişince sohbet ve görsel önceki projeye aitti → temizle.
    setMesajlar([]);
    setSohbetSaglayici(null);
    setGorselUrl("");
    setGorselPrompt("");
    setGorselHata("");
    setYuklenenGorsel(null);
    setGorselMotor(null);
    setYerelGecmis([]);
    setYerelSoru("");
    setDuzeltMesaj("");
    const project = getProject(id);
    if (!project) { setGirdi(null); setRapor(null); setTespitler([]); return; }
    const g: RiskGirdi = {
      project,
      muhasebe: loadMuhasebe(id),
      saha: loadSaha(id),
      isKalemleri: loadIsSurecleri(id),
    };
    setGirdi(g);
    setRapor(mkAiRiskAnaliz(g));
    setTespitler(mkAiTespitler(id));
  }

  function yerelSorgula(q: string) {
    if (!q.trim() || !projectId) return;
    const cevap = mkAiSorgu(projectId, q.trim());
    setYerelGecmis((g) => [...g, { soru: q.trim(), ...cevap }]);
    setYerelSoru("");
  }

  async function duzelt(id: string) {
    if (!projectId || duzeltId) return;
    setDuzeltId(id);
    setDuzeltMesaj("");
    try {
      const sonuc = await uygulaTespit(projectId, id);
      setDuzeltMesaj((sonuc.ok ? "✓ " : "⚠️ ") + sonuc.mesaj);
      // Düzeltme veriyi değiştirdi → analizi ve tespitleri tazele
      const project = getProject(projectId);
      if (project) {
        const g: RiskGirdi = { project, muhasebe: loadMuhasebe(projectId), saha: loadSaha(projectId), isKalemleri: loadIsSurecleri(projectId) };
        setGirdi(g);
        setRapor(mkAiRiskAnaliz(g));
      }
      setTespitler(mkAiTespitler(projectId));
    } catch (e) {
      setDuzeltMesaj("⚠️ " + (e as Error).message);
    } finally {
      setDuzeltId(null);
    }
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

  async function soruySor(q: string) {
    if (!q.trim() || sohbetYukleniyor) return;
    const yeni: Mesaj[] = [...mesajlar, { role: "user", content: q.trim() }];
    setMesajlar(yeni);
    setSoru("");
    setSohbetYukleniyor(true);
    try {
      const dosya = projectId ? mkAiProjeDosyasi(projectId) : "";
      const riskOzet = girdi && rapor ? riskOzetMetni(girdi, rapor) : "";
      const baglam = [dosya, riskOzet && `## RİSK ANALİZİ (kural motoru)\n${riskOzet}`]
        .filter(Boolean)
        .join("\n\n") || undefined;
      // Agentic uç: mk_ai gerekirse yönetmelik aracını çağırır, kaynak getirir.
      const res = await fetch("/api/mk-ai/danis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: yeni, baglam, ekBilgi: loadBilgiler() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek başarısız.");
      setSohbetSaglayici(data.saglayici ?? null);
      setMesajlar([
        ...yeni,
        { role: "assistant", content: data.text ?? "", kaynaklar: data.kaynaklar ?? [], demo: !!data.demoMode },
      ]);
    } catch (err) {
      setMesajlar([...yeni, { role: "assistant", content: "⚠️ " + (err as Error).message }]);
    } finally {
      setSohbetYukleniyor(false);
    }
  }

  function soruGonder(e: React.FormEvent) {
    e.preventDefault();
    soruySor(soru);
  }

  function dosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setGorselHata("Lütfen bir görsel dosyası seçin."); return; }
    if (f.size > 8 * 1024 * 1024) { setGorselHata("Görsel 8 MB'tan küçük olmalı."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setYuklenenGorsel({ dataUrl: String(reader.result), mime: f.type });
      setGorselHata("");
    };
    reader.readAsDataURL(f);
  }

  async function gorselUret() {
    if (gorselYukleniyor) return;
    setGorselYukleniyor(true);
    setGorselHata("");
    setGorselUrl("");
    setGorselMotor(null);
    try {
      const dosya = projectId ? mkAiProjeDosyasi(projectId) : "";
      // 1) İngilizce prompt üret (proje verisi + istek). Yükleme varsa düzenleme ipucu ekle.
      const ekIstek = yuklenenGorsel
        ? `${gorselIstek ? gorselIstek + ". " : ""}Use the provided image as the base; transform it into a clean photorealistic architectural render while keeping its overall composition.`
        : gorselIstek;
      const res = await fetch("/api/mk-ai/gorsel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baglam: dosya, istek: ekIstek }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek başarısız.");
      const prompt = data.prompt ?? "";
      setGorselPrompt(prompt);

      // 2) Önce Gemini (Nano Banana) dene — hem üretir hem yüklenen görseli düzenler.
      const gRes = await fetch("/api/mk-ai/gorsel-uret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          gorselBase64: yuklenenGorsel?.dataUrl,
          mimeType: yuklenenGorsel?.mime,
        }),
      });
      const gData = await gRes.json();
      if (gData.yapildi && gData.dataUrl) {
        setImgYukleniyor(false);
        const etiket = gData.saglayici === "huggingface"
          ? "Hugging Face"
          : gData.saglayici === "gemini"
          ? "Gemini (Nano Banana)"
          : (gData.saglayici ?? "AI");
        setGorselMotor(gData.not ? `${etiket} — ${gData.not}` : yuklenenGorsel ? `${etiket} — görsel dönüştürüldü` : etiket);
        setGorselUrl(gData.dataUrl);
        return;
      }

      // 3) Yedek: Pollinations (anahtarsız). Not: yüklenen görseli kullanamaz.
      setImgYukleniyor(true);
      setGorselMotor(yuklenenGorsel ? "Pollinations (yedek — yüklenen görsel kullanılamadı)" : "Pollinations (yedek)");
      setGorselUrl(pollinationsUrl(prompt, { seed: Math.floor(Math.random() * 1_000_000) }));
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mk-ai-logo.jpg" alt="mk" className="h-5 w-auto rounded" />
                {yukleniyor ? "mk_ai düşünüyor…" : "mk_ai yorumu al"}
              </button>
              {hata && <p className="mt-2 text-xs font-semibold text-red-600">{hata}</p>}
            </div>
          </div>

          {/* Yerel Asistan (AI'sız) — anında, çevrimdışı */}
          <div className="mt-5 rounded-2xl border-2 border-ink-900/15 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg">🧠</span>
              <h3 className="text-sm font-extrabold text-slate-800">Yerel Asistan</h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700" title="Hiçbir yapay zeka servisine bağlanmaz; tüm modül verinizi yerel kurallarla analiz eder">
                AI'sız · anında · çevrimdışı
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Tüm modülleri (bütçe, nakit, takvim, saha, personel, yol haritası kalemleri) birleştirip yanıtlar.
              Anahtar yok, internet yok — sadece sizin verileriniz.
            </p>

            {/* Soru-cevap geçmişi */}
            {yerelGecmis.length > 0 && (
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {yerelGecmis.map((m, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-bold text-ink-900">› {m.soru}</div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-emerald-600">{m.baslik}</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{m.cevap}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Hızlı sorular */}
            <div className="mt-3 flex flex-wrap gap-2">
              {["Bütçe ne durumda?", "Bekleyen ödeme var mı?", "Gecikme var mı?", "En büyük risk ne?", "Kaç kişi çalışıyor?", "Yol haritası kalemleri ne durumda?"].map((q) => (
                <button key={q} onClick={() => yerelSorgula(q)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-ink-900 hover:text-ink-900">
                  {q}
                </button>
              ))}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); yerelSorgula(yerelSoru); }} className="mt-3 flex gap-2">
              <input value={yerelSoru} onChange={(e) => setYerelSoru(e.target.value)}
                placeholder="Projeyle ilgili sor (yerel, anında)…"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink-900" />
              <button type="submit" disabled={!yerelSoru.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                Sor
              </button>
            </form>

            {/* Tespitler & otomatik düzeltmeler */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">🔧 Tespitler & Otomatik Düzeltmeler</h4>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{tespitler.length}</span>
              </div>
              {duzeltMesaj && (
                <p className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${duzeltMesaj.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{duzeltMesaj}</p>
              )}
              {tespitler.length === 0 ? (
                <p className="mt-2 text-sm text-emerald-600">✓ Modüller arası tutarsızlık veya bekleyen entegrasyon yok.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {tespitler.map((t) => {
                    const renk = t.tur === "uyari" ? "border-amber-200 bg-amber-50" : t.tur === "firsat" ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50";
                    return (
                      <div key={t.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${renk}`}>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-800">{t.baslik}</div>
                          <p className="text-xs text-slate-600">{t.aciklama}</p>
                        </div>
                        {t.duzeltme && (
                          <button onClick={() => duzelt(t.id)} disabled={duzeltId !== null}
                            className="shrink-0 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-ink-800 disabled:opacity-50">
                            {duzeltId === t.id ? "Uygulanıyor…" : `🔧 ${t.duzeltme}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mk-ai-logo.jpg" alt="mk_ai" className="h-6 w-auto rounded" />
                <h3 className="text-sm font-extrabold">Değerlendirmesi</h3>
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

          {/* mk_ai sohbet (agentic — yönetmelik aracı + RAG) */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg">💬</span>
              <h3 className="text-sm font-extrabold text-slate-800">mk&apos;ye Sor</h3>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700" title="Gerektiğinde Türk inşaat mevzuatı bilgi tabanında arama yapıp kaynak gösterir">
                📚 mevzuat destekli
              </span>
              {sohbetSaglayici && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  {SAGLAYICI_ETIKET[sohbetSaglayici] ?? sohbetSaglayici}
                </span>
              )}
              {mesajlar.length > 0 && (
                <button
                  onClick={() => { setMesajlar([]); setSohbetSaglayici(null); }}
                  className="ml-auto text-[11px] font-semibold text-slate-400 transition hover:text-rose-500"
                >
                  Sohbeti temizle
                </button>
              )}
            </div>

            {mesajlar.length === 0 ? (
              <div className="mt-2">
                <p className="text-xs leading-relaxed text-slate-500">
                  Proje verisi <em>veya</em> mevzuat sor; mk_ai gerektiğinde yönetmelik bilgi tabanında arar ve kaynak gösterir.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {HIZLI_SORULAR.map((q) => (
                    <button
                      key={q}
                      onClick={() => soruySor(q)}
                      disabled={sohbetYukleniyor}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-ink-900 hover:text-ink-900 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
                {mesajlar.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                    <div
                      className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user" ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      {m.kaynaklar && m.kaynaklar.length > 0 && (
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">📚 Kaynaklar</div>
                          <ul className="mt-1 space-y-0.5">
                            {m.kaynaklar.map((k) => (
                              <li key={k.id} className="text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-700">{k.baslik}</span> — {k.kaynak}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {m.demo && (
                        <div className="mt-1.5 text-[10px] font-bold text-amber-600">DEMO — AI anahtarı yok</div>
                      )}
                    </div>
                  </div>
                ))}
                {sohbetYukleniyor && <div className="text-xs text-slate-400">mk_ai düşünüyor… (gerekirse mevzuat aranıyor)</div>}
                <div ref={sohbetSonuRef} />
              </div>
            )}

            <form onSubmit={soruGonder} className="mt-3 flex gap-2">
              <input
                value={soru}
                onChange={(e) => setSoru(e.target.value)}
                placeholder="mk'ye bir soru yaz… (proje veya mevzuat)"
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
            <p className="mt-2 text-[10px] text-slate-400">
              ⚠️ Mevzuat özetleri bilgilendirme amaçlıdır; uygulamadan önce resmî güncel metinle (mevzuat.gov.tr / ÇŞB) teyit edin.
            </p>
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
              &quot;gece, modern cephe&quot;, &quot;kuş bakışı site&quot;). <strong>Bir eskiz/fotoğraf yükle</strong> →
              mk_ai onu render&apos;a dönüştürür (Gemini ile).
            </p>

            {/* Görsel yükleme (referans / düzenleme) */}
            <input ref={dosyaRef} type="file" accept="image/*" onChange={dosyaSec} className="hidden" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => dosyaRef.current?.click()}
                disabled={gorselYukleniyor}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-500 hover:text-violet-700 disabled:opacity-50"
              >
                ⬆️ Görsel Yükle
              </button>
              {yuklenenGorsel && (
                <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 py-1 pl-1 pr-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={yuklenenGorsel.dataUrl} alt="referans" className="h-9 w-9 rounded-lg object-cover" />
                  <span className="text-[11px] font-semibold text-violet-700">referans yüklendi</span>
                  <button
                    type="button"
                    onClick={() => { setYuklenenGorsel(null); if (dosyaRef.current) dosyaRef.current.value = ""; }}
                    className="text-violet-400 transition hover:text-rose-500"
                    title="Kaldır"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

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
                {gorselYukleniyor ? "Hazırlanıyor…" : yuklenenGorsel ? "🎨 Dönüştür" : "🎨 Üret"}
              </button>
            </div>
            {gorselMotor && <p className="mt-2 text-[11px] font-semibold text-slate-400">Motor: {gorselMotor}</p>}
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
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mk-ai-logo.jpg"
          alt="MK_AI"
          className="h-12 w-auto rounded-lg shadow-sm sm:h-14"
        />
        <span className="rounded-lg bg-ink-900 px-2 py-0.5 text-xs font-bold text-brand-500">Risk Asistanı</span>
      </div>
      <p className="mt-1.5 text-sm text-slate-500">Proje verinizden otomatik risk skoru, faktör analizi ve öneriler.</p>
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
