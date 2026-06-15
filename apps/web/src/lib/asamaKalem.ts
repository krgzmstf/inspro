/* ──────────────────────────────────────────────────────────
   insPRO — Yol Haritası aşama kalemleri (alt iş adımları)

   13 aşamalı inşaat yol haritasının (projects.PHASE_NAMES) her
   aşamasının içine sıralı iş kalemleri açılır. Her kalem bir
   (projectId + aşama adı) çiftine bağlıdır; sıra (sira) ile
   düzenlenir, durum (bekliyor/devam/tamam) ile takip edilir.

   Her aşama için sektör pratiğine uygun VARSAYILAN şablon vardır;
   kullanıcı "Varsayılan kalemleri yükle" ile başlatır, sonra
   ekler/çıkarır/sıralar.

   Geçici: localStorage. Supabase'e geçişte tek bu katman döner.
   ────────────────────────────────────────────────────────── */

export type KalemDurum = "bekliyor" | "devam" | "tamam";

export interface AsamaKalem {
  id: string;
  projectId: string;
  asama: string;       // PHASE_NAMES'ten aşama adı
  ad: string;
  sira: number;        // aşama içi sıra (1..n)
  durum: KalemDurum;
  baslangic?: string;  // ISO gün (YYYY-MM-DD) — planlamada girilir
  bitis?: string;      // ISO gün — onaylanırken (iş bitince) girilir
  personelId?: string; // Personel modülündeki kişiye bağlantı
  personelAd?: string; // görüntü için ad-soyad anlık kopyası
  fiyat?: number;      // bu kalemin planlanan bedeli (₺)
  alinan?: number;     // ödenen / alınan tutar (₺)
  odendi?: boolean;    // true: Ödendi, değilse Bekliyor
  not?: string;
}

const STORAGE_KEY = "inspro-asama-kalem";

/** Her aşama için varsayılan iş sırası şablonu. */
export const VARSAYILAN_KALEMLER: Record<string, string[]> = {
  "Zemin Etüdü & Ruhsat": [
    "Aplikasyon krokisi",
    "İmar durum belgesi",
    "Yol kotu tutanağı",
    "Aplikasyon projesi",
    "Mimari proje",
    "Statik proje",
    "Sıhhi tesisat projesi",
    "Elektrik tesisat projesi",
    "Peyzaj mimari projesi",
    "Zemin etüt raporu",
    "Numarataj",
    "Yol ücretleri",
    "Şantiye şefi ataması",
    "Yapı denetim sözleşmesi",
    "ASKİ harcı",
    "Toprak (hafriyat) harcı",
    "Belediye ruhsat başvurusu",
  ],
  "Şantiye Kurulumu": [
    "Şantiye sahası temizliği",
    "Şantiye binası / konteyner kurulumu",
    "Çevre güvenlik çiti & uyarı levhaları",
    "Geçici elektrik ve su aboneliği",
    "Kule vinç / vinç kurulumu",
    "İSG levhaları & saha planı",
    "Saha aplikasyonu (zemin işaretleme)",
  ],
  "Kazı & İksa": [
    "Hafriyat ruhsatı & döküm sahası onayı",
    "Kazı (hafriyat) çalışması",
    "İksa / istinat (şoring) imalatı",
    "Fore kazık / mini kazık (gerekiyorsa)",
    "Su tahliyesi & kazı emniyeti",
    "Temel kotu kontrolü",
  ],
  "Temel & Yalıtım": [
    "Grobeton (temel altı tesviye betonu)",
    "Temel kalıbı",
    "Temel donatısı (demir) montajı",
    "Topraklama bakır şeridi yerleşimi",
    "Temel su yalıtımı",
    "Temel betonu dökümü & numune",
    "Perde/bohça yalıtımı & drenaj",
  ],
  "Kaba Yapı": [
    "Kolon / perde kalıp-demir-beton",
    "Döşeme kalıp-demir-beton",
    "Merdiven betonu",
    "Asansör kuyusu imalatı",
    "Kat kat yükselme & kot kontrolü",
    "Beton numune & basınç testi",
  ],
  "Çatı": [
    "Eğim (şap) betonu",
    "Su yalıtımı (membran)",
    "Isı yalıtımı",
    "Çatı örtüsü (kiremit / sandviç panel)",
    "Dere, ineş & baca çıkışları",
  ],
  "Duvarlar & Şap": [
    "İç ve dış duvar örümü",
    "Kapı / pencere kasaları",
    "Tesisat öncesi kaba imalat (kanal/kırım)",
    "Şap dökümü",
    "Asansör montaj hazırlığı",
  ],
  "Mekanik Tesisat": [
    "Sıhhi tesisat boru hatları",
    "Isıtma (kombi / kalorifer) tesisatı",
    "Doğalgaz tesisatı",
    "Yangın tesisatı",
    "Havalandırma / iklimlendirme",
    "Basınç testi & deneme",
  ],
  "Elektrik Tesisatı": [
    "Kablo borusu / kablo tavası",
    "Pano & dağıtım sistemi",
    "Kablolama (güç & priz)",
    "Zayıf akım (data / TV / interkom)",
    "Topraklama & paratoner",
    "Aydınlatma armatürleri",
    "Test & ölçüm (topraklama raporu)",
  ],
  "Alçı · Sıva · Boya": [
    "İç sıva / alçı sıva",
    "Saten / macun",
    "Astar",
    "Asma tavan",
    "Seramik / fayans kaplama",
    "Zemin kaplama (parke / seramik)",
    "Son kat boya",
  ],
  "Dış Cephe & İskele": [
    "İskele kurulumu",
    "Dış cephe sıva / mantolama",
    "Denizlik & söve imalatı",
    "Pencere & doğrama montajı",
    "Dış cephe boya / kaplama",
    "İskele söküm",
  ],
  "Çevre Düzenleme": [
    "İstinat & çevre duvarı",
    "Otopark & site içi yollar",
    "Peyzaj / bahçe düzenlemesi",
    "Site içi aydınlatma",
    "Altyapı bağlantıları (yağmur/atık su)",
    "Bahçe kapısı & güvenlik",
  ],
  "İskan & Teslim": [
    "Genel temizlik",
    "Eksik & kusur listesi (punch list)",
    "Asansör tescili & muayene",
    "Kalıcı abonelikler (elektrik/su/gaz)",
    "İskan (yapı kullanma izni) başvurusu",
    "Garanti / kullanım belgeleri dosyası",
    "Anahtar teslimi",
  ],
};

