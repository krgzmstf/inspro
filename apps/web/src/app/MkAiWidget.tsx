"use client";

/* ──────────────────────────────────────────────────────────
   Ana sayfa (vitrin) — yüzen mk_ai sohbet balonu

   Sağ altta logo butonu; tıklayınca sohbet ekranı açılır.
   Mevzuat destekli agentic uca (/api/mk-ai/danis) bağlanır;
   AI anahtarı yoksa demo + yönetmelik araması yine çalışır.
   ────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";

interface Kaynak { id: string; baslik: string; kaynak: string }
interface Mesaj { role: "user" | "assistant"; content: string; kaynaklar?: Kaynak[]; demo?: boolean }

const HIZLI = [
  "insPRO ne işe yarar?",
  "Betonarmede pas payı kaç mm?",
  "Ön bahçe çekme mesafesi ne kadar?",
];

export default function MkAiWidget() {
  const [acik, setAcik] = useState(false);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [soru, setSoru] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const sonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (acik) sonRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mesajlar, yukleniyor, acik]);

  async function sor(q: string) {
    if (!q.trim() || yukleniyor) return;
    const yeni: Mesaj[] = [...mesajlar, { role: "user", content: q.trim() }];
    setMesajlar(yeni);
    setSoru("");
    setYukleniyor(true);
    try {
      const res = await fetch("/api/mk-ai/danis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: yeni }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek başarısız.");
      setMesajlar([...yeni, { role: "assistant", content: data.text ?? "", kaynaklar: data.kaynaklar ?? [], demo: !!data.demoMode }]);
    } catch (e) {
      setMesajlar([...yeni, { role: "assistant", content: "⚠️ " + (e as Error).message }]);
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <>
      {/* Sohbet penceresi */}
      {acik && (
        <div className="fixed bottom-24 right-4 z-[60] flex h-[70vh] max-h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-6">
          {/* Başlık */}
          <div className="flex items-center gap-2 bg-ink-950 px-4 py-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mk-ai-logo.jpg" alt="mk_ai" className="h-8 w-auto rounded" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold">mk_ai&apos;ye Sor</div>
              <div className="text-[10px] text-white/60">inşaat & mevzuat asistanı</div>
            </div>
            <button onClick={() => setAcik(false)} className="rounded-lg px-2 py-1 text-lg text-white/70 hover:bg-white/10">✕</button>
          </div>

          {/* Mesajlar */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {mesajlar.length === 0 ? (
              <div>
                <p className="text-xs leading-relaxed text-slate-500">
                  Merhaba 👋 insPRO veya Türk inşaat mevzuatı hakkında soru sor; gerekirse kaynak göstererek yanıtlarım.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {HIZLI.map((q) => (
                    <button key={q} onClick={() => sor(q)} disabled={yukleniyor}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-ink-900 hover:text-ink-900 disabled:opacity-50">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              mesajlar.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  <div className={`inline-block max-w-[88%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-ink-900 text-white" : "bg-white text-slate-800 shadow-sm"}`}>
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
                    {m.demo && <div className="mt-1.5 text-[10px] font-bold text-amber-600">DEMO — AI anahtarı yok</div>}
                  </div>
                </div>
              ))
            )}
            {yukleniyor && <div className="text-xs text-slate-400">mk_ai düşünüyor…</div>}
            <div ref={sonRef} />
          </div>

          {/* Giriş */}
          <form onSubmit={(e) => { e.preventDefault(); sor(soru); }} className="flex gap-2 border-t border-slate-200 bg-white p-3">
            <input value={soru} onChange={(e) => setSoru(e.target.value)} placeholder="Bir soru yaz…"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink-900" />
            <button type="submit" disabled={yukleniyor || !soru.trim()}
              className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              Gönder
            </button>
          </form>
        </div>
      )}

      {/* Yüzen buton */}
      <button
        onClick={() => setAcik((v) => !v)}
        aria-label="mk_ai'ye sor"
        className="fixed bottom-5 right-4 z-[60] flex items-center gap-2 rounded-full bg-ink-950 py-2.5 pl-2.5 pr-4 text-white shadow-2xl ring-2 ring-brand-500/40 transition hover:scale-105 hover:ring-brand-500 sm:right-6"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mk-ai-logo.jpg" alt="mk_ai" className="h-9 w-9 rounded-full object-cover" />
        <span className="text-sm font-extrabold">{acik ? "Kapat" : "mk'ye Sor"}</span>
      </button>
    </>
  );
}
