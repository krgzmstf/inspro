/* ──────────────────────────────────────────────────────────
   mk_ai — insPRO yapay zekâ asistanı (risk motoru v2)

   Proje verisini (bütçe/muhasebe, saha kusur/iş emri, iş süreçleri
   takvimi/bağımlılıkları) kural-bazlı analiz eder. v2 ek olarak:
     • EVM projeksiyonu: tahmini nihai maliyet (EAC), CPI mantığı
     • Takvim projeksiyonu: mevcut hıza göre tahmini bitiş + gecikme
     • Harcama hızı (burn-rate) trendi
     • Kategori bazlı skorlar (maliyet/takvim/kalite/nakit)
   API anahtarı GEREKMEZ — anında çalışır. İsteğe bağlı Claude
   zenginleştirmesi: /api/mk-ai.
   ────────────────────────────────────────────────────────── */

import type { Project } from "./projects";
import { type MuhasebeKayit, muhasebeOzeti } from "./muhasebe";
import type { SahaKaydi } from "./saha";
import { type IsKalemi, isOzeti } from "./isSurecleri";

export type RiskSeviye = "dusuk" | "orta" | "yuksek";
export type RiskKategori = "maliyet" | "takvim" | "kalite" | "nakit";

export interface RiskFaktor {
  id: string;
  kategori: RiskKategori;
  baslik: string;
  seviye: RiskSeviye;
  detay: string;
  oneri: string;
  puan: number; // 0-100 bu faktörün katkısı
}

export interface Projeksiyon {
  yuzdeTamam: number;             // işin tamamlanma yüzdesi
  harcananMaliyet: number;       // AC — bugüne kadar gider
  nihaiMaliyet?: number;         // EAC — tahmini toplam maliyet
  cpi?: number;                  // maliyet performans endeksi (bütçe varsa)
  butceAsimYuzde?: number;       // (EAC/bütçe - 1) * 100
  tahminiBitis?: string;         // ISO gün
  planliBitis?: string;          // ISO gün
  gecikmeGun?: number;           // tahmini - planlı
  yakmaHizi?: number;            // ₺/gün (son 30 gün)
}

export interface KategoriSkor { kategori: RiskKategori; skor: number; }

export interface RiskRapor {
  skor: number;
  seviye: RiskSeviye;
  ozet: string;
  faktorler: RiskFaktor[];
  kategoriler: KategoriSkor[];
  projeksiyon: Projeksiyon;
  guvenli: { baslik: string; detay: string }[];
  olusturma: string;
}

export interface RiskGirdi {
  project: Project;
  muhasebe: MuhasebeKayit[];
  saha: SahaKaydi[];
  isKalemleri: IsKalemi[];
}

const KATEGORI_LABEL: Record<RiskKategori, string> = {
  maliyet: "Maliyet", takvim: "Takvim", kalite: "Kalite", nakit: "Nakit",
};
export { KATEGORI_LABEL };

