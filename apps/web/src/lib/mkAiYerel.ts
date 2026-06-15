/* ──────────────────────────────────────────────────────────
   mk_ai — Yerel Beyin (HİÇBİR yapay zekâ entegrasyonu YOK)

   Tüm modülleri (projeler, iş süreçleri, keşif/metraj, personel,
   muhasebe, saha, aşama kalemleri, hakediş, teklif) tek bir
   bütünleşik resme bağlar:
     • projeOzet()      → çapraz-modül özet (tek doğruluk kaynağı)
     • mkAiSorgu()      → kural-bazlı soru-cevap (anahtar kelime eşleme)
     • mkAiTespitler()  → modüller arası tutarsızlık/fırsat tespiti
     • uygulaTespit()   → mk_ai'nin kendi başına yapabileceği düzeltmeler

   Tamamen istemci tarafı + localStorage. Sayılar modüllerden gelir,
   uydurma yok. API anahtarı GEREKMEZ.
   ────────────────────────────────────────────────────────── */

import { type Project, getProject, updateProject, formatTL } from "./projects";
import {
  loadMuhasebe, muhasebeOzeti, addMuhasebe,
} from "./muhasebe";
import { loadSaha } from "./saha";
import { loadIsSurecleri, isOzeti } from "./isSurecleri";
import { loadMetraj } from "./metraj";
import { loadPersonel } from "./personel";
import { loadHakedisler, hakedisHesapla } from "./hakedis";
import { loadTeklifler, teklifToplam } from "./teklif";
import {
  type AsamaKalem, projeTumKalemler, asamaToplamFiyat, asamaToplamAlinan,
} from "./asamaKalem";
import { mkAiRiskAnaliz, type RiskRapor } from "./mkAi";
import { ensurePozlarSeeded, loadPozlar, type LibId } from "./pozlar";
import { kesifHesapla } from "./kesifEslesme";

const tl = (n: number) => formatTL(n);

/* ── Bütünleşik proje özeti ──────────────────────────────── */

export interface ProjeOzet {
  proje: Project;
  butce: number | null;
  // finans (muhasebe)
  gelir: number; gider: number; bakiye: number;
  acikAlacak: number; acikBorc: number;
  // ilerleme (iş süreçleri)
  ilerleme: number; isToplam: number; isTamam: number; isGeciken: number;
  // yol haritası aşamaları + kalemleri
  asamaToplam: number; asamaTamam: number; asamaAktif: string | null;
  kalemToplam: number; kalemOnayli: number;
  kalemPlanlanan: number; kalemAlinan: number;
  // saha
  acikKusur: number; acilKusur: number; acikIsemri: number; gecikenIsemri: number;
  // personel
  personelAktif: number; gunlukYevmiye: number;
  // keşif / metraj
  metrajSatir: number; metrajMahal: number; kesifCsb: number; kesifPiyasa: number;
  // diğer modüller + zincir
  hakedisSayi: number; hakedisSozlesme: number; hakedisKumulatif: number;
  teklifAdet: number; teklifToplam: number;
  // risk (kural motoru)
  risk: RiskRapor;
}

const bugun = () => new Date().toISOString().slice(0, 10);

