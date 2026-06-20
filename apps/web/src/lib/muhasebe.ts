/* ——————————————————————————————————————————————————
   insPRO — Muhasebe (profesyonel) veri katmanlı

   Her hareket bir projeye bağlı. Profesyonel sürüm:
   • KDV (matrah / oran / tutar) + KDV tevkifatı (yapı işleri)
   • Vade ve ödeme durumu (açık / kısmi / ödendi) + ödenen tutar
   • Cari hesap (taraf bazında borç/alacak + ekstre + yaşlandırma)
   • Kasa/Banka hesabı bağlama (bkz. finansHesap.ts)
   • Raporlar: gelir tablosu, nakit akış, KDV özeti

   Eski (v1) kayıtlarla geriye dönük uyumludur: eksik alanlar
   yükleme sırasında makul varsayılanlarla doldurulur.

   Geçici: localStorage. Supabase'e geçişte tek bu katman döner.
   —————————————————————————————————————————————————— */

import { muhasebeBulutaYaz, muhasebeBuluttanSil } from "./muhasebeSenkron";
import { islemKaydet } from "./islemLog";

export type KayitTipi = "gelir" | "gider";
export type OdemeDurumu = "acik" | "kismi" | "odendi";

export const GIDER_KATEGORILERI = [
  "Malzeme", "İşçilik", "Taşeron / Hakediş", "Makine - Ekipman",
  "Nakliye", "Ruhsat / Harç", "Abonelik (su/elektrik/gaz)",
  "Genel Gider", "Diğer",
] as const;

export const GELIR_KATEGORILERI = [
  "Daire Satışı", "Kapora / Avans", "Hakediş Tahsilatı",
  "Kira Geliri", "Kat Karşılığı", "Diğer",
] as const;

/** Türkiye güncel KDV oranları (%). */
export const KDV_ORANLARI = [0, 1, 10, 20] as const;

/** KDV tevkifat oranları (KDV'nin alıcı tarafından kesilen kısmı).
   Yapı (inşaat) işlerinde tipik oran 4/10'dur. */
export const TEVKIFAT_ORANLARI = [
  { etiket: "Yok", oran: 0 },
  { etiket: "2/10", oran: 0.2 },
  { etiket: "3/10", oran: 0.3 },
  { etiket: "4/10 (yapı işleri)", oran: 0.4 },
  { etiket: "5/10", oran: 0.5 },
  { etiket: "7/10", oran: 0.7 },
  { etiket: "9/10", oran: 0.9 },
  { etiket: "10/10", oran: 1 },
] as const;

export interface MuhasebeKayit {
  id: string;
  projectId: string;
  tip: KayitTipi;
  kategori: string;
  aciklama: string;
  taraf: string;          // cari (tedarikçi / müşteri / usta) adı
  belgeNo?: string;       // fatura / fiş no
  // —— tutar & vergi ——
  matrah: number;         // KDV hariç tutar (₺)
  kdvOran: number;        // %
  kdvTutar: number;       // matrah × oran
  tevkifatOran: number;   // 0..1 (KDV'nin kesilen kısmı)
  tevkifatTutar: number;  // kdvTutar × tevkifatOran
  tutar: number;          // brüt fatura = matrah + kdvTutar
  net: number;            // cariye yansıyan / ödenecek = brüt − tevkifat
  // —— vade & ödeme ——
  tarih: string;          // işlem / fatura tarihi (ISO gün)
  vadeTarihi?: string;    // ISO gün
  durum: OdemeDurumu;
  odenenTutar: number;    // tahsil / ödenen kısım (₺)
  hesapId?: string;       // ödemenin geçtiği kasa/banka hesabı
  createdAt: string;
}

const STORAGE_KEY = "inspro-muhasebe";

