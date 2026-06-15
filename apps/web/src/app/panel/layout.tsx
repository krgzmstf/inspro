"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  { href: "/panel/saha", label: "Saha Takibi", icon: "📸", active: true },
  { href: "/panel/3d", label: "3B Görselleştirme", icon: "🏢", active: true },
  { href: "/panel/plan3d", label: "Plan → 3B Stüdyo", icon: "🧊", active: true },
  { href: "/panel/mk-ai", label: "mk_ai (Risk)", icon: "🤖", img: "/mk-ai-logo.jpg", active: true },
];

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Kenar çubuğu */}
      <aside className="hidden w-64 shrink-0 flex-col bg-ink-950 text-white lg:flex">
        <div className="flex flex-col items-center gap-1 border-b border-white/10 px-4 py-5">
          <Link href="/" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/inspro-logo.png" alt="insPRO" className="h-24 w-auto object-contain" />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/50">Panel</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
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
          <Link
            href="/panel"
            className="text-lg font-extrabold tracking-tight text-ink-900 lg:hidden"
          >
            ins<span className="text-brand-500">PRO</span>
          </Link>
          <div className="hidden text-sm text-slate-500 lg:block">
            Hoş geldiniz 👋 — bugün{" "}
            {new Date().toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
              DEMO — veriler bu tarayıcıda saklanır
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white">
              K
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