function loadAll(): AsamaKalem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(kalemler: AsamaKalem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kalemler));
}

/** Bir aşamanın kalemlerini sıraya göre döndürür. */
export function loadAsamaKalemleri(projectId: string, asama: string): AsamaKalem[] {
  return loadAll()
    .filter((k) => k.projectId === projectId && k.asama === asama)
    .sort((a, b) => a.sira - b.sira);
}

export function addAsamaKalem(
  projectId: string, asama: string, ad: string,
): AsamaKalem {
  const mevcut = loadAsamaKalemleri(projectId, asama);
  const sira = mevcut.length ? Math.max(...mevcut.map((k) => k.sira)) + 1 : 1;
  const kalem: AsamaKalem = {
    id: crypto.randomUUID(), projectId, asama, ad: ad.trim(), sira,
    durum: "bekliyor",
  };
  saveAll([...loadAll(), kalem]);
  return kalem;
}

export function updateAsamaKalem(id: string, patch: Partial<AsamaKalem>) {
  saveAll(loadAll().map((k) => (k.id === id ? { ...k, ...patch } : k)));
}

export function deleteAsamaKalem(id: string) {
  saveAll(loadAll().filter((k) => k.id !== id));
}

/** Kalemi listede yukarı/aşağı taşır (sira değiştirir). */
export function tasiKalem(projectId: string, asama: string, id: string, yon: -1 | 1) {
  const liste = loadAsamaKalemleri(projectId, asama);
  const idx = liste.findIndex((k) => k.id === id);
  const hedef = idx + yon;
  if (idx < 0 || hedef < 0 || hedef >= liste.length) return;
  // sira değerlerini takas et
  const a = liste[idx], b = liste[hedef];
  const tum = loadAll().map((k) => {
    if (k.id === a.id) return { ...k, sira: b.sira };
    if (k.id === b.id) return { ...k, sira: a.sira };
    return k;
  });
  saveAll(tum);
}

/** Aşamaya varsayılan şablon kalemlerini ekler (boşsa). */
export function varsayilanYukle(projectId: string, asama: string): AsamaKalem[] {
  const sablon = VARSAYILAN_KALEMLER[asama] ?? [];
  const mevcut = loadAsamaKalemleri(projectId, asama);
  const baslangic = mevcut.length ? Math.max(...mevcut.map((k) => k.sira)) : 0;
  const yeni: AsamaKalem[] = sablon.map((ad, i) => ({
    id: crypto.randomUUID(), projectId, asama, ad, sira: baslangic + i + 1, durum: "bekliyor",
  }));
  saveAll([...loadAll(), ...yeni]);
  return loadAsamaKalemleri(projectId, asama);
}

export interface AsamaOzet {
  toplam: number;
  tamam: number;
  devam: number;
  yuzde: number;
}

/** Bir aşamanın kalem ilerleme özeti. */
export function asamaOzeti(kalemler: AsamaKalem[]): AsamaOzet {
  const toplam = kalemler.length;
  if (toplam === 0) return { toplam: 0, tamam: 0, devam: 0, yuzde: 0 };
  let puan = 0, tamam = 0, devam = 0;
  for (const k of kalemler) {
    if (k.durum === "tamam") { puan += 1; tamam++; }
    else if (k.durum === "devam") { puan += 0.5; devam++; }
  }
  return { toplam, tamam, devam, yuzde: Math.round((puan / toplam) * 100) };
}

/** Bir aşamadaki kalemlerin toplam bedeli (₺). */
export function asamaToplamFiyat(kalemler: AsamaKalem[]): number {
  return kalemler.reduce((s, k) => s + (k.fiyat ?? 0), 0);
}

/** Bir aşamadaki toplam alınan/ödenen tutar (₺). */
export function asamaToplamAlinan(kalemler: AsamaKalem[]): number {
  return kalemler.reduce((s, k) => s + (k.alinan ?? 0), 0);
}

/** Projenin tüm aşama kalemlerini aşamaya göre gruplar (takip sayfası için). */
export function projeTumKalemler(projectId: string): Record<string, AsamaKalem[]> {
  const grup: Record<string, AsamaKalem[]> = {};
  for (const k of loadAll().filter((x) => x.projectId === projectId)) {
    (grup[k.asama] ??= []).push(k);
  }
  for (const asama of Object.keys(grup)) grup[asama].sort((a, b) => a.sira - b.sira);
  return grup;
}

/** Tüm aşamaların kalem sayıları (kart rozetleri için). */
export function projeAsamaSayilari(projectId: string): Record<string, AsamaOzet> {
  const tum = loadAll().filter((k) => k.projectId === projectId);
  const grup = new Map<string, AsamaKalem[]>();
  for (const k of tum) {
    const arr = grup.get(k.asama) ?? [];
    arr.push(k);
    grup.set(k.asama, arr);
  }
  const sonuc: Record<string, AsamaOzet> = {};
  for (const [asama, kalemler] of grup) sonuc[asama] = asamaOzeti(kalemler);
  return sonuc;
}