/** KDV ve tevkifatı matrah + oranlardan hesaplar. */
export function hesaplaTutarlar(matrah: number, kdvOran: number, tevkifatOran: number) {
  const kdvTutar = +(matrah * (kdvOran / 100)).toFixed(2);
  const tutar = +(matrah + kdvTutar).toFixed(2);
  const tevkifatTutar = +(kdvTutar * tevkifatOran).toFixed(2);
  const net = +(tutar - tevkifatTutar).toFixed(2);
  return { kdvTutar, tutar, tevkifatTutar, net };
}

/** Eski (v1) veya eksik kayıtları tam modele tamamlar. */
function normalize(raw: Partial<MuhasebeKayit> & { tutar: number }): MuhasebeKayit {
  // v1 kaydında yalnız brüt "tutar" vardı; KDV/tevkifat yoktu.
  const matrah = raw.matrah ?? raw.tutar;
  const kdvOran = raw.kdvOran ?? 0;
  const tevkifatOran = raw.tevkifatOran ?? 0;
  const h = hesaplaTutarlar(matrah, kdvOran, tevkifatOran);
  const durum: OdemeDurumu = raw.durum ?? "odendi"; // eski kayıtlar ödenmiş sayılır
  const net = raw.net ?? h.net;
  return {
    id: raw.id ?? crypto.randomUUID(),
    projectId: raw.projectId ?? "",
    tip: raw.tip ?? "gider",
    kategori: raw.kategori ?? "Diğer",
    aciklama: raw.aciklama ?? "",
    taraf: raw.taraf ?? "",
    belgeNo: raw.belgeNo,
    matrah,
    kdvOran,
    kdvTutar: raw.kdvTutar ?? h.kdvTutar,
    tevkifatOran,
    tevkifatTutar: raw.tevkifatTutar ?? h.tevkifatTutar,
    tutar: raw.tutar ?? h.tutar,
    net,
    tarih: raw.tarih ?? new Date().toISOString().slice(0, 10),
    vadeTarihi: raw.vadeTarihi,
    durum,
    odenenTutar: raw.odenenTutar ?? (durum === "odendi" ? net : 0),
    hesapId: raw.hesapId,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function loadAll(): MuhasebeKayit[] {
  if (typeof window === "undefined") return [];
  try {
    const ham: (Partial<MuhasebeKayit> & { tutar: number })[] =
      JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return ham.map(normalize);
  } catch {
    return [];
  }
}

export function saveMuhasebe(kayitlar: MuhasebeKayit[]) {
  saveAll(kayitlar);
}

function saveAll(kayitlar: MuhasebeKayit[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kayitlar));
}

/** Tüm projelerdeki hareketler (kasa/banka bakiyesi için). */
export function loadAllMuhasebe(): MuhasebeKayit[] {
  return loadAll();
}

export function loadMuhasebe(projectId: string): MuhasebeKayit[] {
  return loadAll()
    .filter((k) => k.projectId === projectId)
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
}

export function addMuhasebe(
  data: Omit<MuhasebeKayit, "id" | "createdAt" | "kdvTutar" | "tevkifatTutar" | "tutar" | "net">,      
): MuhasebeKayit {
  const h = hesaplaTutarlar(data.matrah, data.kdvOran, data.tevkifatOran);
  const kayit: MuhasebeKayit = {
    ...data,
    ...h,
    odenenTutar: data.durum === "odendi" ? h.net : (data.odenenTutar ?? 0),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  saveAll([...loadAll(), kayit]);
  void muhasebeBulutaYaz(kayit);
  islemKaydet("olustur", "muhasebe", kayit.aciklama || kayit.taraf, { tutar: kayit.net, tip: kayit.tip });
  return kayit;
}

export function deleteMuhasebe(id: string) {
  const k = loadAll().find((x) => x.id === id);
  saveAll(loadAll().filter((k) => k.id !== id));
  void muhasebeBuluttanSil(id);
  islemKaydet("sil", "muhasebe", k ? (k.aciklama || k.taraf) : id);
}

/** Bir kaydı günceller; matrah/oran değişirse türetilenleri yeniden hesaplar.
   patch.durum verilmezse ödenen tutara göre durum yeniden türetilir. */
export function updateMuhasebe(id: string, patch: Partial<MuhasebeKayit>): MuhasebeKayit | undefined { 
  const hepsi = loadAll();
  const i = hepsi.findIndex((k) => k.id === id);
  if (i < 0) return undefined;
  let k = { ...hepsi[i], ...patch };
  const h = hesaplaTutarlar(k.matrah, k.kdvOran, k.tevkifatOran);
  k = { ...k, ...h };
  k.odenenTutar = Math.min(k.net, Math.max(0, k.odenenTutar));
  if (patch.durum === undefined) {
    k.durum = k.odenenTutar <= 0 ? "acik" : k.odenenTutar >= k.net ? "odendi" : "kismi";
  } else if (k.durum === "odendi") {
    k.odenenTutar = k.net;
  }
  hepsi[i] = k;
  saveAll(hepsi);
  void muhasebeBulutaYaz(k);
  return k;
}

/** Tahsilat / ödeme kaydet — ödenen tutarı artırır, durumu günceller. */
export function odemeKaydet(id: string, ekTutar: number, hesapId?: string): MuhasebeKayit | undefined {
  const hepsi = loadAll();
  const idx = hepsi.findIndex((k) => k.id === id);
  if (idx < 0) return undefined;
  const k = hepsi[idx];
  const yeniOdenen = Math.min(k.net, +(k.odenenTutar + ekTutar).toFixed(2));
  const durum: OdemeDurumu = yeniOdenen <= 0 ? "acik" : yeniOdenen >= k.net ? "odendi" : "kismi";      
  const guncel = { ...k, odenenTutar: yeniOdenen, durum, hesapId: hesapId ?? k.hesapId };
  hepsi[idx] = guncel;
  saveAll(hepsi);
  void muhasebeBulutaYaz(guncel);
  islemKaydet("odeme", "muhasebe", guncel.aciklama || guncel.taraf, { ekTutar });
  return guncel;
}

/* —— Özet ——————————————————————————————
————————————————————— */

export interface MuhasebeOzet {
  toplamGelir: number;    // brüt
  toplamGider: number;    // brüt
  bakiye: number;
  tahsilEdilen: number;   // gelir odenenTutar
  odenen: number;         // gider odenenTutar
  acikAlacak: number;     // gelir net − tahsil
  acikBorc: number;       // gider net − ödenen
  giderKategorileri: { kategori: string; tutar: number }[];
  gelirKategorileri: { kategori: string; tutar: number }[];
}

export function muhasebeOzeti(kayitlar: MuhasebeKayit[]): MuhasebeOzet {
  const giderMap = new Map<string, number>();
  const gelirMap = new Map<string, number>();
  let toplamGelir = 0, toplamGider = 0, tahsilEdilen = 0, odenen = 0, acikAlacak = 0, acikBorc = 0;    

  for (const k of kayitlar) {
    if (k.tip === "gelir") {
      toplamGelir += k.tutar;
      tahsilEdilen += k.odenenTutar;
      acikAlacak += k.net - k.odenenTutar;
      gelirMap.set(k.kategori, (gelirMap.get(k.kategori) ?? 0) + k.tutar);
    } else {
      toplamGider += k.tutar;
      odenen += k.odenenTutar;
      acikBorc += k.net - k.odenenTutar;
      giderMap.set(k.kategori, (giderMap.get(k.kategori) ?? 0) + k.tutar);
    }
  }

  const sirala = (m: Map<string, number>) =>
    [...m.entries()].map(([kategori, tutar]) => ({ kategori, tutar })).sort((a, b) => b.tutar - a.tutar
);

  return {
    toplamGelir, toplamGider, bakiye: toplamGelir - toplamGider,
    tahsilEdilen, odenen,
    acikAlacak: +acikAlacak.toFixed(2), acikBorc: +acikBorc.toFixed(2),
    giderKategorileri: sirala(giderMap),
    gelirKategorileri: sirala(gelirMap),
  };
}

/* —— Cari hesaplar ——————————————————————————————————
——————————————— */

export interface CariHesap {
  taraf: string;
  alacak: number;   // bizim alacağımız (müşteri bize borçlu) — açık gelir net
  borc: number;     // bizim borcumuz (tedarikçiye) — açık gider net
  bakiye: number;   // alacak − borç (+ ise lehimize)
  hareketSayisi: number;
}

/** Taraf bazında açık alacak/borç bakiyeleri. */
export function cariHesaplar(kayitlar: MuhasebeKayit[]): CariHesap[] {
  const map = new Map<string, CariHesap>();
  for (const k of kayitlar) {
    const ad = k.taraf.trim() || "(belirtilmemiş)";
    const c = map.get(ad) ?? { taraf: ad, alacak: 0, borc: 0, bakiye: 0, hareketSayisi: 0 };
    const acik = +(k.net - k.odenenTutar).toFixed(2);
    if (k.tip === "gelir") c.alacak += acik;
    else c.borc += acik;
    c.hareketSayisi += 1;
    map.set(ad, c);
  }
  return [...map.values()]
    .map((c) => ({ ...c, alacak: +c.alacak.toFixed(2), borc: +c.borc.toFixed(2), bakiye: +(c.alacak - c
.borc).toFixed(2) }))
    .sort((a, b) => Math.abs(b.bakiye) - Math.abs(a.bakiye));
}

export interface EkstreSatir {
  tarih: string;
  aciklama: string;
  belgeNo?: string;
  borc: number;       // bu satırın bize yüklediği borç (gider net)
  alacak: number;     // bu satırın bize sağladığı alacak (gelir net)
  yuruyenBakiye: number;
}

/** Bir cari için kronolojik ekstre + yürüyen bakiye. */
export function cariEkstre(kayitlar: MuhasebeKayit[], taraf: string): EkstreSatir[] {
  const sirali = kayitlar
    .filter((k) => (k.taraf.trim() || "(belirtilmemiş)") === taraf)
    .sort((a, b) => a.tarih.localeCompare(b.tarih));
  let bakiye = 0;
  return sirali.map((k) => {
    const alacak = k.tip === "gelir" ? k.net : 0;
    const borc = k.tip === "gider" ? k.net : 0;
    bakiye += alacak - borc;
    return {
      tarih: k.tarih,
      aciklama: `${k.kategori}${k.aciklama ? " — " + k.aciklama : ""}`,
      belgeNo: k.belgeNo,
      borc, alacak,
      yuruyenBakiye: +bakiye.toFixed(2),
    };
  });
}

/* —— Yaşlandırma (vade analizi) ——————————————————————
——————— */

export interface YaslandirmaKova {
  etiket: string;
  alacak: number;
  borc: number;
}

/** Açık hareketleri vade gecikmesine göre kovalara böler. */
export function yaslandirma(kayitlar: MuhasebeKayit[], bugun = new Date()): YaslandirmaKova[] {        
  const kovalar: YaslandirmaKova[] = [
    { etiket: "Vadesi gelmemiş", alacak: 0, borc: 0 },
    { etiket: "0–30 gün", alacak: 0, borc: 0 },
    { etiket: "31–60 gün", alacak: 0, borc: 0 },
    { etiket: "61–90 gün", alacak: 0, borc: 0 },
    { etiket: "90+ gün", alacak: 0, borc: 0 },
  ];
  const gun = 86400000;
  for (const k of kayitlar) {
    const acik = +(k.net - k.odenenTutar).toFixed(2);
    if (acik <= 0.005) continue;
    const vade = k.vadeTarihi ? new Date(k.vadeTarihi) : new Date(k.tarih);
    const gecikme = Math.floor((bugun.getTime() - vade.getTime()) / gun);
    let i: number;
    if (gecikme < 0) i = 0;
    else if (gecikme <= 30) i = 1;
    else if (gecikme <= 60) i = 2;
    else if (gecikme <= 90) i = 3;
    else i = 4;
    if (k.tip === "gelir") kovalar[i].alacak += acik;
    else kovalar[i].borc += acik;
  }
  return kovalar.map((k) => ({ ...k, alacak: +k.alacak.toFixed(2), borc: +k.borc.toFixed(2) }));       
}

/* —— KDV özeti (beyanname mantığı) ————————————————————
——————————— */

export interface KdvOzet {
  hesaplananKdv: number;    // satışların (gelir) KDV'si
  indirilecekKdv: number;   // alışların (gider) KDV'si
  tevkifEdilenKdv: number;  // tevkifata uğrayan KDV (gider tarafı)
  odenecekKdv: number;      // hesaplanan − indirilecek (negatifse devreden)
}

export function kdvOzeti(kayitlar: MuhasebeKayit[]): KdvOzet {
  let hesaplananKdv = 0, indirilecekKdv = 0, tevkifEdilenKdv = 0;
  for (const k of kayitlar) {
    if (k.tip === "gelir") hesaplananKdv += k.kdvTutar;
    else {
      indirilecekKdv += k.kdvTutar;
      tevkifEdilenKdv += k.tevkifatTutar;
    }
  }
  return {
    hesaplananKdv: +hesaplananKdv.toFixed(2),
    indirilecekKdv: +indirilecekKdv.toFixed(2),
    tevkifEdilenKdv: +tevkifEdilenKdv.toFixed(2),
    odenecekKdv: +(hesaplananKdv - indirilecekKdv).toFixed(2),
  };
}

/* —— Gelir tablosu (KDV hariç / matrah bazlı) —————————————— */     

export interface GelirTablosu {
  gelir: { kategori: string; tutar: number }[];
  gider: { kategori: string; tutar: number }[];
  toplamGelir: number;
  toplamGider: number;
  brutKar: number;
}

export function gelirTablosu(kayitlar: MuhasebeKayit[]): GelirTablosu {
  const gMap = new Map<string, number>(), eMap = new Map<string, number>();
  let toplamGelir = 0, toplamGider = 0;
  for (const k of kayitlar) {
    if (k.tip === "gelir") { toplamGelir += k.matrah; gMap.set(k.kategori, (gMap.get(k.kategori) ?? 0) 
+ k.matrah); }
    else { toplamGider += k.matrah; eMap.set(k.kategori, (eMap.get(k.kategori) ?? 0) + k.matrah); }    
  }
  const arr = (m: Map<string, number>) =>
    [...m.entries()].map(([kategori, tutar]) => ({ kategori, tutar: +tutar.toFixed(2) })).sort((a, b) => b.tutar - a.tutar);
  return {
    gelir: arr(gMap), gider: arr(eMap),
    toplamGelir: +toplamGelir.toFixed(2), toplamGider: +toplamGider.toFixed(2),
    brutKar: +(toplamGelir - toplamGider).toFixed(2),
  };
}

/* —— Nakit akış (gerçekleşen, aylık) —————————————————————
————— */

export interface NakitAy {
  ay: string;        // "2026-06"
  tahsilat: number;  // gerçekleşen gelir ödemesi
  odeme: number;     // gerçekleşen gider ödemesi
  net: number;
}

/** Ödenen tutarları işlem ayına göre toplayan nakit akış. */
export function nakitAkis(kayitlar: MuhasebeKayit[]): NakitAy[] {
  const map = new Map<string, { tahsilat: number; odeme: number }>();
  for (const k of kayitlar) {
    if (k.odenenTutar <= 0) continue;
    const ay = k.tarih.slice(0, 7);
    const m = map.get(ay) ?? { tahsilat: 0, odeme: 0 };
    if (k.tip === "gelir") m.tahsilat += k.odenenTutar;
    else m.odeme += k.odenenTutar;
    map.set(ay, m);
  }
  return [...map.entries()]
    .map(([ay, m]) => ({ ay, tahsilat: +m.tahsilat.toFixed(2), odeme: +m.odeme.toFixed(2), net: +(m.tahsilat - m.odeme).toFixed(2) }))
    .sort((a, b) => a.ay.localeCompare(b.ay));
}
