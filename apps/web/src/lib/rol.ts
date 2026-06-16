/* ──────────────────────────────────────────────────────────
   insPRO — Rol yönetimi (RBAC)

   Roller: sahip/ofis (web, tam) · şantiye şefi · taşeron/usta.
   Her rolün görebileceği menüler ROL_MENU'de. Rol, giriş yapan
   kullanıcının profiles.rol alanından gelir (yoksa "sahip").
   Rol ataması şimdilik Supabase Studio'dan (profiles.rol) yapılır;
   ileride "Ekip" ekranı + davet ile yönetilecek.
   ────────────────────────────────────────────────────────── */

import { supabase } from "./supabase/client";

export type Rol = "sahip" | "ofis" | "sefi" | "usta";

export const ROL_ETIKET: Record<Rol, string> = {
  sahip: "Sahip / Yönetici",
  ofis: "Ofis",
  sefi: "Şantiye Şefi",
  usta: "Taşeron / Usta",
};

/** Her rolün erişebileceği menü yolları ("*" = tümü). */
export const ROL_MENU: Record<Rol, string[] | "*"> = {
  sahip: "*",
  ofis: "*",
  sefi: ["/panel", "/panel/is-surecleri", "/panel/saha", "/panel/metraj", "/panel/personel", "/panel/mk-ai", "/panel/bilgi"],
  usta: ["/panel", "/panel/is-surecleri", "/panel/saha"],
};

const KEY = "inspro-rol";

export function yerelRol(): Rol {
  if (typeof window === "undefined") return "sahip";
  const r = localStorage.getItem(KEY);
  return r === "ofis" || r === "sefi" || r === "usta" ? r : "sahip";
}

/** Aktif kullanıcının rolünü getirir (Supabase profilinden; yoksa sahip). */
export async function rolGetir(): Promise<Rol> {
  try {
    const sb = supabase();
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const { data } = await sb.from("profiles").select("rol").eq("id", session.user.id).maybeSingle();
        const r = data?.rol;
        const gecerli: Rol = r === "ofis" || r === "sefi" || r === "usta" ? r : "sahip";
        localStorage.setItem(KEY, gecerli);
        return gecerli;
      }
    }
  } catch { /* sessiz */ }
  return yerelRol(); // kayıtsız/yerel giriş → sahip
}

export function menuyeYetkili(rol: Rol, href: string): boolean {
  const izin = ROL_MENU[rol];
  if (izin === "*") return true;
  const path = href.split("?")[0];
  return izin.some((h) => path === h || path.startsWith(h + "/"));
}