export function projeOzet(projectId: string): ProjeOzet | null {
  const proje = getProject(projectId);
  if (!proje) return null;

  const muhasebe = loadMuhasebe(projectId);
  const isler = loadIsSurecleri(projectId);
  const saha = loadSaha(projectId);
  const personel = loadPersonel(projectId);
  const tumKalem = projeTumKalemler(projectId);
  const flatKalem: AsamaKalem[] = Object.values(tumKalem).flat();
  const teklifler = loadTeklifler(projectId);
  const hakedisler = loadHakedisler(projectId);
  const metraj = loadMetraj(projectId);

  const m = muhasebeOzeti(muhasebe);
  const io = isOzeti(isler);
  const g = bugun();

  // Keşif (metraj + poz) — sync: localStorage'daki pozları kullanır
  const lib: LibId = proje.pozKutuphane === "kut1" ? "kut1" : proje.pozKutuphane === "kut3" ? "kut3" : "kut2";
  const kesif = metraj.length ? kesifHesapla(proje, loadPozlar(lib)) : [];
  const kesifCsb = Math.round(kesif.reduce((s, r) => s + r.csbTutar, 0));
  const kesifPiyasa = Math.round(kesif.reduce((s, r) => s + r.piyasaTutar, 0));

  const sonHakedis = hakedisler[hakedisler.length - 1];
  const sonHakedisToplam = sonHakedis ? hakedisHesapla(sonHakedis).toplam : null;

  const aktifPersonel = personel.filter((k) => k.aktif);
  const kusur = saha.filter((s) => s.tip === "kusur" && s.durum !== "tamam");
  const isemri = saha.filter((s) => s.tip === "isemri" && s.durum !== "tamam");

  const risk = mkAiRiskAnaliz({ project: proje, muhasebe, saha, isKalemleri: isler });

  return {
    proje,
    butce: proje.budget ?? null,
    gelir: m.toplamGelir, gider: m.toplamGider, bakiye: m.bakiye,
    acikAlacak: m.acikAlacak, acikBorc: m.acikBorc,
    ilerleme: io.genelIlerleme, isToplam: io.toplam, isTamam: io.tamamlanan, isGeciken: io.geciken,
    asamaToplam: proje.phases.length,
    asamaTamam: proje.phases.filter((f) => f.status === "tamam").length,
    asamaAktif: proje.phases.find((f) => f.status !== "tamam")?.name ?? null,
    kalemToplam: flatKalem.length,
    kalemOnayli: flatKalem.filter((k) => k.durum === "tamam").length,
    kalemPlanlanan: asamaToplamFiyat(flatKalem),
    kalemAlinan: asamaToplamAlinan(flatKalem),
    acikKusur: kusur.length,
    acilKusur: kusur.filter((s) => s.oncelik === "acil" || s.oncelik === "yuksek").length,
    acikIsemri: isemri.length,
    gecikenIsemri: isemri.filter((s) => s.termin && s.termin < g).length,
    personelAktif: aktifPersonel.length,
    gunlukYevmiye: aktifPersonel.reduce((s, k) => s + (k.yevmiye || 0), 0),
    metrajSatir: metraj.length,
    metrajMahal: new Set(metraj.map((x) => x.mahal)).size,
    kesifCsb, kesifPiyasa,
    hakedisSayi: hakedisler.length,
    hakedisSozlesme: sonHakedisToplam?.sozlesme ?? 0,
    hakedisKumulatif: sonHakedisToplam?.kumulatif ?? 0,
    teklifAdet: teklifler.length,
    teklifToplam: teklifler.reduce((s, t) => s + teklifToplam(t).genelToplam, 0),
    risk,
  };
}

/* ── Yerel soru-cevap (kural-bazlı) ──────────────────────── */

function norm(s: string): string {
  return s.toLocaleLowerCase("tr")
    .replaceAll("ı", "i").replaceAll("ğ", "g").replaceAll("ü", "u")
    .replaceAll("ş", "s").replaceAll("ö", "o").replaceAll("ç", "c")
    .replace(/[^a-z0-9 ]/g, " ");
}

export interface YerelCevap { baslik: string; cevap: string; }

interface Niyet {
  baslik: string;
  anahtarlar: string[];
  yanit: (o: ProjeOzet) => string;
}

