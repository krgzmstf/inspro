"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Native mobil alt gezinme çubuğu (WhatsApp/Instagram tarzı).
    Sadece Capacitor uygulamasında gösterilir (panel layout karar verir). */
const OGELER = [
  { href: "/panel", label: "Projeler", icon: "🏗️" },
  { href: "/panel/mk-ai", label: "mk_ai", icon: "🤖" },
  { href: "/panel/sohbet", label: "Sohbet", icon: "💬" },
  { href: "/panel/ayarlar", label: "Ayarlar", icon: "⚙️" },
];

export default function AltNav({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const aktifMi = (href: string) =>
    href === "/panel"
      ? pathname === "/panel" || pathname.startsWith("/panel/proje")
      : pathname === href;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {OGELER.map((o) => {
        const aktif = aktifMi(o.href);
        return (
          <Link key={o.href} href={o.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition ${aktif ? "text-brand-600" : "text-slate-400"}`}>
            <span className={`text-xl leading-none transition ${aktif ? "scale-110" : ""}`}>{o.icon}</span>
            {o.label}
          </Link>
        );
      })}
      <button onClick={onMenu}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold text-slate-400 transition active:text-brand-600">
        <span className="text-xl leading-none">☰</span>
        Menü
      </button>
    </nav>
  );
}
