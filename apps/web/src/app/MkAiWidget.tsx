"use client";

/* ──────────────────────────────────────────────────────────
   mk_ai — TÜM sayfalarda sağ altta yüzen sohbet asistanı

   Dikkat çeken animasyonlu buton; tıklayınca sohbet açılır.
   Mevzuat destekli agentic uca (/api/mk-ai/danis) bağlanır ve
   giriş yapılmışsa oturum token'ıyla `hesap_ozeti` aracı üzerinden
   kullanıcının Supabase verisine (proje/muhasebe/personel) erişir.
   AI anahtarı yoksa demo + yönetmelik araması yine çalışır.
   ────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { loadBilgiler } from "@/lib/bilgiTabani";
import { supabase } from "@/lib/supabase/client";
import { pollinationsUrl } from "@/lib/gorsel";

interface Kaynak { id: string; baslik: string; kaynak: string }
interface Mesaj { role: "user" | "assistant"; content: string; kaynaklar?: Kaynak[]; demo?: boolean; gorsel?: string }

const SAGLAYICI_ETIKET: Record<string, string> = {
  openai: "ChatGPT", groq: "Groq", gemini: "Gemini", deepseek: "DeepSeek", github: "GitHub Models",
};

const HIZLI_GENEL = [
  "insPRO ne işe yarar?",
  "Betonarmede pas payı kaç mm?",
  "Ön bahçe çekme mesafesi ne kadar?",
];
const HIZLI_GIRISLI = [
  "Kaç projem var, isimleri ne?",
  "Bekleyen veya geciken ödemem var mı?",
  "Bu ay gelir-gider durumum nedir?",
  "Hangi modülde ne kadar verim var?",
];

export default function MkAiWidget() {
  const [acik, setAcik] = useState(false);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [soru, setSoru] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [gorselYukleniyor, setGorselYukleniyor] = useState(false);
  const [girisli, setGirisli] = useState(false);
  const [saglayici, setSaglayici] = useState<string | null>(null);
  const sonRef = useRef<HTMLDivElement>(null);
  const mesgul = yukleniyor || gorselYukleniyor;

  // Oturum durumu (hızlı soruları ve hesap erişimini belirler)
  useEffect(() => {
    const c = supabase();
    if (!c) return;
    c.auth.getSession().then(({ data }) => setGirisli(!!data.session));
    const { data: sub } = c.auth.onAuthStateChange((_e, s) => setGirisli(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (acik) sonRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mesajlar, yukleniyor, acik]);

  async function sor(q: string) {
    if (!q.trim() || mesgul) return;
    const yeni: Mesaj[] = [...mesajlar, { role: "user", content: q.trim() }];
    setMesajlar(yeni);
    setSoru("");
    setYukleniyor(true);
    try {
      // Giriş yapılmışsa token gönder → mk_ai hesap_ozeti aracıyla kişisel veriye bakabilsin
      const c = supabase();
      const { data: oturum } = c ? await c.auth.getSession() : { data: { session: null } };
      const tok = oturum.session?.access_token;
      const res = await fetch("/api/mk-ai/danis", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) },
        body: JSON.stringify({ messages: yeni, ekBilgi: loadBilgiler() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek başarısız.");
      setSaglayici(data.saglayici ?? null);
      setMesajlar([...yeni, { role: "assistant", content: data.text ?? "", kaynaklar: data.kaynaklar ?? [], demo: !!data.demoMode }]);
    } catch (e) {
      setMesajlar([...yeni, { role: "assistant", content: "⚠️ " + (e as Error).message }]);
    } finally {
      setYukleniyor(false);
    }
  }

  async function gorselUret(istek: string) {
    if (!istek.trim() || mesgul) return;
    const yeni: Mesaj[] = [...mesajlar, { role: "user", content: "🎨 Görsel: " + istek.trim() }];
    setMesajlar(yeni);
    setSoru("");
    setGorselYukleniyor(true);
    try {
      // 1) İstekten zengin İngilizce prompt üret
      const pr = await fetch("/api/mk-ai/gorsel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ istek: istek.trim() }),
      });
      const pd = await pr.json();
      const prompt = (pd.prompt as string) || istek.trim();
      // 2) Görseli üret (HF/Gemini); olmazsa Pollinations yedeği
      const gr = await fetch("/api/mk-ai/gorsel-uret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const gd = await gr.json();
      const url = gd.yapildi && gd.dataUrl
        ? (gd.dataUrl as string)
        : pollinationsUrl(prompt, { seed: Math.floor(Math.random() * 1_000_000) });
      setMesajlar([...yeni, { role: "assistant", content: "İşte istediğin görsel 🎨", gorsel: url }]);
    } catch (e) {
      setMesajlar([...yeni, { role: "assistant", content: "⚠️ Görsel üretilemedi: " + (e as Error).message }]);
    } finally {
      setGorselYukleniyor(false);
    }
  }

  const hizli = girisli ? HIZLI_GIRISLI : HIZLI_GENEL;

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
              <div className="text-[10px] text-white/60">
                {girisli ? "verilerine erişebilir · mevzuat destekli" : "inşaat & mevzuat asistanı"}
              </div>
            </div>
            {saglayici && (
              <span className="rounded-full bg-emerald-400/90 px-2 py-0.5 text-[9px] font-bold text-emerald-950">
                {SAGLAYICI_ETIKET[saglayici] ?? saglayici}
              </span>
            )}
            <button onClick={() => setAcik(false)} className="rounded-lg px-2 py-1 text-lg text-white/70 hover:bg-white/10">✕</button>
          </div>

          {/* Mesajlar */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {mesajlar.length === 0 ? (
              <div>
                <p className="text-xs leading-relaxed text-slate-500">
                  Merhaba 👋 {girisli
                    ? "Projelerin, muhaseben ve mevzuat hakkında soru sorabilirsin; verilerine bakıp yanıtlarım."
                    : "insPRO veya Türk inşaat mevzuatı hakkında soru sor; gerekirse kaynak göstererek yanıtlarım."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {hizli.map((q) => (
                    <button key={q} onClick={() => sor(q)} disabled={mesgul}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-ink-900 hover:text-ink-900 disabled:opacity-50">
                      {q}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-violet-600">🎨 İpucu: bir şey yazıp <b>🎨</b> butonuna basarsan mimari görsel/render üretirim.</p>
              </div>
            ) : (
              mesajlar.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  <div className={`inline-block max-w-[88%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-ink-900 text-white" : "bg-white text-slate-800 shadow-sm"}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.gorsel && (
                      <a href={m.gorsel} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.gorsel} alt="mk_ai görseli" className="w-full rounded-lg border border-slate-200" />
                        <span className="mt-1 block text-[10px] font-semibold text-brand-600">Tam boyut ↗</span>
                      </a>
                    )}
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
            {mesgul && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                {gorselYukleniyor ? "mk_ai görseli çiziyor" : "mk_ai düşünüyor"}
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                </span>
              </div>
            )}
            <div ref={sonRef} />
          </div>

          {/* Giriş */}
          <form onSubmit={(e) => { e.preventDefault(); sor(soru); }} className="flex gap-2 border-t border-slate-200 bg-white p-3">
            <input value={soru} onChange={(e) => setSoru(e.target.value)} placeholder="Soru yaz · ya da 🎨 ile görsel iste…"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink-900" />
            <button type="button" onClick={() => gorselUret(soru)} disabled={mesgul || !soru.trim()} title="Görsel üret"
              className="rounded-xl border border-violet-300 px-3 py-2 text-base text-violet-600 transition hover:bg-violet-50 disabled:opacity-50">
              🎨
            </button>
            <button type="submit" disabled={mesgul || !soru.trim()}
              className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              Gönder
            </button>
          </form>
        </div>
      )}

      {/* Yüzen buton (dikkat çeken animasyonlu) */}
      <div className="fixed bottom-5 right-4 z-[60] sm:right-6">
        {/* Dikkat halkası — kapalıyken sürekli nabız atar */}
        {!acik && (
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-brand-500/40" />
        )}
        <button
          onClick={() => setAcik((v) => !v)}
          aria-label="mk_ai'ye sor"
          className={`relative flex items-center gap-2 rounded-full bg-ink-950 py-2.5 pl-2.5 pr-4 text-white shadow-2xl ring-2 ring-brand-500/40 transition hover:scale-105 hover:ring-brand-500 ${acik ? "" : "animate-[mkFloat_2.4s_ease-in-out_infinite]"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mk-ai-logo.jpg" alt="mk_ai" className="h-9 w-9 rounded-full object-cover" />
          <span className="text-sm font-extrabold">{acik ? "Kapat" : "mk'ye Sor"}</span>
        </button>
      </div>

      <style>{`@keyframes mkFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
    </>
  );
}