const NIYETLER: Niyet[] = [
  {
    baslik: "Bütçe & Maliyet",
    anahtarlar: ["butce", "maliyet", "harcama", "ne kadar harcadi", "gider", "kalan para", "eac", "asim", "para harcadik"],
    yanit: (o) => {
      const sat: string[] = [];
      if (o.butce != null) {
        const oran = o.butce > 0 ? Math.round((o.gider / o.butce) * 100) : 0;
        sat.push(`Bütçe ${tl(o.butce)}; şu ana kadarki gider ${tl(o.gider)} (bütçenin %${oran}'i).`);
        const kalan = o.butce - o.gider;
        sat.push(kalan >= 0 ? `Kalan bütçe ${tl(kalan)}.` : `⚠️ Bütçe ${tl(-kalan)} aşıldı.`);
      } else {
        sat.push(`Bütçe tanımlı değil; toplam gider ${tl(o.gider)}.`);
        if (o.metrajSatir > 0) sat.push("Keşiften bütçe hesaplayabilirim — aşağıdaki Tespitler'den 'Düzelt' ile yazabilirsin.");
      }
      const p = o.risk.projeksiyon;
      if (p.nihaiMaliyet) sat.push(`Mevcut hızla tahmini nihai maliyet (EAC) ~${tl(p.nihaiMaliyet)}${p.cpi ? `, CPI ${p.cpi.toFixed(2)}` : ""}.`);
      if (o.kesifPiyasa > 0) sat.push(`Keşfe göre tahmini maliyet ~${tl(o.kesifPiyasa)} (piyasa).`);
      return sat.join(" ");
    },
  },
  {
    baslik: "Keşif & Metraj",
    anahtarlar: ["kesif", "metraj", "mahal", "imalat tutari", "poz", "tahmini maliyet", "kac para tutar"],
    yanit: (o) => {
      if (o.metrajSatir === 0) return "Henüz metraj girilmemiş. Keşif & Metraj modülünden mahal bazlı metraj girince keşif otomatik hesaplanır.";
      const sat = [`${o.metrajSatir} metraj satırı, ${o.metrajMahal} mahal.`];
      if (o.kesifPiyasa > 0) sat.push(`Keşif tutarı: ÇŞB ${tl(o.kesifCsb)}, piyasa ${tl(o.kesifPiyasa)}.`);
      if (o.butce != null && o.kesifPiyasa > 0) {
        const fark = o.butce - o.kesifPiyasa;
        sat.push(fark >= 0 ? `Bütçe keşfin ${tl(fark)} üstünde (uyumlu).` : `⚠️ Keşif bütçeyi ${tl(-fark)} aşıyor.`);
      } else if (o.butce == null && o.kesifPiyasa > 0) {
        sat.push("Bütçe tanımsız — Tespitler'den keşif tutarını bütçeye yazabilirim.");
      }
      return sat.join(" ");
    },
  },
  {
    baslik: "Öncelik / Ne yapmalıyım",
    anahtarlar: ["ne yapmali", "oncelik", "siradaki", "aksiyon", "yapilacak", "ilk once", "neye odaklan", "yapmam gereken"],
    yanit: (o) => {
      const yap: string[] = [];
      if (o.risk.faktorler[0]) yap.push(`Risk: ${o.risk.faktorler[0].oneri}`);
      if (o.acikBorc > 0) yap.push(`Ödenecek ${tl(o.acikBorc)} açık borç var — ödeme planı yapın.`);
      if (o.isGeciken > 0) yap.push(`${o.isGeciken} geciken işi yeniden terminleyin.`);
      if (o.acilKusur > 0) yap.push(`${o.acilKusur} acil/yüksek kusuru kapatın.`);
      if (o.gecikenIsemri > 0) yap.push(`${o.gecikenIsemri} termini geçmiş iş emrini yeniden atayın.`);
      if (o.butce == null && o.kesifPiyasa > 0) yap.push("Bütçeyi keşiften belirleyin.");
      if (yap.length === 0) return "Acil bir aksiyon görünmüyor; proje sağlıklı. Veri girişini güncel tutun.";
      return "Öncelik sırası:\n" + yap.map((s, i) => `${i + 1}. ${s}`).join("\n");
    },
  },
  {
    baslik: "Gelir / Tahsilat",
    anahtarlar: ["gelir", "tahsilat", "satis", "kapora", "kat karsiligi", "ne kazandik"],
    yanit: (o) => {
      const sat = [`Toplam gelir ${tl(o.gelir)}, tahsil edilen ${tl(o.gelir - o.acikAlacak)}.`];
      if (o.acikAlacak > 0) sat.push(`Tahsil edilecek açık alacak ${tl(o.acikAlacak)}.`);
      return sat.join(" ");
    },
  },
  {
    baslik: "Nakit & Ödemeler",
    anahtarlar: ["nakit", "bakiye", "odeme", "borc", "alacak", "tahsil", "bekleyen", "cari", "kim ne kadar"],
    yanit: (o) => {
      const sat = [`Gelir ${tl(o.gelir)}, gider ${tl(o.gider)}, bakiye ${tl(o.bakiye)}.`];
      if (o.acikBorc > 0) sat.push(`Ödenecek açık borç: ${tl(o.acikBorc)}.`);
      if (o.acikAlacak > 0) sat.push(`Tahsil edilecek açık alacak: ${tl(o.acikAlacak)}.`);
      if (o.acikBorc === 0 && o.acikAlacak === 0) sat.push("Açık borç/alacak yok.");
      return sat.join(" ");
    },
  },
  {
    baslik: "Takvim & İlerleme",
    anahtarlar: ["ilerleme", "takvim", "ne zaman biter", "gecikme", "bitis", "termin", "yuzde", "nerede kaldik", "hangi asama"],
    yanit: (o) => {
      const sat = [`Genel ilerleme %${o.ilerleme} (${o.isTamam}/${o.isToplam} iş kalemi tamam).`];
      if (o.isGeciken > 0) sat.push(`⚠️ ${o.isGeciken} iş kalemi gecikmede.`);
      if (o.asamaAktif) sat.push(`Güncel aşama: ${o.asamaAktif} (${o.asamaTamam}/${o.asamaToplam} aşama tamam).`);
      const p = o.risk.projeksiyon;
      if (p.tahminiBitis) sat.push(`Tahmini bitiş ${p.tahminiBitis}${p.gecikmeGun ? ` (~${p.gecikmeGun} gün sapma)` : ""}.`);
      return sat.join(" ");
    },
  },
  {
    baslik: "Yol Haritası Kalemleri",
    anahtarlar: ["kalem", "yol harita", "is takibi", "onay", "alinan", "ruhsat", "zemin etud", "asama icinde"],
    yanit: (o) => {
      if (o.kalemToplam === 0) return "Henüz aşama içine iş kalemi açılmamış. Proje detayında bir aşamaya girip 'Hazır iş sırasını yükle' diyebilirsin.";
      const sat = [`${o.kalemOnayli}/${o.kalemToplam} aşama iş kalemi onaylı.`];
      sat.push(`Planlanan toplam ${tl(o.kalemPlanlanan)}, alınan/ödenen ${tl(o.kalemAlinan)}.`);
      const fark = o.kalemPlanlanan - o.kalemAlinan;
      if (fark > 0) sat.push(`Bu kalemlerde ${tl(fark)} henüz ödenmemiş görünüyor.`);
      return sat.join(" ");
    },
  },
  {
    baslik: "Saha & Kalite",
    anahtarlar: ["saha", "kusur", "is emri", "isemri", "kalite", "hata", "eksik is"],
    yanit: (o) => {
      const sat = [`Açık kusur ${o.acikKusur} (acil/yüksek ${o.acilKusur}), açık iş emri ${o.acikIsemri} (gecikmiş ${o.gecikenIsemri}).`];
      if (o.acikKusur === 0 && o.acikIsemri === 0) sat.push("Saha tarafı temiz görünüyor.");
      return sat.join(" ");
    },
  },
  {
    baslik: "Personel",
    anahtarlar: ["personel", "calisan", "isci", "ekip", "kac kisi", "yevmiye", "puantaj", "kim calisiyor"],
    yanit: (o) => {
      if (o.personelAktif === 0) return "Kayıtlı aktif personel yok. Personel & Puantaj modülünden ekleyebilirsin.";
      return `${o.personelAktif} aktif personel; toplam günlük yevmiye ${tl(o.gunlukYevmiye)} (≈ aylık ${tl(o.gunlukYevmiye * 26)} işçilik).`;
    },
  },
  {
    baslik: "Risk",
    anahtarlar: ["risk", "tehlike", "sorun", "en buyuk", "kritik", "neye dikkat"],
    yanit: (o) => {
      const r = o.risk;
      const sat = [`Risk skoru ${r.skor}/100 (${r.seviye}). ${r.ozet}`];
      if (r.faktorler[0]) sat.push(`En kritik: ${r.faktorler[0].baslik} — ${r.faktorler[0].oneri}`);
      return sat.join(" ");
    },
  },
  {
    baslik: "Teklif & Hakediş (zincir)",
    anahtarlar: ["teklif", "hakedis", "taseron", "istihkak", "sozlesme", "zincir"],
    yanit: (o) => {
      const sat: string[] = [];
      // Zincir: keşif → teklif → hakediş
      if (o.kesifPiyasa > 0) sat.push(`Keşif (maliyet) ${tl(o.kesifPiyasa)}.`);
      sat.push(o.teklifAdet > 0 ? `${o.teklifAdet} teklif, toplam ${tl(o.teklifToplam)}.` : "Henüz teklif yok (keşiften oluşturulabilir).");
      if (o.hakedisSayi > 0) {
        const ilerleme = o.hakedisSozlesme > 0 ? Math.round((o.hakedisKumulatif / o.hakedisSozlesme) * 100) : 0;
        sat.push(`${o.hakedisSayi} hakediş; sözleşme ${tl(o.hakedisSozlesme)}, kümülatif imalat ${tl(o.hakedisKumulatif)} (%${ilerleme}).`);
      } else {
        sat.push("Hakediş yok (kabul edilen teklif­ten sözleşme yüklenebilir).");
      }
      return sat.join(" ");
    },
  },
];