const gun = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 86400000;
const tl = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} ₺`;

/** Belirli tarih aralığındaki gideri toplar (gün sayısı geriye). */
function giderPencere(kayitlar: MuhasebeKayit[], bitis: string, geriGun: number): number {
  const alt = new Date(Date.parse(bitis) - geriGun * 86400000).toISOString().slice(0, 10);
  return kayitlar
    .filter((k) => k.tip === "gider" && k.tarih > alt && k.tarih <= bitis)
    .reduce((s, k) => s + k.tutar, 0);
}

export function mkAiRiskAnaliz({ project, muhasebe, saha, isKalemleri }: RiskGirdi): RiskRapor {
  const faktorler: RiskFaktor[] = [];
  const guvenli: { baslik: string; detay: string }[] = [];
  const bugun = new Date().toISOString().slice(0, 10);

  const m = muhasebeOzeti(muhasebe);
  const io = isOzeti(isKalemleri);
  const yuzde = io.genelIlerleme;

  /* ── Projeksiyon (EVM + takvim) ── */
  const proj: Projeksiyon = { yuzdeTamam: yuzde, harcananMaliyet: m.toplamGider };
  if (yuzde >= 5 && m.toplamGider > 0) {
    proj.nihaiMaliyet = m.toplamGider / (yuzde / 100); // EAC ≈ AC / %tamam
    if (project.budget && project.budget > 0) {
      proj.cpi = (project.budget * (yuzde / 100)) / m.toplamGider; // EV/AC
      proj.butceAsimYuzde = (proj.nihaiMaliyet / project.budget - 1) * 100;
    }
  }
  // harcama hızı (son 30 gün)
  if (muhasebe.length > 0) proj.yakmaHizi = giderPencere(muhasebe, bugun, 30) / 30;

  // takvim projeksiyonu
  const tarihli = isKalemleri.filter((k) => k.baslangic && k.bitis);
  if (tarihli.length >= 2 && yuzde > 0) {
    const bas = tarihli.reduce((a, k) => (k.baslangic < a ? k.baslangic : a), tarihli[0].baslangic);
    const planliBitis = tarihli.reduce((a, k) => (k.bitis > a ? k.bitis : a), tarihli[0].bitis);
    proj.planliBitis = planliBitis;
    const gecen = gun(bugun, bas);
    if (gecen > 3) {
      const hiz = yuzde / gecen; // %/gün
      if (hiz > 0) {
        const kalanGun = (100 - yuzde) / hiz;
        proj.tahminiBitis = new Date(Date.parse(bugun) + kalanGun * 86400000).toISOString().slice(0, 10);
        proj.gecikmeGun = Math.round(gun(proj.tahminiBitis, planliBitis));
      }
    }
  }

  /* ── 1) Maliyet: EAC projeksiyonu + anlık kullanım ── */
  if (project.budget && project.budget > 0) {
    const oran = m.toplamGider / project.budget;
    if (proj.butceAsimYuzde !== undefined && proj.butceAsimYuzde >= 10) {
      faktorler.push({ id: "eac", kategori: "maliyet", baslik: "Tahmini bütçe aşımı", seviye: "yuksek",
        detay: `Mevcut hızla nihai maliyet ~${tl(proj.nihaiMaliyet!)} — bütçenin %${Math.round(proj.butceAsimYuzde)} üstü (CPI ${proj.cpi!.toFixed(2)}).`,
        oneri: "Kalan imalatta birim maliyetleri düşürün; en yüksek 3 gider kalemini ve taşeron fiyatlarını yeniden müzakere edin. Revize bütçe onayı alın.",
        puan: Math.min(100, 75 + proj.butceAsimYuzde) });
    } else if (oran >= 1) {
      faktorler.push({ id: "butce", kategori: "maliyet", baslik: "Bütçe aşıldı", seviye: "yuksek",
        detay: `Gider ${tl(m.toplamGider)}, bütçe ${tl(project.budget)} (%${Math.round(oran * 100)}).`,
        oneri: "Revize bütçe çıkarın; kalan iş için nakit projeksiyonu yapın.", puan: Math.min(100, 80 + (oran - 1) * 40) });
    } else if (oran >= 0.85 && yuzde < 85) {
      faktorler.push({ id: "butce", kategori: "maliyet", baslik: "Bütçe aşımı riski", seviye: "yuksek",
        detay: `Bütçenin %${Math.round(oran * 100)}'i harcandı ancak iş %${yuzde} tamam.`,
        oneri: "Harcama ilerlemenin önünde. Kritik olmayan kalemleri erteleyin, nakit projeksiyonu çıkarın.", puan: 80 });
    } else if (oran >= 0.7) {
      faktorler.push({ id: "butce", kategori: "maliyet", baslik: "Bütçe kullanımı yüksek", seviye: "orta",
        detay: `Bütçenin %${Math.round(oran * 100)}'i kullanıldı (ilerleme %${yuzde}).`,
        oneri: "Kalan bütçeyi kalemlere kilitleyin; %5-10 yedek ayırın.", puan: 50 });
    } else {
      guvenli.push({ baslik: "Bütçe sağlıklı", detay: `Gider bütçenin %${Math.round(oran * 100)}'inde${proj.cpi ? `, CPI ${proj.cpi.toFixed(2)}` : ""}.` });
    }
  } else {
    faktorler.push({ id: "butce-yok", kategori: "maliyet", baslik: "Bütçe tanımlı değil", seviye: "orta",
      detay: "Tahmini bütçe girilmemiş; maliyet sapması ve EAC ölçülemiyor.",
      oneri: "Maliyet modülünden bütçeyi belirleyip projeye işleyin.", puan: 45 });
  }

  /* ── 2) Nakit akışı + harcama hızı trendi ── */
  if (m.toplamGelir > 0 || m.toplamGider > 0) {
    if (m.bakiye < 0 && Math.abs(m.bakiye) > m.toplamGelir * 0.2) {
      faktorler.push({ id: "nakit", kategori: "nakit", baslik: "Negatif nakit akışı", seviye: "yuksek",
        detay: `Bakiye ${tl(m.bakiye)} (gelir ${tl(m.toplamGelir)}, gider ${tl(m.toplamGider)}).`,
        oneri: "Hakediş/tahsilat takvimini öne çekin; ödeme planını gider takvimiyle eşleyin.", puan: 75 });
    } else if (m.bakiye < 0) {
      faktorler.push({ id: "nakit", kategori: "nakit", baslik: "Nakit dengesi gergin", seviye: "orta",
        detay: `Bakiye ${tl(m.bakiye)}; gider gelirin önünde.`,
        oneri: "Yaklaşan büyük ödemeler için tahsilat/ara finansman planlayın.", puan: 48 });
    } else if (m.toplamGelir > 0) {
      guvenli.push({ baslik: "Nakit akışı pozitif", detay: `Bakiye ${tl(m.bakiye)}.` });
    }
  }
  // harcama hızı artış trendi
  if (muhasebe.length >= 3) {
    const son = giderPencere(muhasebe, bugun, 30);
    const onceki = giderPencere(muhasebe, new Date(Date.parse(bugun) - 30 * 86400000).toISOString().slice(0, 10), 30);
    if (onceki > 0 && son > onceki * 1.4) {
      faktorler.push({ id: "yakma", kategori: "nakit", baslik: "Harcama hızı artıyor", seviye: "orta",
        detay: `Son 30 gün gideri ${tl(son)}, önceki 30 günün %${Math.round((son / onceki - 1) * 100)} üstünde.`,
        oneri: "Hızlanan giderin sebebini (malzeme zammı/ek imalat) belirleyin; nakit rezervini kontrol edin.", puan: 46 });
    }
  }

  /* ── 3) Takvim: gecikme + projeksiyon ── */
  if (io.toplam > 0) {
    const gecikmeOran = io.geciken / io.toplam;
    if (io.geciken >= 3 || gecikmeOran >= 0.25) {
      faktorler.push({ id: "gecikme", kategori: "takvim", baslik: "Takvim gecikmesi", seviye: "yuksek",
        detay: `${io.geciken} iş kalemi termini geçtiği halde tamamlanmadı (toplam ${io.toplam}).`,
        oneri: "Geciken kalemleri kritik yola göre önceliklendirin; ekip takviyesi + revize termin belirleyin.",
        puan: Math.min(95, 70 + io.geciken * 5) });
    } else if (io.geciken >= 1) {
      faktorler.push({ id: "gecikme", kategori: "takvim", baslik: "Bazı işler gecikmede", seviye: "orta",
        detay: `${io.geciken} iş kalemi gecikmede.`,
        oneri: "Sorumlularla yeni termin belirleyin; bağlı işlere etkisini kontrol edin.", puan: 45 });
    } else {
      guvenli.push({ baslik: "Takvim uyumlu", detay: `${io.tamamlanan}/${io.toplam} kalem tamam, gecikme yok.` });
    }
  }
  // tahmini bitiş gecikmesi
  if (proj.gecikmeGun !== undefined && proj.gecikmeGun >= 7) {
    faktorler.push({ id: "bitisproj", kategori: "takvim", baslik: "Tahmini bitiş plandan sonra", seviye: proj.gecikmeGun >= 30 ? "yuksek" : "orta",
      detay: `Mevcut hızla tahmini bitiş ${proj.tahminiBitis} — plana göre ~${proj.gecikmeGun} gün gecikme.`,
      oneri: "İş hızını artıracak kaynak planı yapın; kritik yoldaki kalemleri paralel yürütün.",
      puan: Math.min(90, 55 + proj.gecikmeGun) });
  }

  /* ── 4) Kalite: kusurlar ── */
  const kusurlar = saha.filter((s) => s.tip === "kusur" && s.durum !== "tamam");
  const acilKusur = kusurlar.filter((s) => s.oncelik === "acil" || s.oncelik === "yuksek");
  if (acilKusur.length > 0) {
    faktorler.push({ id: "kusur", kategori: "kalite", baslik: "Yüksek öncelikli kusurlar", seviye: "yuksek",
      detay: `${acilKusur.length} acil/yüksek öncelikli kusur açık (toplam ${kusurlar.length}).`,
      oneri: "Acil kusurları imalat ilerlemeden kapatın; tekrar edende kök neden (malzeme/usta) analizi yapın.",
      puan: Math.min(90, 65 + acilKusur.length * 6) });
  } else if (kusurlar.length >= 4) {
    faktorler.push({ id: "kusur", kategori: "kalite", baslik: "Biriken kusurlar", seviye: "orta",
      detay: `${kusurlar.length} açık kusur kaydı var.`, oneri: "Kusur listesini haftalık kapatma hedefiyle takip edin.", puan: 44 });
  } else if (kusurlar.length === 0 && saha.length > 0) {
    guvenli.push({ baslik: "Kalite kontrol temiz", detay: "Açık kusur kaydı yok." });
  }

  /* ── 5) İş emirleri ── */
  const emirler = saha.filter((s) => s.tip === "isemri" && s.durum !== "tamam");
  const gecikenEmri = emirler.filter((s) => s.termin && s.termin < bugun);
  const acilEmri = emirler.filter((s) => s.oncelik === "acil");
  if (gecikenEmri.length > 0 || acilEmri.length > 0) {
    const n = Math.max(gecikenEmri.length, acilEmri.length);
    faktorler.push({ id: "isemri", kategori: "takvim", baslik: "Bekleyen iş emirleri", seviye: gecikenEmri.length > 0 ? "yuksek" : "orta",
      detay: `${gecikenEmri.length} termini geçmiş, ${acilEmri.length} acil iş emri açık.`,
      oneri: "Termini geçen iş emirlerini bugün yeniden atayın; acil olanlara sorumlu+süre netleştirin.",
      puan: gecikenEmri.length > 0 ? Math.min(88, 68 + n * 5) : 50 });
  }

  /* ── 6) Bağımlılık ihlali ── */
  const idMap = new Map(isKalemleri.map((k) => [k.id, k]));
  const ihlal = isKalemleri.filter((k) =>
    k.ilerleme > 0 && (k.oncekiler ?? []).some((pid) => (idMap.get(pid)?.ilerleme ?? 100) < 100));
  if (ihlal.length > 0) {
    faktorler.push({ id: "bagimlilik", kategori: "takvim", baslik: "Sıralama (bağımlılık) riski", seviye: "orta",
      detay: `${ihlal.length} iş kalemi, öncülü tamamlanmadan başlamış görünüyor (ör. "${ihlal[0].ad}").`,
      oneri: "Öncül işler bitmeden başlayan imalatlarda yeniden iş riski var; sırayı kontrol edin.", puan: 46 });
  }

  /* ── Skor + kategoriler ── */
  faktorler.sort((a, b) => b.puan - a.puan);
  let skor: number;
  if (faktorler.length === 0) {
    skor = 8;
  } else {
    const puanlar = faktorler.map((f) => f.puan);
    skor = Math.min(100, Math.round(puanlar[0] * 0.6 + (puanlar.reduce((s, x) => s + x, 0) / puanlar.length) * 0.4));
  }
  const seviye: RiskSeviye = skor < 30 ? "dusuk" : skor < 60 ? "orta" : "yuksek";

  const kategoriler: KategoriSkor[] = (["maliyet", "takvim", "kalite", "nakit"] as RiskKategori[]).map((kat) => {
    const fs = faktorler.filter((f) => f.kategori === kat);
    return { kategori: kat, skor: fs.length ? Math.max(...fs.map((f) => f.puan)) : 5 };
  });

  const yuksekSayi = faktorler.filter((f) => f.seviye === "yuksek").length;
  const ozet = faktorler.length === 0
    ? "Belirgin bir risk tespit edilmedi. Veri girişi sürdükçe analiz keskinleşir."
    : `${faktorler.length} risk faktörü tespit edildi${yuksekSayi ? ` (${yuksekSayi} yüksek öncelikli)` : ""}. En kritik alan: ${faktorler[0].baslik.toLowerCase()}.`;

  return { skor, seviye, ozet, faktorler, kategoriler, projeksiyon: proj, guvenli, olusturma: new Date().toISOString() };
}

