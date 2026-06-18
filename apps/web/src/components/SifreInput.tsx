"use client";

/* ──────────────────────────────────────────────────────────
   insPRO — Şifre girişi (göster/gizle + yazarken anlık görünme)

   • Sağdaki göz butonu: şifreyi sürekli göster/gizle.
   • Yazarken: her tuşta şifre ~1 saniye görünür, sonra tekrar gizlenir
     (mobil klavye gibi — yazdığını görürsün).
   ────────────────────────────────────────────────────────── */

import { useRef, useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function SifreInput({ className = "", onChange, ...rest }: Props) {
  const [goster, setGoster] = useState(false); // göz butonu (kalıcı)
  const [peek, setPeek] = useState(false); // yazarken anlık
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function degisti(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e);
    setPeek(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPeek(false), 1000);
  }

  return (
    <div className="relative">
      <input
        {...rest}
        type={goster || peek ? "text" : "password"}
        onChange={degisti}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setGoster((v) => !v)}
        tabIndex={-1}
        aria-label={goster ? "Şifreyi gizle" : "Şifreyi göster"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-ink-800"
      >
        {goster ? (
          // göz-kapalı (gizle)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          // göz-açık (göster)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
