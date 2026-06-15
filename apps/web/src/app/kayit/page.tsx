"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { kayitOl, supabaseVar } from "@/lib/supabase/auth";

export default function KayitPage() {
  const router = useRouter();
  const [adSoyad, setAdSoyad] = useState("");
  const [firma, setFirma] = useState("");
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(""); setBilgi(""); setYukleniyor(true);
    const s = await kayitOl(email, sifre, adSoyad, firma);
    setYukleniyor(false);
    if (!s.ok) { setHata(s.mesaj); return; }
    if (s.dogrulamaGerek) { setBilgi(s.mesaj); return; }
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
        <p className="mt-1 text-center text-xs text-slate-500">Ücretsiz başla — kart gerekmez</p>

        {!supabaseVar() && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            Supabase yapılandırılmamış — DEMO modunda kayıt gerekmez.
          </p>
        )}

        <form onSubmit={gonder} className="mt-6 space-y-3">
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
          <label className="block text-sm font-semibold text-slate-700">Şifre <span className="font-normal text-slate-400">(en az 6)</span>
            <input type="password" required minLength={6} value={sifre} onChange={(e) => setSifre(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}
          {bilgi && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{bilgi}</p>}
          <button type="submit" disabled={yukleniyor}
            className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
            {yukleniyor ? "Oluşturuluyor…" : "Hesap Oluştur"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Zaten hesabın var mı? <Link href="/giris" className="font-bold text-brand-600 hover:underline">Giriş yap</Link>
        </p>
      </div>
    </div>
  );
}
