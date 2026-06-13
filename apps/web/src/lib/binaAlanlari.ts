/* ──────────────────────────────────────────────────────────
   insPRO — Bina / bölüm metraj alan şemaları (veri-tabanlı)

   Her bölüm tipi ve bina paneli için alan listeleri burada
   tanımlanır; arayüz bunları generic olarak render eder.
   Yeni alan eklemek = buraya bir satır eklemek.
   ────────────────────────────────────────────────────────── */

import type { ApartmentType } from "@/lib/projects";

export interface AlanTanim {
  key: string;
  label: string;
  birim?: string;
}

export interface SecimTanim {
  key: string;
  label: string;
  secenekler: { value: string; label: string }[];
}

/* ── Daire / dükkan / depo / sığınak / yönetim / kapıcı: iç metraj ── */
export const DAIRE_DETAY: AlanTanim[] = [
  { key: "priz", label: "Priz", birim: "ad" },
  { key: "musluk", label: "Musluk", birim: "ad" },
  { key: "klozet", label: "Klozet", birim: "ad" },
  { key: "kapi", label: "Kapı", birim: "ad" },
  { key: "mutfakTezgah", label: "Mutfak Tezgah", birim: "mt" },
  { key: "mutfakUstDolap", label: "Mutfak Üst Dolap", birim: "mt" },
  { key: "mutfakAltDolap", label: "Mutfak Alt Dolap", birim: "mt" },
  { key: "dusakabin", label: "Duşakabin", birim: "m²" },
  { key: "parke", label: "Parke", birim: "m²" },
  { key: "yerFayansi", label: "Yer Fayansı", birim: "m²" },
  { key: "duvarFayansi", label: "Duvar Fayansı", birim: "m²" },
  { key: "duvar", label: "Duvar", birim: "m²" },
  { key: "alci", label: "Alçı", birim: "m²" },
  { key: "alciKoseIsikBandi", label: "Alçı Köşe / Işık Bandı", birim: "mt" },
  { key: "elkIsikHatti", label: "Elektrik Işık Hattı", birim: "mt" },
  { key: "ledLamba", label: "LED Lamba", birim: "ad" },
  { key: "armatur", label: "Armatür", birim: "ad" },
  { key: "banyoMusluk", label: "Banyo Musluk", birim: "ad" },
  { key: "taharetMusluk", label: "Taharet Musluk", birim: "ad" },
  { key: "kombi", label: "Kombi", birim: "ad" },
  { key: "isitmaAlan", label: "Radyatör / Yerden Isıtma", birim: "m²" },
  { key: "duvarKagidi", label: "Duvar Kağıdı", birim: "m²" },
  { key: "tvUnite", label: "TV Ünite", birim: "ad" },
  { key: "vestiyer", label: "Vestiyer", birim: "m²" },
  { key: "soyunmaDolabi", label: "Soyunma Odası Dolabı", birim: "ad" },
  { key: "ankastreSet", label: "Ankastre Set", birim: "set" },
  { key: "balkonAdet", label: "Balkon", birim: "ad" },
  { key: "balkonAlan", label: "Balkon Alanı", birim: "m²" },
  { key: "balkonKapisi", label: "Balkon Kapısı", birim: "ad" },
  { key: "wcLavabo", label: "WC Lavabo", birim: "ad" },
  { key: "banyoLavabo", label: "Banyo Lavabo", birim: "ad" },
  { key: "banyoDolap", label: "Banyo Dolap", birim: "ad" },
  { key: "fayansSupurgelik", label: "Fayans Süpürgelik", birim: "mt" },
  { key: "parkeSupurgelik", label: "Parke Süpürgelik", birim: "mt" },
];

/* ── Elektrik odası ── */
export const ELEKTRIK_ODASI: AlanTanim[] = [
  { key: "anaKabloMt", label: "Ana Kablo", birim: "mt" },
  { key: "elektrikSaati", label: "Elektrik Saati", birim: "ad" },
  { key: "tms", label: "TMŞ", birim: "ad" },
  { key: "kacakAkimRolesi", label: "Kaçak Akım Rölesi", birim: "ad" },
  { key: "ucluSigorta", label: "3'lü Sigorta", birim: "ad" },
  { key: "tekliSigorta", label: "Tekli Sigorta", birim: "ad" },
  { key: "kablo1Mt", label: "Kablo 1", birim: "mt" },
  { key: "kablo2Mt", label: "Kablo 2", birim: "mt" },
  { key: "kablo3Mt", label: "Kablo 3", birim: "mt" },
  { key: "kablo4Mt", label: "Kablo 4", birim: "mt" },
  { key: "elkBetonBorusu", label: "Elektrik Beton Borusu", birim: "mt" },
];

