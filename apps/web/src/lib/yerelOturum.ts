/* ──────────────────────────────────────────────────────────
   insPRO — Yerel (kayıtsız) oturum

   Geçici çözüm: kullanıcı kayıt olmadan sadece bir kullanıcı adı
   girerek panele girer. Ad localStorage'da tutulur. Gerçek Supabase
   Auth devreye girince bu katman yedek/DEMO girişi olarak kalır.
   ────────────────────────────────────────────────────────── */

const KEY = "inspro-kullanici";

export function yerelKullanici(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function yerelGiris(ad: string) {
  localStorage.setItem(KEY, ad.trim());
}

export function yerelCikis() {
  localStorage.removeItem(KEY);
}
