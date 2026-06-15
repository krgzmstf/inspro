"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { girisYap, supabaseVar } from "@/lib/supabase/auth";
import { yerelGiris } from "@/lib/yerelOturum";

export default function GirisPage() {
  const router = useRouter();
  const [ad, setAd] = useState("");
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kayitliAc, setKayitliAc] = useState(false);

  function adIleGir(e: React.FormEvent) {
    e.preventDefault();
    if (!ad.trim()) return;
    yerelGiris(ad);
    router.push("/panel");
  }

  async function epostaIleGir(e: React.FormEvent) {
    e.preventDefault();
    setHata(""); setYukleniyor(true);
    const s = await girisYap(email, sifre);
    setYukleniyor(false);
    if (s.ok) router.push("/panel");
    else setHata(s.mesaj);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <Link href="/" className="block text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/inspro-logo.png" alt="insPRO" className="mx-auto h-16 w-auto object-contain" />
        </Link>
        <h1 className="mt-4 text-center text-xl font-extrabold text-ink-900">Panele Giriş</h1>
        <p className="mt-1 text-center text-xs text-slate-500">Kullanıcı adını yaz, hemen başla</p>

        {/* Kayıtsız (kullanıcı adı) giriş — birincil */}
        <form onSubmit={adIleGir} className="mt-6 space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Kullanıcı Adı
            <input autoFocus required value={ad} onChange={(e) => setAd(e.target.value)}
              placeholder="ör: Mustafa"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <button type="submit"
            className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
            Panele Gir →
          </button>
          <p className="text-center text-[11px] text-slate-400">
            Kayıt gerekmez. Veriler şimdilik bu cihazda saklanır.
          </p>
        </form>

        {/* Kayıtlı hesapla giriş (Supabase) — ikincil */}
        <div className="mt-6 border-t border-slate-100 pt-4">
          <button onClick={() => setKayitliAc((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold text-slate-500 hover:text-ink-800">
            <span>Kayıtlı hesapla giriş (e-posta)</span>
            <span>{kayitliAc ? "▴" : "▾"}</span>
          </button>
          {kayitliAc && (
            <form onSubmit={epostaIleGir} className="mt-3 space-y-3">
              {!supabaseVar() && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                  Supabase yapılandırılmamış — şimdilik kullanıcı adıyla gir.
                </p>
              )}
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta"
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <input type="password" required value={sifre} onChange={(e) => setSifre(e.target.value)} placeholder="Şifre"
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}
              <button type="submit" disabled={yukleniyor}
                className="w-full rounded-xl border-2 border-ink-900 py-2.5 text-sm font-bold text-ink-900 transition hover:bg-ink-900 hover:text-white disabled:opacity-50">
                {yukleniyor ? "Giriş yapılıyor…" : "E-posta ile Giriş"}
              </button>
              <p className="text-center text-xs text-slate-500">
                Hesabın yok mu? <Link href="/kayit" className="font-bold text-brand-600 hover:underline">Kayıt ol</Link>
              </p>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs">
          <Link href="/" className="text-slate-400 hover:text-ink-800">← Ana sayfa</Link>
        </p>
      </div>
    </div>
  );
}
