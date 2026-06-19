"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  type Kisi, type SohbetMesaj,
  kisileriGetir, konusma, konusmaOzetleri, gonder, sohbetBaslat, sohbetAbone,
  okunduIsaretle,
} from "@/lib/sohbet";

export default function SohbetPage() {
  const [kisiler, setKisiler] = useState<Kisi[]>([]);
  const [secili, setSecili] = useState<string | null>(null);
  const [metin, setMetin] = useState("");
  const [tik, setTik] = useState(0); // yenileme tetikleyici
  const [ara, setAra] = useState("");
  const sonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let kapat = () => {};
    sohbetBaslat().then((f) => { kapat = f; });
    const cik = sohbetAbone(() => setTik((t) => t + 1));
    kisileriGetir().then(setKisiler);
    return () => { kapat(); cik(); };
  }, []);

  const ozetler = useMemo(() => konusmaOzetleri(), [tik]);
  const mesajlar = useMemo<SohbetMesaj[]>(() => (secili ? konusma(secili) : []), [secili, tik]);

  useEffect(() => {
    if (secili) { okunduIsaretle(secili); sonRef.current?.scrollIntoView({ behavior: "smooth" }); }
  }, [secili, mesajlar.length]);

  // Kişi adı çöz (rehber + konuşma özetleri)
  function adCoz(id: string): string {
    return kisiler.find((k) => k.id === id)?.ad
      ?? ozetler.find((o) => o.peerId === id)?.ad
      ?? "Kullanıcı";
  }

  // Sol liste: konuşmalar + (henüz konuşulmamış) rehber kişileri
  const konusulanIdler = new Set(ozetler.map((o) => o.peerId));
  const digerKisiler = kisiler.filter((k) => !konusulanIdler.has(k.id));
  const filtre = (ad: string) => ad.toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr"));

  async function gonderMesaj(e: React.FormEvent) {
    e.preventDefault();
    if (!secili || !metin.trim()) return;
    await gonder(secili, metin);
    setMetin("");
    setTik((t) => t + 1);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Sol: kişi/konuşma listesi */}
      <aside className={`flex w-full flex-col border-r border-slate-200 sm:w-72 ${secili ? "hidden sm:flex" : "flex"}`}>
        <div className="border-b border-slate-100 p-3">
          <h1 className="text-lg font-extrabold text-slate-900">💬 Sohbet</h1>
          <input value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Kişi ara…"
            className="mt-2 w-full rounded-lg border-2 border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {ozetler.filter((o) => filtre(adCoz(o.peerId))).map((o) => (
            <button key={o.peerId} onClick={() => setSecili(o.peerId)}
              className={`flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-50 ${secili === o.peerId ? "bg-brand-50" : ""}`}>
              <Avatar ad={adCoz(o.peerId)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-800">{adCoz(o.peerId)}</span>
                  {o.okunmamis > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">{o.okunmamis}</span>}
                </div>
                <span className="block truncate text-xs text-slate-400">{o.son ? (o.son.benim ? "Siz: " : "") + o.son.metin : ""}</span>
              </div>
            </button>
          ))}
          {digerKisiler.filter((k) => filtre(k.ad)).length > 0 && (
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Kişiler</div>
          )}
          {digerKisiler.filter((k) => filtre(k.ad)).map((k) => (
            <button key={k.id} onClick={() => setSecili(k.id)}
              className="flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-50">
              <Avatar ad={k.ad} />
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-700">{k.ad}</span>
                {k.firma && <span className="block truncate text-xs text-slate-400">{k.firma}</span>}
              </div>
            </button>
          ))}
          {kisiler.length === 0 && ozetler.length === 0 && (
            <p className="p-4 text-center text-xs text-slate-400">Henüz kişi yok. Diğer kullanıcılar kaydolunca burada görünür.</p>
          )}
        </div>
      </aside>

      {/* Sağ: konuşma */}
      <section className={`flex min-w-0 flex-1 flex-col ${secili ? "flex" : "hidden sm:flex"}`}>
        {secili ? (
          <>
            <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <button onClick={() => setSecili(null)} className="text-slate-400 sm:hidden" aria-label="Geri">←</button>
              <Avatar ad={adCoz(secili)} />
              <span className="font-bold text-slate-800">{adCoz(secili)}</span>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
              {mesajlar.length === 0 && <p className="text-center text-xs text-slate-400">İlk mesajı siz gönderin 👋</p>}
              {mesajlar.map((m) => (
                <div key={m.id} className={`flex ${m.benim ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.benim ? "bg-brand-500 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.metin}</p>
                    <div className={`mt-0.5 text-right text-[10px] ${m.benim ? "text-white/70" : "text-slate-400"}`}>
                      {new Date(m.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      {m.benim && (m.durum === "bekliyor" ? " · ⏳" : " · ✓")}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={sonRef} />
            </div>
            <form onSubmit={gonderMesaj} className="flex items-center gap-2 border-t border-slate-200 p-3">
              <input value={metin} onChange={(e) => setMetin(e.target.value)} placeholder="Mesaj yaz…"
                className="flex-1 rounded-full border-2 border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-500" />
              <button type="submit" disabled={!metin.trim()}
                className="rounded-full bg-brand-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-40">Gönder</button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="text-5xl">💬</div>
            <p className="mt-3 text-sm">Soldan bir kişi seçip sohbete başlayın.</p>
            <p className="mt-1 text-xs">Mesajlar yalnızca cihazlarda tutulur — sunucuda saklanmaz.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Avatar({ ad }: { ad: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-bold uppercase text-white">
      {ad.charAt(0)}
    </div>
  );
}
