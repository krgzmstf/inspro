"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sifreyiGuncelle } from "@/lib/supabase/auth";
import SifreInput from "@/components/SifreInput";

export default function SifreSifirlaPage() {
  const router = useRouter();
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [hata, setHata] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    if (sifre.length < 6) { setHata("Şifre en az 6 karakter olmalı."); return; }
    if (sifre !== sifre2) { setHata("Şifreler eşleşmiyor."); return; }
    setYukleniyor(true);
    const s = await sifreyiGuncelle(sifre);
    setYukleniyor(false);
    if (!s.ok) { setHata(s.mesaj + " (Bağlantının süresi dolmuş olabilir; tekrar 'Şifremi unuttum' iste.)"); return; }
    setMesaj("✓ Şifren güncellendi. Giriş sayfasına yönlendiriliyorsun…");
    setTimeout(() => router.push("/giris"), 1800);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <Link href="/" className="block text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/inspro-logo.png" alt="insPRO" className="mx-auto h-16 w-auto object-contain" />
        </Link>
        <h1 className="mt-4 text-center text-xl font-extrabold text-ink-900">Yeni Şifre Belirle</h1>
        <p className="mt-1 text-center text-xs text-slate-500">E-postandaki bağlantıyla buraya geldin. Yeni şifreni gir.</p>

        {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}
        {mesaj && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{mesaj}</p>}

        <form onSubmit={kaydet} className="mt-6 space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Yeni şifre
            <SifreInput required value={sifre} onChange={(e) => setSifre(e.target.value)} placeholder="en az 6 karakter"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Yeni şifre (tekrar)
            <SifreInput required value={sifre2} onChange={(e) => setSifre2(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <button type="submit" disabled={yukleniyor}
            className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
            {yukleniyor ? "Kaydediliyor…" : "Şifreyi Güncelle"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs">
          <Link href="/giris" className="text-slate-400 hover:text-ink-800">← Giriş sayfası</Link>
        </p>
      </div>
    </div>
  );
}