function genelOzet(o: ProjeOzet): string {
  return [
    `${o.proje.name}: ilerleme %${o.ilerleme}, ${o.asamaTamam}/${o.asamaToplam} aşama tamam.`,
    o.butce != null ? `Bütçe ${tl(o.butce)}, gider ${tl(o.gider)}.` : `Gider ${tl(o.gider)} (bütçe tanımsız).`,
    `Risk ${o.risk.skor}/100 (${o.risk.seviye}).`,
    o.acikBorc > 0 ? `Ödenecek ${tl(o.acikBorc)}.` : "",
    o.isGeciken > 0 ? `${o.isGeciken} geciken iş.` : "",
    o.acikKusur > 0 ? `${o.acikKusur} açık kusur.` : "",
  ].filter(Boolean).join(" ");
}

export function mkAiSorgu(projectId: string, soru: string): YerelCevap {
  const o = projeOzet(projectId);
  if (!o) return { baslik: "Hata", cevap: "Proje bulunamadı." };
  const q = norm(soru);

  // Eşleşen tüm niyetleri puanla; en çok anahtar eşleşeni seç.
  let enIyi: Niyet | null = null;
  let enIyiPuan = 0;
  for (const n of NIYETLER) {
    const puan = n.anahtarlar.filter((a) => q.includes(a)).length;
    if (puan > enIyiPuan) { enIyiPuan = puan; enIyi = n; }
  }

  if (!enIyi) {
    return {
      baslik: "Genel Durum",
      cevap: `${genelOzet(o)}\n\nDaha spesifik sorabilirsin: bütçe, nakit/ödeme, takvim/gecikme, saha/kusur, personel, risk, teklif/hakediş, yol haritası kalemleri.`,
    };
  }
  return { baslik: enIyi.baslik, cevap: enIyi.yanit(o) };
}

