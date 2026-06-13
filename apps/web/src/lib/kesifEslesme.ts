/* ──────────────────────────────────────────────────────────
   insPRO — Otomatik Keşif: proje metrajını pozlara bağlama

   1) toplaKalemler(project): tüm bölüm/daire/bina metrajlarını
      tek listede toplar (miktar + birim + arama kelimesi).
   2) eslesPoz: kalemi ÇŞB pozuna anahtar kelime + birim uyumuyla
      eşler; SÖKME/YIKIM/TAŞIMA pozlarını cezalandırır.

   Veri seti ÇŞB İNŞAAT (yapı) cildidir; elektrik & sıhhi tesisat
   kalemleri ayrı kitaplardadır — onlar import edilene kadar
   "eşleşme yok" görünür (eşleştirme yine de tanımlıdır).
   ────────────────────────────────────────────────────────── */

import type { Project, Apartment, BuildingDetails } from "@/lib/projects";
import { type Poz, etkinFiyat } from "@/lib/pozlar";

export interface KesifKalem {
  key: string;
  proje: string;
  miktar: number;
  birim: string;
  aramaKelime: string;
  pozKod?: string; // doğrudan poza bağlıysa (ana kalem/işçilik seçimi) — bulanık eşleştirme atlanır
}

/* metraj alan anahtarı → {etiket, birim, arama kelimesi} */
const ESLESME: Record<string, { etiket: string; birim: string; ara: string }> = {
  // ── Daire iç metrajı — İNŞAAT ciltinde EŞLEŞENLER ──
  kapi: { etiket: "İç Kapı (ahşap)", birim: "ad", ara: "ahşap kapı kanat" },
  mutfakTezgah: { etiket: "Mutfak Tezgahı", birim: "mt", ara: "tezgah" },
  mutfakUstDolap: { etiket: "Mutfak Üst Dolap", birim: "mt", ara: "mutfak dolap" },
  mutfakAltDolap: { etiket: "Mutfak Alt Dolap", birim: "mt", ara: "mutfak dolap" },
  parke: { etiket: "Laminat Parke", birim: "m²", ara: "laminat parke" },
  yerFayansi: { etiket: "Yer Seramiği", birim: "m²", ara: "seramik döşeme" },
  duvarFayansi: { etiket: "Duvar Seramiği", birim: "m²", ara: "seramik duvar" },
  duvar: { etiket: "Tuğla Duvar", birim: "m²", ara: "tuğla duvar" },
  alci: { etiket: "Saten Alçı", birim: "m²", ara: "saten alçı" },
  isitmaAlan: { etiket: "Şap (ısıtma altı)", birim: "m²", ara: "şap tesviye" },
  fayansSupurgelik: { etiket: "Seramik Süpürgelik", birim: "mt", ara: "seramik süpürgelik" },
  parkeSupurgelik: { etiket: "Parke Süpürgelik", birim: "mt", ara: "parke süpürgelik" },
  dusakabin: { etiket: "Duşakabin (cam)", birim: "m²", ara: "duşakabin cam" },

  // ── Daire — TESİSAT/ELEKTRİK (bu ciltte YOK, gelecekte import) ──
  priz: { etiket: "Priz / Anahtar", birim: "ad", ara: "anahtar priz" },
  musluk: { etiket: "Batarya", birim: "ad", ara: "batarya" },
  klozet: { etiket: "Klozet", birim: "ad", ara: "klozet rezervuar" },
  ledLamba: { etiket: "LED Armatür", birim: "ad", ara: "led armatür" },
  armatur: { etiket: "Armatür", birim: "ad", ara: "aydınlatma armatür" },
  banyoMusluk: { etiket: "Banyo Bataryası", birim: "ad", ara: "banyo batarya" },
  taharetMusluk: { etiket: "Taharet Musluğu", birim: "ad", ara: "taharet" },
  kombi: { etiket: "Kombi", birim: "ad", ara: "kombi" },
  duvarKagidi: { etiket: "Duvar Kağıdı", birim: "m²", ara: "duvar kağıdı" },
  alciKoseIsikBandi: { etiket: "Kartonpiyer", birim: "mt", ara: "kartonpiyer" },
  elkIsikHatti: { etiket: "Aydınlatma Hattı", birim: "mt", ara: "aydınlatma sorti" },
  tvUnite: { etiket: "TV Ünitesi", birim: "ad", ara: "tv ünite" },
  vestiyer: { etiket: "Vestiyer", birim: "m²", ara: "vestiyer" },
  soyunmaDolabi: { etiket: "Gardırop", birim: "ad", ara: "gardırop" },
  ankastreSet: { etiket: "Ankastre Set", birim: "set", ara: "ankastre" },
  balkonKapisi: { etiket: "Balkon Kapısı (PVC)", birim: "ad", ara: "pvc kapı doğrama" },
  balkonAdet: { etiket: "Balkon", birim: "ad", ara: "balkon" },
  balkonAlan: { etiket: "Balkon Zemini", birim: "m²", ara: "seramik döşeme" },
  wcLavabo: { etiket: "WC Lavabo", birim: "ad", ara: "lavabo" },
  banyoLavabo: { etiket: "Banyo Lavabo", birim: "ad", ara: "lavabo" },
  banyoDolap: { etiket: "Banyo Dolabı", birim: "ad", ara: "banyo dolap" },

  // ── Elektrik odası (gelecekte import) ──
  anaKabloMt: { etiket: "Ana Besleme Kablosu", birim: "mt", ara: "kablo nyy" },
  elektrikSaati: { etiket: "Elektrik Sayacı", birim: "ad", ara: "sayaç" },
  tms: { etiket: "Termik Manyetik Şalter", birim: "ad", ara: "şalter" },
  kacakAkimRolesi: { etiket: "Kaçak Akım Rölesi", birim: "ad", ara: "kaçak akım" },
  ucluSigorta: { etiket: "3 Fazlı Sigorta", birim: "ad", ara: "otomatik sigorta" },
  tekliSigorta: { etiket: "Tekli Sigorta", birim: "ad", ara: "otomatik sigorta" },
  kablo1Mt: { etiket: "Kablo 1", birim: "mt", ara: "kablo nyy" },
  kablo2Mt: { etiket: "Kablo 2", birim: "mt", ara: "kablo nyy" },
  kablo3Mt: { etiket: "Kablo 3", birim: "mt", ara: "kablo nyy" },
  kablo4Mt: { etiket: "Kablo 4", birim: "mt", ara: "kablo nyy" },
  elkBetonBorusu: { etiket: "Elektrik Borusu", birim: "mt", ara: "spiral boru" },

  // ── Su odası (gelecekte import) ──
  suSaati: { etiket: "Su Sayacı", birim: "ad", ara: "su sayaç" },
  vana: { etiket: "Küresel Vana", birim: "ad", ara: "küresel vana" },
  anaVana: { etiket: "Ana Vana", birim: "ad", ara: "vana" },
  boru20: { etiket: "PPRC Boru Ø20", birim: "mt", ara: "pprc boru" },
  boru25: { etiket: "PPRC Boru Ø25", birim: "mt", ara: "pprc boru" },
  boru30: { etiket: "PPRC Boru Ø32", birim: "mt", ara: "pprc boru" },
  anaSuBorusu: { etiket: "Ana Su Borusu", birim: "mt", ara: "pprc boru" },
  yerdenIsitmaBorusu: { etiket: "Yerden Isıtma Borusu", birim: "mt", ara: "pe-x boru" },
  suDeposuAdet: { etiket: "Su Deposu", birim: "ad", ara: "su deposu" },
  hidrofor: { etiket: "Hidrofor", birim: "ad", ara: "hidrofor" },
  kazan: { etiket: "Kazan", birim: "ad", ara: "kalorifer kazan" },

  // ── Bina ana kalem — İNŞAAT ciltinde EŞLEŞENLER ──
  disCephe: { etiket: "Dış Cephe Sıvası", birim: "m²", ara: "dış cephe sıva" },
  toplamKazi: { etiket: "Kazı", birim: "m³", ara: "kazı serbest" },
  dolgu: { etiket: "Dolgu", birim: "m³", ara: "dolgu sıkıştırma" },
  toplamBeton: { etiket: "Hazır Beton (kaba yapı)", birim: "m³", ara: "hazır beton" },
  demir: { etiket: "İnşaat Demiri", birim: "Ton", ara: "nervürlü çelik" },
  ahsapPlaywood: { etiket: "Kalıp (plywood)", birim: "m²", ara: "plywood betonarme kalıp" },
  suYalitim: { etiket: "Su Yalıtımı", birim: "m²", ara: "su yalıtım membran" },
  grobeton: { etiket: "Grobeton / Tesviye Betonu", birim: "m³", ara: "tesviye beton" },
  temel: { etiket: "Temel Betonarme", birim: "m²", ara: "temel beton" },
  temelPerde: { etiket: "Perde Beton", birim: "m²", ara: "perde kalıp" },
  dogalgazBoruHatti: { etiket: "Doğalgaz Boru Hattı", birim: "mt", ara: "doğalgaz boru" },
  dogalgazAnaBoruHatti: { etiket: "Doğalgaz Ana Hat", birim: "mt", ara: "doğalgaz boru" },
  toplamCelikKapi: { etiket: "Çelik Kapı", birim: "ad", ara: "çelik kapı" },
  toplamDemirKapi: { etiket: "Demir Kapı / Doğrama", birim: "ad", ara: "demir doğrama kapı" },
  catiYagmurOluklari: { etiket: "Yağmur Oluğu", birim: "mt", ara: "yağmur deresi oluk" },
  yagmurInisBorulari: { etiket: "Yağmur İniş Borusu", birim: "mt", ara: "yağmur iniş boru" },
  catiBacalar: { etiket: "Baca", birim: "ad", ara: "baca" },
  binaAnaGirisKapisi: { etiket: "Bina Giriş Kapısı", birim: "ad", ara: "alüminyum kapı doğrama" },
};

