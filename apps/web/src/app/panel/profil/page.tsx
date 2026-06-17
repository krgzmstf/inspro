"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type Kullanici, aktifKullanici, profilTamamla,
  totpKur, totpAktif, totpKapat,
} from "@/lib/supabase/auth";
import { MESLEKLER } from "@/lib/meslekler";
import { ULKELER } from "@/lib/ulkeler";

export default function ProfilPage() {
  const [u, setU] = useState<Kullanici | null>(null);
  const [hata, setHata] = useState("");
  const [mesaj, setMesaj] = useState("");

  // Profil alanları
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

  // TOTP kurulum
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [totpQr, setTotpQr] = useState("");
  const [totpKod, setTotpKod] = useState("");

  useEffect(() => {
    aktifKullanici().then((k) => {
      if (!k) return;
      setU(k);
      setAd(k.ad ?? ""); setSoyad(k.soyad ?? "");
      setDogum(k.dogum_tarihi ?? ""); setMeslek(k.meslek ?? "");
      setSirketMi(!!k.sirket_mi); setSirketAdi(k.sirket_adi ?? "");
      setVergiDairesi(k.vergi_dairesi ?? ""); setVergiNo(k.vergi_no ?? "");
      // telefon: +90... → ülke kodu ve numara ayrıştır
      const tel = k.telefon ?? "";
      const eslesen = ULKELER.find((x) => tel.startsWith(x.kod));
      if (eslesen) { setUlkeKod(eslesen.kod); setTelNo(tel.slice(eslesen.kod.length)); }
      else if (tel) setTelNo(tel);
    });
  }, []);

  async function profilKaydet(e: React.FormEvent) {
    e.preventDefault(); setHata(""); setMesaj("");
    if (!ad.trim() || !soyad.trim()) { setHata("Ad ve soyad gerekli."); return; }
    const telefon = telNo.trim() ? `${ulkeKod}${telNo.replace(/\D/g, "")}` : "";
    const s = await profilTamamla({
      ad, soyad, telefon, dogum_tarihi: dogum, meslek,
      sirket_mi: sirketMi, sirket_adi: sirketAdi, vergi_dairesi: vergiDairesi, vergi_no: vergiNo,
    });
    if (!s.ok) { setHata(s.mesaj); return; }
    setMesaj("✓ Profil kaydedildi.");
    setU(await aktifKullanici());
  }

  async function totpBaslat() {
    setHata(""); setMesaj("");
    try { const r = await totpKur(); setTotpSecret(r.secret); setTotpUri(r.otpauth); setTotpQr(r.qr); }
    catch (e) { setHata((e as Error).message); }
  }
  async function totpDogrula(e: React.FormEvent) {
    e.preventDefault(); setHata(""); setMesaj("");
    const s = await totpAktif(totpKod);
    if (!s.ok) { setHata(s.mesaj); return; }
    setMesaj("✓ Google Authenticator aktif edildi. Artık girişte uygulama kodunu kullanacaksınız.");
    setTotpSecret(""); setTotpUri(""); setTotpQr(""); setTotpKod("");
    setU(await aktifKullanici());
  }
  async function totpDevreDisi() {
    const s = await totpKapat();
    if (!s.ok) { setHata(s.mesaj); return; }
    setMesaj("✓ E-posta kodu yöntemine dönüldü.");
    setU(await aktifKullanici());
  }

  if (!u) return <p className="text-sm text-slate-500">Yükleniyor…</p>;
  const totpAcik = u.iki_adim_yontem === "totp";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">👤 Profilim & Güvenlik</h1>
        <p className="mt-1 text-sm text-slate-500">{u.email}</p>
      </div>

      {mesaj && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{mesaj}</p>}
      {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}

      {/* Profil */}
      <form onSubmit={profilKaydet} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-bold text-ink-900">Kişisel bilgiler</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold text-slate-600">Ad
            <input value={ad} onChange={(e) => setAd(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">Soyad
            <input value={soyad} onChange={(e) => setSoyad(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-600">Telefon</span>
          <div className="mt-1 flex gap-2">
            <select value={ulkeKod} onChange={(e) => setUlkeKod(e.target.value)} className="rounded-lg border-2 border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand-500">
              {ULKELER.map((x, i) => <option key={i} value={x.kod}>{x.bayrak} {x.kod}</option>)}
            </select>
            <input inputMode="tel" value={telNo} onChange={(e) => setTelNo(e.target.value)} placeholder="5XX XXX XX XX" className="min-w-0 flex-1 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold text-slate-600">Doğum Tarihi
            <input type="date" value={dogum} onChange={(e) => setDogum(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">Meslek
            <select value={meslek} onChange={(e) => setMeslek(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
              <option value="">— seçin —</option>
              {MESLEKLER.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={sirketMi} onChange={(e) => setSirketMi(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand-500)]" />
          Şirket / firma
        </label>
        {sirketMi && (
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-3">
            <input value={sirketAdi} onChange={(e) => setSirketAdi(e.target.value)} placeholder="Şirket adı" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            <input value={vergiDairesi} onChange={(e) => setVergiDairesi(e.target.value)} placeholder="Vergi dairesi" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            <input value={vergiNo} onChange={(e) => setVergiNo(e.target.value)} placeholder="Vergi no" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </div>
        )}
        <button type="submit" className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Kaydet</button>
      </form>

      {/* 2FA */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-ink-900">İki Adımlı Doğrulama (2FA)</div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${totpAcik ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {totpAcik ? "🔐 Google Authenticator" : "📧 E-posta kodu"}
          </span>
        </div>

        {totpAcik ? (
          <div>
            <p className="text-sm text-slate-600">Girişte Google Authenticator uygulamasındaki kodu kullanıyorsunuz.</p>
            <button onClick={totpDevreDisi} className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">E-posta koduna dön</button>
          </div>
        ) : !totpSecret ? (
          <div>
            <p className="text-sm text-slate-600">Şu an e-posta ile kod alıyorsunuz. Daha güvenli olması için Google Authenticator&apos;a geçebilirsiniz.</p>
            <button onClick={totpBaslat} className="mt-3 rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white hover:bg-ink-800">Google Authenticator kur</button>
          </div>
        ) : (
          <form onSubmit={totpDogrula} className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Telefonunda <b>Google Authenticator</b> uygulamasını aç.</li>
              <li>&quot;+&quot; → <b>QR kodunu tara</b> seç ve aşağıdaki kodu tarat.</li>
              <li>Uygulamada beliren <b>6 haneli kodu</b> aşağıya gir.</li>
            </ol>
            {totpQr && (
              <div className="flex justify-center">
                <div className="rounded-xl border-2 border-brand-200 bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={totpQr.startsWith("data:") ? totpQr : `data:image/svg+xml;utf8,${encodeURIComponent(totpQr)}`}
                    alt="Google Authenticator QR kodu"
                    className="h-44 w-44"
                  />
                </div>
              </div>
            )}
            <details className="text-[11px] text-slate-500">
              <summary className="cursor-pointer font-semibold">QR taranmıyor mu? Anahtarı elle gir</summary>
              <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2 text-center">
                <code className="select-all break-all text-sm font-bold tracking-wider text-brand-700">{totpSecret}</code>
              </div>
              <p className="mt-1">Hesap: insPRO ({u.email}) · tür: zamana dayalı (TOTP)</p>
            </details>
            <label className="block text-sm font-semibold text-slate-700">Uygulamadaki 6 haneli kod
              <input required inputMode="numeric" value={totpKod} onChange={(e) => setTotpKod(e.target.value)} placeholder="000000"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-brand-500" />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-bold text-white hover:bg-brand-600">Doğrula ve aktif et</button>
              <button type="button" onClick={() => { setTotpSecret(""); setTotpUri(""); setTotpQr(""); setTotpKod(""); }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">Vazgeç</button>
            </div>
          </form>
        )}
      </div>

      <Link href="/panel" className="inline-block text-sm font-semibold text-slate-500 hover:text-ink-800">← Panele dön</Link>
    </div>
  );
}
