"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type Kullanici, supabaseVar, aktifKullanici, cikisYap, oturumDinle } from "@/lib/supabase/auth";
import { yerelKullanici, yerelCikis } from "@/lib/yerelOturum";
import { type Rol, ROL_ETIKET, yetkiGetir, menuyeYetkili } from "@/lib/rol";

type NavItem = { href: string; label: string; icon: string; active: boolean; img?: string };

const NAV: NavItem[] = [
  { href: "/panel", label: "Projeler", icon: "🏗️", active: true },
  { href: "/panel/is-surecleri", label: "İş Süreçleri", icon: "📋", active: true },
  { href: "/panel/metraj", label: "Keşif & Metraj", icon: "📏", active: true },
  { href: "/panel/maliyet", label: "Maliyet", icon: "💰", active: true },
  { href: "/panel/teklif", label: "Teklif", icon: "📄", active: true },
  { href: "/panel/hakedis", label: "Hakediş", icon: "🧾", active: true },
  { href: "/panel/pozlar?lib=kut1", label: "POZ-KÜT-1", icon: "📙", active: true },
  { href: "/panel/pozlar?lib=kut2", label: "Genel Poz Küt-2", icon: "📚", active: true },
  { href: "/panel/pozlar?lib=kut3", label: "Küt-3 (Özelim)", icon: "📗", active: true },
  { href: "/panel/personel", label: "Personel & Puantaj", icon: "👷", active: true },
  { href: "/panel/muhasebe", label: "Muhasebe", icon: "📒", active: true },
  { href: "/panel/genel-muhasebe", label: "Genel Muhasebe", icon: "📊", active: true },
  { href: "/panel/saha", label: "Saha Takibi", icon: "📸", active: true },
  { href: "/panel/3d", label: "3B Görselleştirme", icon: "🏢", active: true },
  { href: "/panel/plan3d", label: "Plan → 3B Stüdyo", icon: "🧊", active: true },
  { href: "/panel/mk-ai", label: "mk_ai (Risk)", icon: "🤖", img: "/mk-ai-logo.jpg", active: true },
  { href: "/panel/bilgi", label: "Bilgi Tabanı", icon: "📚", active: true },
  { href: "/panel/yonetim", label: "Yönetim", icon: "👤", active: true },
];

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [kullanici, setKullanici] = useState<Kullanici | null>(null);
  const [yerelAd, setYerelAd] = useState<string | null>(null);
  const [kontrol, setKontrol] = useState(false);
  const [menuAcik, setMenuAcik] = useState(false);
  const [rol, setRol] = useState<Rol>("yonetici");
  const [yetkiler, setYetkiler] = useState<string[] | null>(null);

  useEffect(() => { yetkiGetir().then((y) => { setRol(y.rol); setYetkiler(y.yetkiler); }); }, [kullanici]);

  useEffect(() => {
    let iptal = false;
    const yad = yerelKullanici();
    setYerelAd(yad);
    if (supabaseVar()) {
      aktifKullanici().then((u) => {
        if (iptal) return;
        setKullanici(u);
        setKontrol(true);
        if (!u && !yad) router.replace("/giris");
      });
      const cikisAboneligi = oturumDinle((u) => setKullanici(u));
      return () => { iptal = true; cikisAboneligi(); };
    }
    // Supabase yoksa: yalnız yerel kullanıcı adı kapısı
    setKontrol(true);
    if (!yad) router.replace("/giris");
  }, [router]);

  async function cikis() {
    yerelCikis();
    setYerelAd(null);
    if (supabaseVar()) await cikisYap();
    router.replace("/giris");
  }

  const erisim = !!kullanici || !!yerelAd;
  if (!kontrol) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (!erisim) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">Giriş sayfasına yönlendiriliyor…</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Dar ekranda çekmece arka planı */}
      {menuAcik && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMenuAcik(false)} />
      )}
      {/* Kenar çubuğu — md+ sabit, dar ekranda çekmece (kaybolmaz) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-ink-950 text-white transition-transform duration-200 md:static md:translate-x-0 ${
          menuAcik ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col items-center gap-1 border-b border-white/10 px-4 py-5">
          <Link href="/" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/inspro-logo.png" alt="insPRO" className="h-24 w-auto object-contain" />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/50">Panel</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {NAV.filter((item) => menuyeYetkili(rol, item.href, yetkiler) && (item.href !== "/panel/yonetim" || rol === "yonetici")).map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMenuAcik(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-base font-semibold transition ${
                pathname === item.href ||
                (item.href === "/panel" && pathname.startsWith("/panel/proje"))
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.img} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
              ) : (
                <span>{item.icon}</span>
              )}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-sm text-white/50">
          <Link href="/tema" className="block transition hover:text-white">
            🎨 Tema Ayarları
          </Link>
          <Link href="/" className="mt-2 block transition hover:text-white">
            ← Vitrin sayfası
          </Link>
        </div>
      </aside>

      {/* İçerik */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Üst bar (mobilde logo da burada) */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMenuAcik(true)}
              aria-label="Menüyü aç"
              className="rounded-lg border border-slate-200 p-2 text-ink-900 transition hover:bg-slate-100"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/inspro-logo.png" alt="insPRO" className="h-9 w-auto object-contain" />
            </Link>
          </div>
          <div className="hidden text-sm text-slate-500 md:block">
            Hoş geldiniz 👋 — bugün{" "}
            {new Date().toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <div className="flex items-center gap-3">
            {(() => {
              const ad = kullanici?.email ?? yerelAd ?? "Kullanıcı";
              return (
                <>
                  {!kullanici && yerelAd && (
                    <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 sm:block">kayıtsız</span>
                  )}
                  <span className="hidden rounded-full bg-brand-500/15 px-2.5 py-1 text-[10px] font-bold text-brand-600 sm:block">{ROL_ETIKET[rol]}</span>
                  <span className="hidden text-xs font-semibold text-slate-600 sm:block">{ad}</span>
                  <button onClick={cikis} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600">
                    Çıkış
                  </button>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-sm font-bold uppercase text-white">
                    {ad.charAt(0)}
                  </div>
                </>
              );
            })()}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