/* malzeme seçimine göre arama kelimesi üretenler */
const MALZEME_ARA: Record<string, Record<string, string>> = {
  disCepheMalzeme: {
    betopan: "betopan cephe levha", alcipan: "cephe levha", mermer: "mermer cephe kaplama",
    strafor: "mantolama eps ısı yalıtım", cs: "cephe panel kompozit", tas: "doğal taş cephe",
  },
  binaOnuMalzeme: {
    andezit: "andezit", kilitparke: "kilit parke", granit: "granit",
    mermer: "mermer döşeme", beton: "saha betonu",
  },
  catiOrtusu: {
    kiremit: "kiremit örtü", kenetsac: "kenet sac çatı", betonkiremit: "beton kiremit",
    ondulin: "ondülin", singil: "shingle bitümlü örtü",
  },
};
const HOL_ARA: Record<string, string> = {
  mermer: "mermer döşeme", fayans: "seramik döşeme", granit: "granit", parke: "laminat parke",
};

/** Sökme/yıkım/taşıma vb. imalat-dışı pozlara verilecek ceza kelimeleri. */
const CEZA = ["sökül", "sökme", "yıkım", "yıkıl", "demonte", "kaldır", "taşı", "yükleme", "boşalt", "aktar", "kırıl", "kırma"];