/** Skor → renk (UI). */
export function riskRenk(seviye: RiskSeviye): string {
  return seviye === "yuksek" ? "#dc2626" : seviye === "orta" ? "#d97706" : "#16a34a";
}
export function skorRenk(skor: number): string {
  return riskRenk(skor < 30 ? "dusuk" : skor < 60 ? "orta" : "yuksek");
}
export const SEVIYE_LABEL: Record<RiskSeviye, string> = { dusuk: "Düşük", orta: "Orta", yuksek: "Yüksek" };

/** Claude'a gönderilecek özet metin (API zenginleştirme için). */
export function riskOzetMetni(g: RiskGirdi, r: RiskRapor): string {
  const m = muhasebeOzeti(g.muhasebe);
  const io = isOzeti(g.isKalemleri);
  const p = r.projeksiyon;
  const satir: string[] = [
    `Proje: ${g.project.name} (${g.project.city}, ${g.project.area} m², ${g.project.floors} kat, tip ${g.project.type})`,
    `Bütçe: ${g.project.budget ?? "tanımsız"} ₺ | Gider(AC): ${m.toplamGider} ₺ | Gelir: ${m.toplamGelir} ₺ | Bakiye: ${m.bakiye} ₺`,
    `İlerleme: %${io.genelIlerleme} (${io.tamamlanan}/${io.toplam} tamam, ${io.geciken} geciken)`,
  ];
  if (p.nihaiMaliyet) satir.push(`Projeksiyon (EVM): tahmini nihai maliyet (EAC) ${Math.round(p.nihaiMaliyet)} ₺${p.cpi ? `, CPI ${p.cpi.toFixed(2)}` : ""}${p.butceAsimYuzde !== undefined ? `, bütçe sapması %${Math.round(p.butceAsimYuzde)}` : ""}`);
  if (p.tahminiBitis) satir.push(`Takvim projeksiyonu: tahmini bitiş ${p.tahminiBitis} (planlı ${p.planliBitis}, ${p.gecikmeGun} gün sapma)`);
  if (p.yakmaHizi) satir.push(`Harcama hızı: ~${Math.round(p.yakmaHizi)} ₺/gün (son 30 gün)`);
  satir.push(`Saha: ${g.saha.filter((s) => s.tip === "kusur" && s.durum !== "tamam").length} açık kusur, ${g.saha.filter((s) => s.tip === "isemri" && s.durum !== "tamam").length} açık iş emri`);
  satir.push(`Kategori skorları: ${r.kategoriler.map((k) => `${KATEGORI_LABEL[k.kategori]} ${k.skor}`).join(", ")}`);
  satir.push(`Hesaplanan risk skoru: ${r.skor}/100 (${SEVIYE_LABEL[r.seviye]})`);
  satir.push(`Faktörler: ${r.faktorler.map((f) => `${f.baslik} [${f.seviye}]`).join("; ") || "yok"}`);
  return satir.join("\n");
}
