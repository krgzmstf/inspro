"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { kodGonder, kodDogrula, supabaseVar } from "@/lib/supabase/auth";

export default function KayitPage() {
  const router = useRouter();
  const [asama, setAsama] = useState<"bilgi" | "kod">("bilgi");
  const [adSoyad, setAdSoyad] = useState("");
  const [firma, setFirma] = useState("");
  const [email, setEmail] = useState("");
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  async function kodIste(e: React.FormEvent) {
    e.preventDefault();
    setHata(""); setBilgi(""); setYukleniyor(true);
    const s = await kodGonder(email, true, adSoyad, firma);
    setYukleniyor(false);
    if (!s.ok) { setHata(s.mesaj); return; }
    setBilgi(`${email} adresine kod gönderildi.`);
    setAsama("kod");
  }

  async function dogrula(e: React.FormEvent) {
    e.preventDefault();
    setHata(""); setYukleniyor(true);
    const s = await kodDogrula(email, kod);
    setYukleniyor(false);
    if (!s.ok) { setHata(s.mesaj); return; }
    router.push("/panel");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <Link href="/" className="block text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/inspro-logo.png" alt="insPRO" className="mx-auto h-16 w-auto object-contain" />
        </Link>
        <h1 className="mt-4 text-center text-xl font-extrabold text-ink-900">Hesap Oluştur</h1>
        <p className="mt-1 text-center text-xs text-slate-500">E-postana kod gönderelim, kodla kayıt ol</p>

        {!supabaseVar() && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            Supabase yapılandırılmamış — DEMO modunda kayıt gerekmez.
          </p>
        )}

        {asama === "bilgi" ? (
          <form onSubmit={kodIste} className="mt-6 space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Ad Soyad
              <input required value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Firma <span className="font-normal text-slate-400">(ops.)</span>
              <input value={firma} onChange={(e) => setFirma(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">E-posta
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>
            {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}
            <button type="submit" disabled={yukleniyor}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {yukleniyor ? "Gönderiliyor…" : "Kod Gönder →"}
            </button>
          </form>
        ) : (
          <form onSubmit={dogrula} className="mt-6 space-y-3">
            {bilgi && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{bilgi}</p>}
            <label className="block text-sm font-semibold text-slate-700">Doğrulama Kodu
              <input required inputMode="numeric" value={kod} onChange={(e) => setKod(e.target.value)}
                placeholder="6 haneli kod" autoFocus
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-brand-500" />
            </label>
            {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}
            <button type="submit" disabled={yukleniyor}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {yukleniyor ? "Doğrulanıyor…" : "Kayıt Ol"}
            </button>
            <button type="button" onClick={() => { setAsama("bilgi"); setKod(""); setHata(""); }}
              className="w-full text-center text-xs text-slate-400 hover:text-ink-800">← E-postayı değiştir / yeni kod</button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          Zaten hesabın var mı? <Link href="/giris" className="font-bold text-brand-600 hover:underline">Giriş yap</Link>
        </p>
      </div>
    </div>
  );
}
