/* ──────────────────────────────────────────────────────────
   insPRO — Muhasebe (gelir / gider) veri katmanı

   Her kayıt bir projeye bağlı. Gelir ve gider kalemleri ayrı
   kategorilerle tutulur; bakiye (gelir − gider) ve bütçe vs
   gerçekleşen karşılaştırması için temel oluşturur.

   Geçici: localStorage. Supabase'e geçişte tek bu katman döner.
   ────────────────────────────────────────────────────────── */

export type KayitTipi = "gelir" | "gider";

export const GIDER_KATEGORILERI = [
  "Malzeme", "İşçilik", "Taşeron / Hakediş", "Makine - Ekipman",
  "Nakliye", "Ruhsat / Harç", "Abonelik (su/elektrik/gaz)",
  "Genel Gider", "Diğer",
] as const;

export const GELIR_KATEGORILERI = [
  "Daire Satışı", "Kapora / Avans", "Hakediş Tahsilatı",
  "Kira Geliri", "Kat Karşılığı", "Diğer",
] as const;

export interface MuhasebeKayit {
  id: string;
  projectId: string;
  tip: KayitTipi;
  kategori: string;
  aciklama: string;
  taraf: string;       // tedarikçi / müşteri / usta adı
  tutar: number;       // ₺
  tarih: string;       // ISO (gün)
  createdAt: string;
}

const STORAGE_KEY = "inspro-muhasebe";

function loadAll(): MuhasebeKayit[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(kayitlar: MuhasebeKayit[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kayitlar));
}

export function loadMuhasebe(projectId: string): MuhasebeKayit[] {
  return loadAll()
    .filter((k) => k.projectId === projectId)
    .sort((a, b) => b.tarih.localeCompare(a.tarih)); // yeniden eskiye
}

export function addMuhasebe(data: Omit<MuhasebeKayit, "id" | "createdAt">): MuhasebeKayit {
  const kayit: MuhasebeKayit = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  saveAll([...loadAll(), kayit]);
  return kayit;
}

export function deleteMuhasebe(id: string) {
  saveAll(loadAll().filter((k) => k.id !== id));
}

export interface MuhasebeOzet {
  toplamGelir: number;
  toplamGider: number;
  bakiye: number;
  giderKategorileri: { kategori: string; tutar: number }[];
  gelirKategorileri: { kategori: string; tutar: number }[];
}

export function muhasebeOzeti(kayitlar: MuhasebeKayit[]): MuhasebeOzet {
  const giderMap = new Map<string, number>();
  const gelirMap = new Map<string, number>();
  let toplamGelir = 0;
  let toplamGider = 0;

  for (const k of kayitlar) {
    if (k.tip === "gelir") {
      toplamGelir += k.tutar;
      gelirMap.set(k.kategori, (gelirMap.get(k.kategori) ?? 0) + k.tutar);
    } else {
      toplamGider += k.tutar;
      giderMap.set(k.kategori, (giderMap.get(k.kategori) ?? 0) + k.tutar);
    }
  }

  const sirala = (m: Map<string, number>) =>
    [...m.entries()].map(([kategori, tutar]) => ({ kategori, tutar })).sort((a, b) => b.tutar - a.tutar);

  return {
    toplamGelir,
    toplamGider,
    bakiye: toplamGelir - toplamGider,
    giderKategorileri: sirala(giderMap),
    gelirKategorileri: sirala(gelirMap),
  };
}
