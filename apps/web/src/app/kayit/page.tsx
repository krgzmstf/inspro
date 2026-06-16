"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { kayitBasla, kayitDogrula, profilTamamla } from "@/lib/supabase/auth";
import { MESLEKLER } from "@/lib/meslekler";
import { ULKELER } from "@/lib/ulkeler";

type Asama = "kayit" | "kod" | "profil";

export default function KayitPage() {
  const router = useRouter();
  const [asama, setAsama] = useState<Asama>("kayit");
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  // Profil
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [ulkeKod, setUlkeKod] = useState("+90");
  const [telNo, setTelNo] = useState("");
  const [dogum, setDogum] = useState("");
  const [meslek, setMeslek] = useState("");
  const [sirketMi, setSirketMi] = useState(false);
  const [sirketAdi, setSirketAdi] = useState("");
  const [vergiDairesi, setVergiDairesi] = useState("");
  const [vergiNo, setVergiNo] = useState("");

  async function basla(e: React.FormEvent) {
    e.preventDefault(); setHata("");
    if (sifre.length < 6) { setHata("Şifre en az 6 karakter olmalı."); return; }
    if (sifre !== sifre2) { setHata("Şifreler eşleşmiyor."); return; }
    setYukleniyor(true);
    const s = await kayitBasla(email, sifre);
    setYukleniyor(false);
    if (!s.ok) { setHata(s.mesaj); return; }
    setBilgi(`${email} adresine kod gönderildi.`);
    setAsama("kod");
  }

  async function dogrula(e: React.FormEvent) {
    e.preventDefault(); setHata(""); setYukleniyor(true);
    const s = await kayitDogrula(email, kod);
    setYukleniyor(false);
    if (!s.ok) { setHata(s.mesaj); return; }
    setAsama("profil");
  }

  async function profilKaydet(e: React.FormEvent) {
    e.preventDefault(); setHata("");
    if (!ad.trim() || !soyad.trim()) { setHata("Ad ve soyad gerekli."); return; }
    const telefon = telNo.trim() ? `${ulkeKod}${telNo.replace(/\D/g, "")}` : "";
    setYukleniyor(true);
    const s = await profilTamamla({
      ad, soyad, telefon, dogum_tarihi: dogum, meslek,
      sirket_mi: sirketMi, sirket_adi: sirketAdi, vergi_dairesi: vergiDairesi, vergi_no: vergiNo,
    });
    setYukleniyor(false);
    if (!s.ok) { setHata(s.mesaj); return; }
    router.push("/panel");
  }

  const adim = asama === "kayit" ? 1 : asama === "kod" ? 2 : 3;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <Link href="/" className="block text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/inspro-logo.png" alt="insPRO" className="mx-auto h-16 w-auto object-contain" />
        </Link>
        <h1 className="mt-4 text-center text-xl font-extrabold text-ink-900">Kayıt Ol</h1>

        {/* Adım göstergesi */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1.5 w-12 rounded-full ${n <= adim ? "bg-brand-500" : "bg-slate-200"}`} />
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          {asama === "kayit" && "1/3 — E-posta ve şifre"}
          {asama === "kod" && "2/3 — E-posta doğrulama"}
          {asama === "profil" && "3/3 — Bilgileriniz"}
        </p>

        {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}
        {bilgi && asama === "kod" && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{bilgi}</p>}

        {/* ADIM 1 */}
        {asama === "kayit" && (
          <form onSubmit={basla} className="mt-5 space-y-3">
            <label className="block text-sm font-semibold text-slate-700">E-posta
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Şifre
              <input type="password" required value={sifre} onChange={(e) => setSifre(e.target.value)} placeholder="en az 6 karakter"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Şifre (tekrar)
              <input type="password" required value={sifre2} onChange={(e) => setSifre2(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>
            <button type="submit" disabled={yukleniyor}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {yukleniyor ? "Gönderiliyor…" : "Devam → kod gönder"}
            </button>
          </form>
        )}

        {/* ADIM 2 */}
        {asama === "kod" && (
          <form onSubmit={dogrula} className="mt-5 space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Doğrulama Kodu
              <input required inputMode="numeric" value={kod} onChange={(e) => setKod(e.target.value)} placeholder="6 haneli kod" autoFocus
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-brand-500" />
            </label>
            <button type="submit" disabled={yukleniyor}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {yukleniyor ? "Doğrulanıyor…" : "Doğrula →"}
            </button>
            <button type="button" onClick={() => { setAsama("kayit"); setKod(""); setHata(""); }}
              className="w-full text-center text-xs text-slate-400 hover:text-ink-800">← Geri</button>
          </form>
        )}

        {/* ADIM 3 — PROFİL */}
        {asama === "profil" && (
          <form onSubmit={profilKaydet} className="mt-5 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm font-semibold text-slate-700">Ad
                <input required value={ad} onChange={(e) => setAd(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">Soyad
                <input required value={soyad} onChange={(e) => setSoyad(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </label>
            </div>

            <div>
              <span className="text-sm font-semibold text-slate-700">Telefon</span>
              <div className="mt-1 flex gap-2">
                <select value={ulkeKod} onChange={(e) => setUlkeKod(e.target.value)}
                  className="rounded-xl border-2 border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand-500">
                  {ULKELER.map((u, i) => <option key={i} value={u.kod}>{u.bayrak} {u.kod}</option>)}
                </select>
                <input inputMode="tel" value={telNo} onChange={(e) => setTelNo(e.target.value)} placeholder="5XX XXX XX XX"
                  className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
            </div>

            <label className="block text-sm font-semibold text-slate-700">Doğum Tarihi
              <input type="date" value={dogum} onChange={(e) => setDogum(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>

            <label className="block text-sm font-semibold text-slate-700">Meslek
              <select value={meslek} onChange={(e) => setMeslek(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                <option value="">— seçin —</option>
                {MESLEKLER.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={sirketMi} onChange={(e) => setSirketMi(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand-500)]" />
              Şirket / firma adına kayıt
            </label>

            {sirketMi && (
              <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <label className="block text-xs font-semibold text-slate-600">Şirket Adı
                  <input value={sirketAdi} onChange={(e) => setSirketAdi(e.target.value)}
                    className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold text-slate-600">Vergi Dairesi
                    <input value={vergiDairesi} onChange={(e) => setVergiDairesi(e.target.value)}
                      className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">Vergi No
                    <input value={vergiNo} onChange={(e) => setVergiNo(e.target.value)}
                      className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                  </label>
                </div>
              </div>
            )}

            <button type="submit" disabled={yukleniyor}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {yukleniyor ? "Kaydediliyor…" : "Kaydı Tamamla ✓"}
            </button>
          </form>
        )}

        {asama === "kayit" && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Hesabın var mı? <Link href="/giris" className="font-bold text-brand-600 hover:underline">Giriş yap</Link>
          </p>
        )}
        <p className="mt-3 text-center text-xs">
          <Link href="/" className="text-slate-400 hover:text-ink-800">← Ana sayfa</Link>
        </p>
      </div>
    </div>
  );
}