function alanToplamiM2(d: Apartment["detay"]): number {
  const arr = [...(d.odaAlanlar ?? []), ...(d.salonAlanlar ?? [])];
  return arr.reduce((s, v) => s + (v || 0), 0) + (d.mutfakAlan ?? 0) + (d.banyoAlan ?? 0) + (d.wcAlan ?? 0);
}

export function toplaKalemler(project: Project): KesifKalem[] {
  const topla = new Map<string, KesifKalem>();
  const ekleTanim = (key: string, miktar: number) => {
    if (!miktar || miktar <= 0) return;
    const def = ESLESME[key];
    if (!def) return;
    const v = topla.get(key);
    if (v) v.miktar += miktar;
    else topla.set(key, { key, proje: def.etiket, miktar, birim: def.birim, aramaKelime: def.ara });
  };
  const ekleSerbest = (key: string, proje: string, birim: string, ara: string, miktar: number) => {
    if (!miktar || miktar <= 0) return;
    const v = topla.get(key);
    if (v) v.miktar += miktar;
    else topla.set(key, { key, proje, miktar, birim, aramaKelime: ara });
  };
  // Poza bağlı kalem — AYNI POZ tek satırda GRUPLANIR (toplam adet/m²)
  const eklePoz = (pozKod: string, kalem: string, birim: string, miktar: number) => {
    if (!miktar || miktar <= 0) return;
    const key = `poz:${pozKod}`;
    const v = topla.get(key);
    if (v) v.miktar += miktar;
    else topla.set(key, { key, proje: kalem, miktar, birim, aramaKelime: kalem, pozKod });
  };

  const pencere = new Map<string, number>();

  for (const kat of project.katlar ?? []) {
    const katFactor = kat.benzerAdet && kat.benzerAdet > 0 ? kat.benzerAdet : 1; // benzer kat adedi
    for (const d of kat.daireler) {
      const carpan = (d.adet || 1) * katFactor; // daire adedi × benzer kat
      // pozdan seçilen daire kalemleri — aynı poz gruplanır
      for (const pk of d.detay.pozKalemler ?? []) {
        eklePoz(pk.pozKod, pk.kalem, pk.birim, (pk.miktar || 0) * carpan);
      }
      // ESKİ: serbest ekstra alanlar (geriye dönük)
      for (const [k, val] of Object.entries(d.detay.ekstra ?? {})) ekleTanim(k, (val || 0) * carpan);
      for (const p of d.detay.pencereler ?? []) {
        pencere.set(p.tip, (pencere.get(p.tip) ?? 0) + (p.alan ?? 0) * carpan);
      }
      const alanM2 = alanToplamiM2(d.detay) * carpan;
      if (alanM2 > 0) ekleSerbest("boya", "Plastik Boya (iç)", "m²", "plastik boya", alanM2 * 3.2);
    }
    // kat bazlı (× benzer kat)
    if (kat.perdeAlani) ekleTanim("temelPerde", kat.perdeAlani * katFactor);
    if (kat.holM2 && kat.holMalzeme && HOL_ARA[kat.holMalzeme]) {
      ekleSerbest(`hol-${kat.holMalzeme}`, `Kat Holü (${kat.holMalzeme})`, "m²", HOL_ARA[kat.holMalzeme], kat.holM2 * katFactor);
    }
  }

  const bina: BuildingDetails | undefined = project.bina;

  // Pozdan seçilen ana kalemler — aynı poz gruplanır (bina geneli, ×1)
  for (const k of bina?.anaKalemPoz ?? []) {
    eklePoz(k.pozKod, k.kalem, k.birim, k.miktar || 0);
  }

  // ESKİ: serbest alan ana kalemler (geriye dönük — yeni projeler kullanmaz)
  for (const [k, val] of Object.entries(bina?.anaKalem ?? {})) {
    if (["disCepheMalzemeM2", "binaOnuM2", "catiOrtusuM2"].includes(k)) continue;
    ekleTanim(k, val || 0);
  }
  const sec = bina?.anaKalemSecim ?? {};
  const ak = bina?.anaKalem ?? {};
  if (ak.disCepheMalzemeM2 && sec.disCepheMalzeme && MALZEME_ARA.disCepheMalzeme[sec.disCepheMalzeme])
    ekleSerbest("disCepheKaplama", "Dış Cephe Kaplama", "m²", MALZEME_ARA.disCepheMalzeme[sec.disCepheMalzeme], ak.disCepheMalzemeM2);
  if (ak.binaOnuM2 && sec.binaOnuMalzeme && MALZEME_ARA.binaOnuMalzeme[sec.binaOnuMalzeme])
    ekleSerbest("binaOnu", "Bina Önü Zemin", "m²", MALZEME_ARA.binaOnuMalzeme[sec.binaOnuMalzeme], ak.binaOnuM2);
  if (ak.catiOrtusuM2 && sec.catiOrtusu && MALZEME_ARA.catiOrtusu[sec.catiOrtusu])
    ekleSerbest("catiOrtusu", "Çatı Örtüsü", "m²", MALZEME_ARA.catiOrtusu[sec.catiOrtusu], ak.catiOrtusuM2);

  const list = [...topla.values()];

  const pencereAd: Record<string, { etiket: string; ara: string }> = {
    pvc: { etiket: "PVC Pencere", ara: "pvc pencere doğrama" },
    aluminyum: { etiket: "Alüminyum Pencere", ara: "alüminyum doğrama pencere" },
    ahsap: { etiket: "Ahşap Pencere", ara: "ahşap pencere doğrama" },
  };
  for (const [tip, m2] of pencere) {
    if (m2 > 0 && pencereAd[tip])
      list.push({ key: `pencere-${tip}`, proje: pencereAd[tip].etiket, miktar: m2, birim: "m²", aramaKelime: pencereAd[tip].ara });
  }

  return list.sort((a, b) => a.proje.localeCompare(b.proje, "tr"));
}