/* ── Tespitler (modüller arası) + otomatik düzeltme ──────── */

export interface Tespit {
  id: string;                          // sabit anahtar (uygula switch'i için)
  tur: "uyari" | "bilgi" | "firsat";
  baslik: string;
  aciklama: string;
  duzeltme?: string;                   // varsa: 'Düzelt' butonu etiketi
}

const ASAMA_BELGE = (kalemId: string) => `ASAMA:${kalemId}`;

export function mkAiTespitler(projectId: string): Tespit[] {
  const o = projeOzet(projectId);
  if (!o) return [];
  const t: Tespit[] = [];

  // 1) Bütçe yok ama metraj var → keşiften yazılabilir
  if (o.butce == null && o.metrajSatir > 0) {
    t.push({
      id: "butce-kesiften", tur: "firsat",
      baslik: "Bütçe tanımlı değil",
      aciklama: "Keşif/metraj verisi var. Keşfin piyasa toplamını proje bütçesi olarak yazabilirim.",
      duzeltme: "Keşiften bütçe yaz",
    });
  }

  // 2) Ödenmiş aşama kalemleri muhasebeye işlenmemiş
  const tumKalem = projeTumKalemler(projectId);
  const flat = Object.values(tumKalem).flat();
  const muh = loadMuhasebe(projectId);
  const islenmis = new Set(muh.map((k) => k.belgeNo).filter(Boolean));
  const aktarilacak = flat.filter(
    (k) => k.odendi && (k.alinan ?? 0) > 0 && !islenmis.has(ASAMA_BELGE(k.id)),
  );
  if (aktarilacak.length > 0) {
    const toplam = aktarilacak.reduce((s, k) => s + (k.alinan ?? 0), 0);
    t.push({
      id: "asama-muhasebe", tur: "firsat",
      baslik: "Aşama ödemeleri muhasebeye işlenmemiş",
      aciklama: `${aktarilacak.length} ödenmiş iş kalemi (toplam ${tl(toplam)}) muhasebede gider olarak yok. Otomatik gider kaydı oluşturabilirim.`,
      duzeltme: "Muhasebeye aktar",
    });
  }

  // 3) Aşama durumu kalem onayıyla uyumsuz
  const uyumsuz = o.proje.phases.filter((ph) => {
    const ks = tumKalem[ph.name];
    if (!ks || ks.length === 0) return false;
    const hedef = asamaHedefDurum(ks);
    return hedef !== ph.status;
  });
  if (uyumsuz.length > 0) {
    t.push({
      id: "asama-durum", tur: "bilgi",
      baslik: "Aşama durumları kalemlerle uyumsuz",
      aciklama: `${uyumsuz.length} aşamanın durumu, içindeki kalemlerin onay durumuyla örtüşmüyor. İlerlemeye göre güncelleyebilirim.`,
      duzeltme: "Durumları eşitle",
    });
  }

  // 3b) Keşif bütçeyi aşıyor (planlama uyarısı)
  if (o.butce != null && o.kesifPiyasa > 0 && o.kesifPiyasa > o.butce * 1.1) {
    t.push({
      id: "kesif-butce", tur: "uyari",
      baslik: "Keşif bütçeyi aşıyor",
      aciklama: `Keşif piyasa tutarı ${tl(o.kesifPiyasa)}, bütçe ${tl(o.butce)} — %${Math.round((o.kesifPiyasa / o.butce - 1) * 100)} üzerinde. Bütçeyi revize edin veya kapsamı gözden geçirin.`,
    });
  }

  // 4) Açık borç bilgisi (entegrasyon farkındalığı)
  if (o.acikBorc > 0) {
    t.push({
      id: "acik-borc", tur: "uyari",
      baslik: "Ödenecek açık borç var",
      aciklama: `Muhasebede ${tl(o.acikBorc)} açık (ödenmemiş) borç görünüyor. Muhasebe → Cari Hesaplar'dan takip edin.`,
    });
  }

  // 5) Yevmiyesi tanımsız personel
  const personel = loadPersonel(projectId).filter((p) => p.aktif && (!p.yevmiye || p.yevmiye <= 0));
  if (personel.length > 0) {
    t.push({
      id: "personel-yevmiye", tur: "uyari",
      baslik: "Yevmiyesi girilmemiş personel",
      aciklama: `${personel.length} aktif personelin yevmiyesi 0; işçilik maliyeti eksik hesaplanır. Personel modülünden girin.`,
    });
  }

  return t;
}

