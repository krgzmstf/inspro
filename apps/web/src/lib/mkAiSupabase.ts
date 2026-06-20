/* ──────────────────────────────────────────────────────────
   mk_ai — Supabase canlı veri kaynağı (agentic araç için)

   Kullanıcının access token'ıyla (RLS korumalı — yalnız kendi verisi)
   Supabase'den hesap geneli özet çeker: projeler, muhasebe, modüller.
   mk_ai bu özeti "hesap_ozeti" aracıyla çağırarak gerçek veriye
   dayalı cevap verir. service_role KULLANILMAZ.
   ────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";

// Ortam değişkenine yapıştırırken boşluk/satır sonu karışabiliyor → temizle (client.ts gibi).
const temiz = (s?: string) => (s ?? "").replace(/\s+/g, "");
const envUrl = temiz(process.env.NEXT_PUBLIC_SUPABASE_URL);
const URL = envUrl.startsWith("http") ? envUrl : "https://api-inspro.yazeproje.com";
const ANON = temiz(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export interface HesapOzeti {
  baglandi: boolean;
  not?: string;
  proje_sayisi: number;
  projeler: { ad: string; sehir?: string; tip?: string; butce?: number | null }[];
  muhasebe: {
    kayit: number;
    toplam_gelir: number;
    toplam_gider: number;
    bakiye: number;
    bekleyen_odeme_sayisi: number;
    bekleyen_odeme_tutari: number;
    geciken_odeme_sayisi: number;
    geciken_odeme_tutari: number;
  };
  personel: { sayi: number; isimler: string[] };
  moduller: { ad: string; kayit_sayisi: number }[];
}

const MODUL_ETIKET: Record<string, string> = {
  metraj: "Metraj", issurecleri: "İş Süreçleri", saha: "Saha Takibi", personel: "Personel",
  puantaj: "Puantaj", teklif: "Teklif", hakedis: "Hakediş", "asama-kalem": "Aşama Kalemleri",
  "finans-hesap": "Kasa/Banka", firma: "Firma", "bilgi-tabani": "Bilgi Tabanı",
};

/** Kullanıcının token'ıyla Supabase'den hesap özetini getirir. */
export async function hesapOzeti(token: string): Promise<HesapOzeti> {
  const bos: HesapOzeti = {
    baglandi: false, proje_sayisi: 0, projeler: [],
    muhasebe: {
      kayit: 0, toplam_gelir: 0, toplam_gider: 0, bakiye: 0,
      bekleyen_odeme_sayisi: 0, bekleyen_odeme_tutari: 0,
      geciken_odeme_sayisi: 0, geciken_odeme_tutari: 0,
    },
    personel: { sayi: 0, isimler: [] },
    moduller: [],
  };
  if (!URL || !ANON || !token) return { ...bos, not: "Supabase oturumu yok." };

  try {
    const sb = createClient(URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: rows, error } = await sb.from("modul_veri").select("modul, veri");
    if (error) return { ...bos, not: "Veri okunamadı: " + error.message };

    const ozet: HesapOzeti = { ...bos, baglandi: true };
    const bugun = new Date().toISOString().slice(0, 10);
    for (const r of rows ?? []) {
      const dizi = Array.isArray(r.veri) ? (r.veri as Record<string, unknown>[]) : [];
      if (r.modul === "projects") {
        ozet.proje_sayisi = dizi.length;
        ozet.projeler = dizi.slice(0, 20).map((p) => ({
          ad: String(p.name ?? "—"), sehir: (p.city as string) ?? undefined,
          tip: (p.type as string) ?? undefined, butce: (p.budget as number) ?? null,
        }));
      } else if (r.modul === "accounting") {
        let gelir = 0, gider = 0, bekSay = 0, bekTut = 0, gecSay = 0, gecTut = 0;
        for (const k of dizi) {
          const t = Number(k.tutar ?? 0);
          if (String(k.tip) === "gider") gider += t; else gelir += t;
          const durum = String(k.durum ?? "odendi");
          if (durum !== "odendi") {
            const kalan = t - Number(k.odenen_tutar ?? 0);
            bekSay += 1; bekTut += kalan > 0 ? kalan : t;
            const vade = String(k.vade_tarihi ?? "");
            if (vade && vade < bugun) { gecSay += 1; gecTut += kalan > 0 ? kalan : t; }
          }
        }
        ozet.muhasebe = {
          kayit: dizi.length, toplam_gelir: gelir, toplam_gider: gider, bakiye: gelir - gider,
          bekleyen_odeme_sayisi: bekSay, bekleyen_odeme_tutari: bekTut,
          geciken_odeme_sayisi: gecSay, geciken_odeme_tutari: gecTut,
        };
      } else if (r.modul === "personel") {
        ozet.personel = {
          sayi: dizi.length,
          isimler: dizi.slice(0, 15).map((p) => String(p.ad ?? p.adSoyad ?? p.isim ?? "—")).filter((x) => x !== "—"),
        };
        ozet.moduller.push({ ad: MODUL_ETIKET[r.modul] ?? r.modul, kayit_sayisi: dizi.length });
      } else {
        ozet.moduller.push({ ad: MODUL_ETIKET[r.modul] ?? r.modul, kayit_sayisi: dizi.length });
      }
    }
    return ozet;
  } catch (e) {
    return { ...bos, not: "Bağlantı hatası: " + (e as Error).message };
  }
}