export function eslesPoz(kalem: KesifKalem, pozlar: Poz[]): Poz | undefined {
  const kelimeler = kalem.aramaKelime.toLocaleLowerCase("tr").split(/\s+/).filter(Boolean);
  const birimNorm = (b: string) => b.replace(/\s+/g, "").toLocaleLowerCase("tr");
  const hedefBirim = birimNorm(kalem.birim);

  // Kelime-başı eşleşme: poz açıklamasındaki bir SÖZCÜK, anahtar kelimeyle başlamalı.
  // ("beton" → "betonu/betonarme" eşleşir; "şap" → "ahşap" İÇİNDE eşleşmez.)
  const sozcuklereBol = (s: string) => s.toLocaleLowerCase("tr").split(/[^0-9a-zçğıöşü]+/i).filter(Boolean);

  let enIyi: { poz: Poz; skor: number; uzunluk: number } | undefined;
  for (const p of pozlar) {
    const sozcukler = sozcuklereBol(p.ad);
    const adLower = p.ad.toLocaleLowerCase("tr");
    let skor = 0;
    for (const kel of kelimeler) {
      if (sozcukler.some((w) => w.startsWith(kel))) skor += 1;
    }
    if (skor === 0) continue;
    if (birimNorm(p.birim) === hedefBirim) skor += 3;            // birim uyumu güçlü artı
    if (CEZA.some((c) => sozcukler.some((w) => w.startsWith(c)))) skor -= 5; // sökme/yıkım cezası
    if (skor <= 0) continue;
    if (!enIyi || skor > enIyi.skor || (skor === enIyi.skor && adLower.length < enIyi.uzunluk)) {
      enIyi = { poz: p, skor, uzunluk: adLower.length };
    }
  }
  return enIyi?.poz;
}