/** Bir aşamanın kalemlerinden hedef aşama durumu. */
function asamaHedefDurum(ks: AsamaKalem[]): "bekliyor" | "devam" | "tamam" {
  const tamam = ks.filter((k) => k.durum === "tamam").length;
  if (tamam === ks.length) return "tamam";
  if (tamam > 0 || ks.some((k) => k.durum === "devam")) return "devam";
  return "bekliyor";
}

export interface DuzeltmeSonuc { ok: boolean; mesaj: string; }

/** mk_ai'nin kendi başına uyguladığı düzeltme. */
export async function uygulaTespit(projectId: string, id: string): Promise<DuzeltmeSonuc> {
  const proje = getProject(projectId);
  if (!proje) return { ok: false, mesaj: "Proje bulunamadı." };

  switch (id) {
    case "butce-kesiften": {
      const lib = proje.pozKutuphane === "kut1" ? "kut1" : "kut2";
      const pozlar = await ensurePozlarSeeded(lib);
      const kesif = kesifHesapla(proje, pozlar);
      const piyasa = Math.round(kesif.reduce((s, r) => s + r.piyasaTutar, 0));
      if (piyasa <= 0) return { ok: false, mesaj: "Keşiften tutar hesaplanamadı (metraj/poz eksik olabilir)." };
      updateProject({ ...proje, budget: piyasa });
      return { ok: true, mesaj: `Bütçe keşif piyasa toplamı ${tl(piyasa)} olarak yazıldı.` };
    }

    case "asama-muhasebe": {
      const flat = Object.values(projeTumKalemler(projectId)).flat();
      const islenmis = new Set(loadMuhasebe(projectId).map((k) => k.belgeNo).filter(Boolean));
      const aktar = flat.filter((k) => k.odendi && (k.alinan ?? 0) > 0 && !islenmis.has(ASAMA_BELGE(k.id)));
      if (aktar.length === 0) return { ok: false, mesaj: "Aktarılacak ödeme bulunamadı." };
      for (const k of aktar) {
        addMuhasebe({
          projectId, tip: "gider", kategori: "Taşeron / Hakediş",
          aciklama: `${k.asama} — ${k.ad}`,
          taraf: k.personelAd ?? "", belgeNo: ASAMA_BELGE(k.id),
          matrah: k.alinan ?? 0, kdvOran: 0, tevkifatOran: 0,
          tarih: k.bitis || k.baslangic || bugun(),
          durum: "odendi", odenenTutar: 0,
        });
      }
      const toplam = aktar.reduce((s, k) => s + (k.alinan ?? 0), 0);
      return { ok: true, mesaj: `${aktar.length} ödeme (${tl(toplam)}) muhasebeye gider olarak işlendi.` };
    }

    case "asama-durum": {
      const tumKalem = projeTumKalemler(projectId);
      let degisen = 0;
      const phases = proje.phases.map((ph) => {
        const ks = tumKalem[ph.name];
        if (!ks || ks.length === 0) return ph;
        const hedef = asamaHedefDurum(ks);
        if (hedef !== ph.status) { degisen++; return { ...ph, status: hedef }; }
        return ph;
      });
      if (degisen === 0) return { ok: false, mesaj: "Güncellenecek aşama yok." };
      updateProject({ ...proje, phases });
      return { ok: true, mesaj: `${degisen} aşamanın durumu kalemlerine göre güncellendi.` };
    }

    default:
      return { ok: false, mesaj: "Bu tespit otomatik düzeltilemiyor." };
  }
}
