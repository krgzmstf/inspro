/* ──────────────────────────────────────────────────────────
   insPRO — Personel (çalışan listesi) + Puantaj veri katmanı

   • Personel: ad/soyad, TC, tel, adres, görev, yevmiye, SGK
     giriş/çıkış, IBAN vb. — projeye (binaya) bağlı.
   • Puantaj: aylık gün gün devam (tam / yarım / yok); yevmiye
     ile toplam işçilik maliyeti hesaplanır.

   Geçici: localStorage.
   ────────────────────────────────────────────────────────── */

export const PERSONEL_TURLERI = [
  "Çalışan", "Taşeron / Usta", "Mühendis", "Mimar", "Şantiye Şefi", "Müşavir", "Diğer",
] as const;

export interface Personel {
  id: string;
  projectId: string;
  tur?: string;        // Çalışan / Taşeron / Mühendis…
  firma?: string;      // bağlı olduğu firma (rehberden)
  ad: string;
  soyad: string;
  tc: string;
  telefon: string;
  adres: string;
  gorev: string;       // meslek / pozisyon
  yevmiye: number;     // günlük ücret ₺
  sgkGiris: string;    // ISO gün
  sgkCikis: string;    // ISO gün (boş = aktif)
  iban: string;
  iseGiris: string;    // ISO gün
  aktif: boolean;
  not: string;
}

export type PuantajDeger = 1 | 0.5 | 0; // tam / yarım / yok (gelmedi)

export interface PuantajKaydi {
  personelId: string;
  projectId: string;
  tarih: string;       // YYYY-MM-DD
  deger: PuantajDeger;
}

const PERSONEL_KEY = "inspro-personel";
const PUANTAJ_KEY = "inspro-puantaj";

function pLoad(): Personel[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(PERSONEL_KEY) || "[]"); } catch { return []; }
}
function pSave(list: Personel[]) { localStorage.setItem(PERSONEL_KEY, JSON.stringify(list)); }

export function loadPersonel(projectId: string): Personel[] {
  return pLoad()
    .filter((p) => p.projectId === projectId)
    .sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr"));
}

export function bosPersonel(projectId: string): Personel {
  return {
    id: crypto.randomUUID(), projectId,
    tur: "Çalışan", firma: "",
    ad: "", soyad: "", tc: "", telefon: "", adres: "", gorev: "",
    yevmiye: 0, sgkGiris: "", sgkCikis: "", iban: "", iseGiris: "",
    aktif: true, not: "",
  };
}

export function savePersonel(p: Personel) {
  const list = pLoad();
  const i = list.findIndex((x) => x.id === p.id);
  if (i >= 0) list[i] = p;
  else list.push(p);
  pSave(list);
}

export function deletePersonel(id: string) {
  pSave(pLoad().filter((p) => p.id !== id));
  // ilgili puantaj kayıtlarını da temizle
  savePuantajAll(loadPuantajAll().filter((k) => k.personelId !== id));
}

/* ── Puantaj ── */
function loadPuantajAll(): PuantajKaydi[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(PUANTAJ_KEY) || "[]"); } catch { return []; }
}
function savePuantajAll(list: PuantajKaydi[]) { localStorage.setItem(PUANTAJ_KEY, JSON.stringify(list)); }

/** Bir ayın puantaj kayıtlarını döndürür: harita "personelId_tarih" → deger. */
export function loadPuantajAy(projectId: string, ay: string): Map<string, PuantajDeger> {
  const m = new Map<string, PuantajDeger>();
  for (const k of loadPuantajAll()) {
    if (k.projectId === projectId && k.tarih.startsWith(ay)) m.set(`${k.personelId}_${k.tarih}`, k.deger);
  }
  return m;
}

/** Bir günün değerini ayarlar (null → kaydı sil). */
export function setPuantaj(projectId: string, personelId: string, tarih: string, deger: PuantajDeger | null) {
  const list = loadPuantajAll().filter((k) => !(k.personelId === personelId && k.tarih === tarih));
  if (deger !== null) list.push({ projectId, personelId, tarih, deger });
  savePuantajAll(list);
}

/** Aydaki gün listesi (1..N). */
export function ayinGunleri(ay: string): string[] {
  const [y, m] = ay.split("-").map(Number);
  const adet = new Date(y, m, 0).getDate();
  return Array.from({ length: adet }, (_, i) => `${ay}-${String(i + 1).padStart(2, "0")}`);
}

/** Bir personelin aydaki toplam puantaj günü. */
export function personelGun(harita: Map<string, PuantajDeger>, personelId: string, gunler: string[]): number {
  return gunler.reduce((s, g) => s + (harita.get(`${personelId}_${g}`) ?? 0), 0);
}
