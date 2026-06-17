"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { girisBasla, girisDogrula, ortakGiris } from "@/lib/supabase/auth";

export default function GirisPage() {
  const router = useRouter();
  const [asama, setAsama] = useState<"giris" | "dogrula">("giris");
  const [yontem, setYontem] = useState<"email" | "totp">("email");
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yerelAcik, setYerelAcik] = useState(false);
  const [ortakSifre, setOrtakSifre] = useState("");

  async function girisYap(e: React.FormEvent) {
    e.preventDefault(); setHata(""); setBilgi(""); setYukleniyor(true);
    const s = await girisBasla(email, sifre);
    setYukleniyor(false);
    if (!s.ok) { setHata(s.mesaj); return; }
    // 2FA yoksa giriş tamam → panele
    if (s.tamam) { router.push("/panel"); return; }
    setYontem(s.asama ?? "totp");
    setBilgi("Google Authenticator uygulamasındaki 6 haneli kodu girin.");
    setAsama("dogrula");
  }

  async function dogrula(e: React.FormEvent) {
    e.preventDefault(); setHata(""); setYukleniyor(true);
    const s = await girisDogrula(email, kod);
    setYukleniyor(false);
    if (!s.ok) { setHata(s.mesaj); return; }
    router.push("/panel");
  }

  async function ortakGir(e: React.FormEvent) {
    e.preventDefault();
    if (!ortakSifre.trim()) return;
    setHata(""); setYukleniyor(true);
    const s = await ortakGiris(ortakSifre);
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
        <h1 className="mt-4 text-center text-xl font-extrabold text-ink-900">Panele Giriş</h1>
        <p className="mt-1 text-center text-xs text-slate-500">E-posta + şifre, ardından 2. adım doğrulama</p>

        {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}

        {asama === "giris" ? (
          <form onSubmit={girisYap} className="mt-6 space-y-3">
            <label className="block text-sm font-semibold text-slate-700">E-posta
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Şifre
              <input type="password" required value={sifre} onChange={(e) => setSifre(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>
            <button type="submit" disabled={yukleniyor}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {yukleniyor ? "Kontrol ediliyor…" : "Devam →"}
            </button>
          </form>
        ) : (
          <form onSubmit={dogrula} className="mt-6 space-y-3">
            {bilgi && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{bilgi}</p>}
            <label className="block text-sm font-semibold text-slate-700">
              {yontem === "totp" ? "🔐 Authenticator Kodu" : "📧 E-posta Kodu"}
              <input required inputMode="numeric" value={kod} onChange={(e) => setKod(e.target.value)}
                placeholder="6 haneli kod" autoFocus
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-brand-500" />
            </label>
            <button type="submit" disabled={yukleniyor}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {yukleniyor ? "Doğrulanıyor…" : "Giriş Yap"}
            </button>
            <button type="button" onClick={() => { setAsama("giris"); setKod(""); setHata(""); }}
              className="w-full text-center text-xs text-slate-400 hover:text-ink-800">← Geri</button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          Hesabın yok mu? <Link href="/kayit" className="font-bold text-brand-600 hover:underline">Kayıt ol</Link>
        </p>

        {/* Ortak şifreyle hızlı giriş (yerel) */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <button onClick={() => setYerelAcik((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold text-slate-400 hover:text-ink-800">
            <span>🔑 Ortak şifreyle hızlı giriş (yerel)</span>
            <span>{yerelAcik ? "▴" : "▾"}</span>
          </button>
          {yerelAcik && (
            <form onSubmit={ortakGir} className="mt-2 flex gap-2">
              <input type="password" value={ortakSifre} onChange={(e) => setOrtakSifre(e.target.value)} placeholder="Ortak şifre"
                className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <button type="submit" disabled={yukleniyor} className="rounded-xl border-2 border-ink-900 px-4 py-2 text-sm font-bold text-ink-900 hover:bg-ink-900 hover:text-white disabled:opacity-50">Gir</button>
            </form>
          )}
        </div>

        <p className="mt-3 text-center text-xs">
          <Link href="/" className="text-slate-400 hover:text-ink-800">← Ana sayfa</Link>
        </p>
      </div>
    </div>
  );
}
