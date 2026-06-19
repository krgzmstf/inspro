"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SifreInput from "@/components/SifreInput";
import { type Kullanici, aktifKullanici, sifreDegistir, cikisYap, supabaseVar } from "@/lib/supabase/auth";
import { senkronAbone, kuyruguBosalt, type SenkronDurum } from "@/lib/senkronKuyruk";

export default function AyarlarPage() {
  const router = useRouter();
  const [u, setU] = useState<Kullanici | null>(null);

  // Şifre değiştir
  const [mevcut, setMevcut] = useState("");
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [sifreMsj, setSifreMsj] = useState<{ ok: boolean; t: string } | null>(null);
  const [sifreYukleniyor, setSifreYukleniyor] = useState(false);

  // Senkron durumu
  const [durum, setDurum] = useState<SenkronDurum>({ cevrimici: true, bekleyen: 0, eslesiyor: false });
  const [bildirimDurum, setBildirimDurum] = useState<string>("");

  useEffect(() => { aktifKullanici().then(setU); }, []);
  useEffect(() => senkronAbone(setDurum), []);
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setBildirimDurum(Notification.permission);
  }, []);

  async function sifreKaydet(e: React.FormEvent) {
    e.preventDefault();
    setSifreMsj(null);
    if (yeni !== tekrar) { setSifreMsj({ ok: false, t: "Yeni şifreler eşleşmiyor." }); return; }
    setSifreYukleniyor(true);
    const s = await sifreDegistir(mevcut, yeni);
    setSifreYukleniyor(false);
    setSifreMsj({ ok: s.ok, t: s.mesaj });
    if (s.ok) { setMevcut(""); setYeni(""); setTekrar(""); }
  }

  async function bildirimIzni() {
    if (!("Notification" in window)) { setBildirimDurum("desteklenmiyor"); return; }
    const izin = await Notification.requestPermission();
    setBildirimDurum(izin);
  }

  async function cikis() {
    await cikisYap();
    router.replace("/giris");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">⚙️ Ayarlar</h1>
        <p className="mt-1 text-sm text-slate-500">Şifreni değiştir, görünümü ayarla, verini yönet.</p>
      </div>

      {/* Hesap özeti */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-900 text-lg font-bold uppercase text-white">
            {(u?.ad_soyad || u?.email || "K").charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">{u?.ad_soyad || "Kullanıcı"}</div>
            <div className="truncate text-xs text-slate-500">{u?.email || (supabaseVar() ? "" : "Yerel mod")}</div>
          </div>
        </div>
      </section>

      {/* Şifre değiştir */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-ink-900">🔐 Şifre Değiştir</h2>
        <p className="mt-1 text-xs text-slate-500">Güvenliğin için önce mevcut şifreni gir.</p>
        {sifreMsj && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${sifreMsj.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {sifreMsj.t}
          </p>
        )}
        <form onSubmit={sifreKaydet} className="mt-3 space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Mevcut şifre
            <SifreInput required value={mevcut} onChange={(e) => setMevcut(e.target.value)} autoComplete="current-password"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Yeni şifre (en az 6 karakter)
            <SifreInput required value={yeni} onChange={(e) => setYeni(e.target.value)} autoComplete="new-password"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Yeni şifre (tekrar)
            <SifreInput required value={tekrar} onChange={(e) => setTekrar(e.target.value)} autoComplete="new-password"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <button type="submit" disabled={sifreYukleniyor || !supabaseVar()}
            className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
            {sifreYukleniyor ? "Güncelleniyor…" : "Şifreyi Güncelle"}
          </button>
          {!supabaseVar() && <p className="text-xs text-amber-600">Yerel modda şifre değiştirilemez (giriş yapılmamış).</p>}
        </form>
      </section>

      {/* Genel ayarlar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-ink-900">🛠️ Genel Ayarlar</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {/* Görünüm */}
          <Satir baslik="🎨 Görünüm & Tema" alt="Renk teması ve logoyu özelleştir">
            <Link href="/tema" className="rounded-lg border-2 border-slate-200 px-4 py-1.5 text-sm font-bold text-slate-700 transition hover:border-brand-500 hover:text-brand-600">Aç</Link>
          </Satir>

          {/* Güvenlik / 2FA */}
          <Satir baslik="🛡️ Güvenlik & 2FA" alt="İki adımlı doğrulama (Google Authenticator)">
            <Link href="/panel/profil" className="rounded-lg border-2 border-slate-200 px-4 py-1.5 text-sm font-bold text-slate-700 transition hover:border-brand-500 hover:text-brand-600">Profilim</Link>
          </Satir>

          {/* Bildirimler */}
          <Satir baslik="🔔 Bildirimler" alt={
            bildirimDurum === "granted" ? "İzin verildi ✓"
            : bildirimDurum === "denied" ? "Tarayıcı ayarlarından açmalısın"
            : bildirimDurum === "desteklenmiyor" ? "Bu cihaz desteklemiyor"
            : "Mesaj ve hatırlatma bildirimlerine izin ver"
          }>
            <button onClick={bildirimIzni} disabled={bildirimDurum === "granted" || bildirimDurum === "denied"}
              className="rounded-lg border-2 border-slate-200 px-4 py-1.5 text-sm font-bold text-slate-700 transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-40">
              {bildirimDurum === "granted" ? "Açık" : "İzin Ver"}
            </button>
          </Satir>

          {/* Veri & senkron */}
          <Satir
            baslik="🔄 Veri & Eşitleme"
            alt={durum.cevrimici
              ? (durum.bekleyen > 0 ? `${durum.bekleyen} değişiklik eşitlenmeyi bekliyor` : "Tüm veriler eşitli")
              : "Çevrimdışı — bağlanınca otomatik eşitlenir"}>
            <button onClick={() => void kuyruguBosalt()} disabled={!durum.cevrimici || durum.bekleyen === 0}
              className="rounded-lg border-2 border-slate-200 px-4 py-1.5 text-sm font-bold text-slate-700 transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-40">
              Şimdi Eşitle
            </button>
          </Satir>
        </div>
      </section>

      {/* Hesap işlemleri */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-ink-900">👤 Hesap</h2>
        <button onClick={cikis} className="mt-3 rounded-xl border-2 border-red-200 px-5 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">
          Çıkış Yap
        </button>
      </section>

      <p className="text-center text-xs">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Panele dön</Link>
      </p>
    </div>
  );
}

function Satir({ baslik, alt, children }: { baslik: string; alt: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800">{baslik}</div>
        <div className="text-xs text-slate-500">{alt}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