/* ── Su odası ── */
export const SU_ODASI: AlanTanim[] = [
  { key: "suSaati", label: "Su Saati", birim: "ad" },
  { key: "vana", label: "Vana", birim: "ad" },
  { key: "boru20", label: "20'lik Boru", birim: "mt" },
  { key: "boru25", label: "25'lik Boru", birim: "mt" },
  { key: "boru30", label: "30'luk Boru", birim: "mt" },
  { key: "anaSuBorusu", label: "Ana Su Borusu", birim: "mt" },
  { key: "anaVana", label: "Ana Vana", birim: "ad" },
  { key: "yerdenIsitmaBorusu", label: "Yerden Isıtma Borusu", birim: "mt" },
  { key: "suDeposuAdet", label: "Su Deposu", birim: "ad" },
  { key: "suDeposuTon", label: "Su Deposu Hacmi", birim: "ton" },
  { key: "hidrofor", label: "Hidrofor", birim: "ad" },
];

/* ── Kazan dairesi ── */
export const KAZAN_DAIRESI: AlanTanim[] = [
  { key: "kazan", label: "Kazan", birim: "ad" },
  { key: "kazanKapasite", label: "Kazan Kapasitesi", birim: "kcal" },
];

/* Hangi tip hangi şemayı kullanır */
export function detaySemasi(tip: ApartmentType): AlanTanim[] {
  switch (tip) {
    case "elektrik": return ELEKTRIK_ODASI;
    case "su": return SU_ODASI;
    case "kazan": return KAZAN_DAIRESI;
    default: return DAIRE_DETAY; // daire/dükkan/depo/sığınak/yönetim/kapıcı/ofis…
  }
}

/* Pencere doğrama tipleri */
export const DOGRAMA_TIPLERI: { value: string; label: string }[] = [
  { value: "pvc", label: "PVC Doğrama" },
  { value: "aluminyum", label: "Alüminyum Doğrama" },
  { value: "ahsap", label: "Ahşap Doğrama" },
];

/* ════════════ BİNA ANA KALEM ════════════ */
export const BINA_ANA_KALEM: AlanTanim[] = [
  { key: "disCephe", label: "Dış Cephe", birim: "m²" },
  { key: "disCepheMalzemeM2", label: "Dış Cephe Kaplama", birim: "m²" },
  { key: "santiyeOdasi", label: "Şantiye Odası", birim: "ad" },
  { key: "santiyeSuyu", label: "Şantiye Suyu (abonelik)", birim: "ad" },
  { key: "santiyeElektrigi", label: "Şantiye Elektriği (abonelik)", birim: "ad" },
  { key: "toplamKazi", label: "Toplam Kazı", birim: "m³" },
  { key: "dolgu", label: "Dolgu", birim: "m³" },
  { key: "toplamBeton", label: "Toplam Beton", birim: "m³" },
  { key: "demir", label: "Demir", birim: "kg" },
  { key: "ahsapKereste", label: "Ahşap Kereste", birim: "m³" },
  { key: "ahsapPlaywood", label: "Ahşap Playwood", birim: "ad" },
  { key: "suYalitim", label: "Su Yalıtımı", birim: "m²" },
  { key: "grobeton", label: "Grobeton", birim: "m³" },
  { key: "temel", label: "Temel", birim: "m²" },
  { key: "temelPerde", label: "Temel Perde", birim: "m²" },
  { key: "binaOnuM2", label: "Bina Önü Kaplama", birim: "m²" },
  { key: "binaAnaGirisKapisi", label: "Bina Ana Giriş Kapısı", birim: "ad" },
  { key: "dogalgazBoruHatti", label: "Doğalgaz Boru Hattı", birim: "mt" },
  { key: "dogalgazAnaBoruHatti", label: "Doğalgaz Ana Boru Hattı", birim: "mt" },
  { key: "toplamCelikKapi", label: "Toplam Çelik Kapı", birim: "ad" },
  { key: "toplamDemirKapi", label: "Toplam Demir Kapı", birim: "ad" },
  { key: "catiBacalar", label: "Çatı Bacaları", birim: "ad" },
  { key: "catiYagmurOluklari", label: "Çatı Yağmur Olukları", birim: "mt" },
  { key: "yagmurInisBorulari", label: "Yağmur İniş Boruları", birim: "mt" },
  { key: "catiOrtusuM2", label: "Çatı Örtüsü", birim: "m²" },
];

