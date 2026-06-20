/* ──────────────────────────────────────────────────────────
   insPRO — İşlem (denetim) kaydı

   Kim ne yaptı: oluşturma / silme / içe aktarma / ödeme gibi
   anlamlı eylemler Supabase `islem_log` tablosuna yazılır.
   • Ateşle-unut: arayüzü ASLA bloklamaz, hata sessizce yutulur.
   • Oturum yoksa (DEMO/yerel) loglama yapılmaz.
   • Web + mobil (Capacitor) ortak çalışır; platform da kaydedilir.
   Süper adminler bu kayıtları /panel/loglar panelinden görür.
   ────────────────────────────────────────────────────────── */

import { supabase } from "@/lib/supabase/client";
import { nativeMi } from "@/lib/apiTaban";

export type LogEylem =
  | "olustur" | "guncelle" | "sil" | "ice-aktar" | "odeme" | "giris" | "cikis" | "indir";

let _platform: string | null = null;
function platform(): string {
  if (_platform) return _platform;
  if (typeof window === "undefined") { _platform = "server"; return _platform; }
  try {
    const c = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    _platform = (c?.getPlatform?.()) || (nativeMi() ? "native" : "web");
  } catch { _platform = "web"; }
  return _platform;
}

/** Anlamlı bir işlemi denetim günlüğüne yazar (ateşle-unut). */
export function islemKaydet(
  eylem: LogEylem,
  modul: string,
  kayit?: string,
  detay?: Record<string, unknown>,
): void {
  void (async () => {
    try {
      const sb = supabase();
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      const u = session?.user;
      if (!u) return; // yalnız gerçek oturumlu kullanıcılar loglanır
      await sb.from("islem_log").insert({
        kullanici_id: u.id,
        email: u.email ?? null,
        eylem,
        modul,
        kayit: kayit ? kayit.slice(0, 200) : null,
        detay: detay ?? null,
        platform: platform(),
      });
    } catch { /* sessiz — log kaybı işlemi etkilemez */ }
  })();
}