/**
 * AI'nin PDF'ten çıkardığı metraj nesnesini ({parke: 95, kapi: 8, ...})
 * pozlara bağlı kalemlere çevirir. Anahtarlar ESLESME anahtarlarıyla
 * aynıdır; her biri anahtar kelime + birim ile poza eşlenir.
 */
export function aiMetrajPozKalemleri(
  metraj: Record<string, number> | undefined,
  pozlar: Poz[],
): { pozKod: string; kalem: string; birim: string; miktar: number }[] {
  if (!metraj) return [];
  const out: { pozKod: string; kalem: string; birim: string; miktar: number }[] = [];
  for (const [key, miktar] of Object.entries(metraj)) {
    if (!miktar || miktar <= 0) continue;
    const def = ESLESME[key];
    if (!def) continue;
    const poz = eslesPoz({ key, proje: def.etiket, miktar, birim: def.birim, aramaKelime: def.ara }, pozlar);
    if (poz) out.push({ pozKod: poz.kod, kalem: poz.ad, birim: poz.birim, miktar });
  }
  return out;
}

/** AI metrajına sorulabilecek alan anahtarları (İnşaat ciltinde eşleşenler). */
export const AI_METRAJ_ALANLARI: { key: string; aciklama: string; birim: string }[] = [
  { key: "parke", aciklama: "laminat parke (kuru hacim zemini)", birim: "m²" },
  { key: "yerFayansi", aciklama: "yer seramiği (ıslak hacim + balkon zemini)", birim: "m²" },
  { key: "duvarFayansi", aciklama: "duvar seramiği (banyo/wc/mutfak duvarı)", birim: "m²" },
  { key: "alci", aciklama: "saten alçı (boyalı duvar + tavan)", birim: "m²" },
  { key: "duvar", aciklama: "tuğla duvar (iç bölme)", birim: "m²" },
  { key: "isitmaAlan", aciklama: "şap (tüm zemin)", birim: "m²" },
  { key: "kapi", aciklama: "iç kapı adedi", birim: "ad" },
  { key: "balkonAlan", aciklama: "balkon zemini", birim: "m²" },
];

export interface KesifSatir {
  kalem: KesifKalem;
  poz?: Poz;
  csbBirim?: number;
  piyasaBirim?: number;
  csbTutar: number;
  piyasaTutar: number;
}

export function kesifHesapla(project: Project, pozlar: Poz[]): KesifSatir[] {
  const idx = new Map(pozlar.map((p) => [p.kod, p]));
  return toplaKalemler(project).map((kalem) => {
    // Doğrudan poza bağlıysa onu kullan; değilse anahtar kelimeyle eşle
    const poz = kalem.pozKod ? idx.get(kalem.pozKod) : eslesPoz(kalem, pozlar);
    const csbBirim = poz?.resmiFiyat;
    const piyasaBirim = poz ? etkinFiyat(poz) : undefined;
    return {
      kalem, poz, csbBirim, piyasaBirim,
      csbTutar: (csbBirim ?? 0) * kalem.miktar,
      piyasaTutar: (piyasaBirim ?? 0) * kalem.miktar,
    };
  });
}