/* Bina ana kalem — cins/malzeme seçimleri */
export const BINA_ANA_KALEM_SECIM: SecimTanim[] = [
  {
    key: "disCepheMalzeme", label: "Dış Cephe Malzemesi",
    secenekler: [
      { value: "betopan", label: "Betopan" }, { value: "alcipan", label: "Alçıpan" },
      { value: "mermer", label: "Mermer" }, { value: "strafor", label: "Strafor/EPS" },
      { value: "cs", label: "CS Panel" }, { value: "tas", label: "Doğal Taş" },
    ],
  },
  {
    key: "binaOnuMalzeme", label: "Bina Önü Zemin",
    secenekler: [
      { value: "andezit", label: "Andezit Taşı" }, { value: "kilitparke", label: "Kilit Parke" },
      { value: "granit", label: "Granit" }, { value: "mermer", label: "Mermer" },
      { value: "beton", label: "Beton" },
    ],
  },
  {
    key: "merdivenKorkuluk", label: "Merdiven Korkuluğu",
    secenekler: [
      { value: "ferforje", label: "Ferforje" }, { value: "paslanmaz", label: "Paslanmaz Çelik" },
      { value: "aluminyum", label: "Alüminyum" }, { value: "ahsap", label: "Ahşap" },
      { value: "cam", label: "Cam" },
    ],
  },
  {
    key: "balkonKorkuluk", label: "Balkon Korkuluğu",
    secenekler: [
      { value: "ferforje", label: "Ferforje" }, { value: "paslanmaz", label: "Paslanmaz Çelik" },
      { value: "aluminyum", label: "Alüminyum" }, { value: "cam", label: "Cam" },
    ],
  },
  {
    key: "kupeste", label: "Küpeşte",
    secenekler: [
      { value: "ahsap", label: "Ahşap" }, { value: "paslanmaz", label: "Paslanmaz" },
      { value: "mermer", label: "Mermer" }, { value: "kompozit", label: "Kompozit" },
    ],
  },
  {
    key: "catiOrtusu", label: "Çatı Örtüsü",
    secenekler: [
      { value: "kiremit", label: "Kiremit" }, { value: "kenetsac", label: "Kenet Sac" },
      { value: "betonkiremit", label: "Beton Kiremit" }, { value: "ondulin", label: "Ondülin" },
      { value: "singil", label: "Şıngıl" },
    ],
  },
];

/* Kat holü malzeme seçenekleri (her kat için) */
export const HOL_MALZEME: { value: string; label: string }[] = [
  { value: "mermer", label: "Mermer" },
  { value: "fayans", label: "Fayans" },
  { value: "granit", label: "Granit" },
  { value: "parke", label: "Parke" },
];

/* ════════════ BİNA İŞÇİLİKLERİ (çoktan seçmeli) ════════════ */
export const ISCILIK_KALEMLERI: string[] = [
  "Kalıp", "Demir", "Beton", "Kazı", "Kanal", "Duvar", "Sıva", "Şap",
  "Alçı", "Boya", "Fayans", "Mermer", "Taş", "Granit", "Parke",
  "Elektrik", "Su Tesisatı", "Tesisatçı", "Boru Hattı", "Doğalgaz",
  "Marangoz", "Dolap", "Mutfak Tezgahı", "TV Ünite", "Vestiyer Ustası",
  "Çatı Ustası", "Demir Korkuluk", "PVC Doğrama", "Ahşap Doğrama",
  "Duvar Kağıdı", "Mobilya", "Kamera / Güvenlik", "Asansör",
];
