/* ──────────────────────────────────────────────────────────
   insPRO — Modül Entegrasyonu: İş Takibi (aşama kalemleri) ↔ Muhasebe

   Akış (onaylı muhasebeleştirme):
   • Aşama kalemine PLANLANAN fiyat girilince muhasebeye "tahmini
     ödenecek" (AÇIK gider) kaydı düşer — belgeNo "ASAMA:<id>".
   • İş Takibi'nde "Ödendi" işaretlense bile muhasebe OTOMATİK ödendi
     OLMAZ. Bunun yerine muhasebede "muhasebeleştirme bekliyor"
     kuyruğuna girer (üstte turuncu, yanıp sönen kutucuk).
   • Kullanıcı eksik muhasebe alanlarını (KDV, tevkifat, kategori,
     hesap, tarih) doldurup ONAYLAYINCA kayıt "ödendi" olur.
   • Onaylı (ödendi) kayıtlara senkron dokunmaz; kalem silinirse
     yalnız AÇIK karşılığı temizlenir (ödenmiş geçmiş korunur).

   Tamamen istemci tarafı + localStorage. API anahtarı GEREKMEZ.
   ────────────────────────────────────────────────────────── */

import { getProject } from "./projects";
import { type AsamaKalem, projeTumKalemler } from "./asamaKalem";
import {
  type MuhasebeKayit, loadMuhasebe, addMuhasebe, updateMuhasebe, deleteMuhasebe,
} from "./muhasebe";
import {
  type IsKalemi, isKalemleriHam, addIsKalemi, updateIsKalemi, deleteIsKalemi,
} from "./isSurecleri";
import { loadPersonel, loadPuantajAy, ayinGunleri, personelGun } from "./personel";

const ASAMA_ON = "ASAMA:";
const ASAMA_BELGE = (kalemId: string) => `${ASAMA_ON}${kalemId}`;
const bugun = () => new Date().toISOString().slice(0, 10);

/** Aşama adına göre muhasebe gider kategorisi (ön tanımlı tahmin). */
function asamaKategori(asama: string): string {
  if (asama.includes("Ruhsat") || asama.includes("Zemin")) return "Ruhsat / Harç";
  if (asama.includes("Şantiye")) return "Genel Gider";
  return "Taşeron / Hakediş";
}

function kalemMatrah(k: AsamaKalem): number {
  return Math.max(k.fiyat ?? 0, k.alinan ?? 0);
}

export interface SenkronSonuc { olusturulan: number; guncellenen: number; silinen: number; }

/** Aşama kalemlerini muhasebeyle eşitler — yalnız AÇIK (tahmini ödenecek).
   Ödendi'ye çevirmez; onaylı kayıtlara dokunmaz. */
export function senkronAsamaMuhasebe(projectId: string): SenkronSonuc {
  const proje = getProject(projectId);
  if (!proje) return { olusturulan: 0, guncellenen: 0, silinen: 0 };

  const flat = Object.values(projeTumKalemler(projectId)).flat();
  const muh = loadMuhasebe(projectId);
  const bagli = new Map<string, MuhasebeKayit>();
  for (const m of muh) if (m.belgeNo?.startsWith(ASAMA_ON)) bagli.set(m.belgeNo, m);

  const gecerli = new Set<string>();
  let olusturulan = 0, guncellenen = 0, silinen = 0;

  for (const k of flat) {
    const matrah = kalemMatrah(k);
    if (matrah <= 0) continue;
    const belge = ASAMA_BELGE(k.id);
    gecerli.add(belge);
    const mevcut = bagli.get(belge);

    if (!mevcut) {
      addMuhasebe({
        projectId, tip: "gider", kategori: asamaKategori(k.asama),
        aciklama: `${k.asama} — ${k.ad}`,
        taraf: k.personelAd ?? "", belgeNo: belge,
        matrah, kdvOran: 0, tevkifatOran: 0,
        tarih: k.bitis || k.baslangic || bugun(),
        vadeTarihi: k.bitis || undefined,
        durum: "acik", odenenTutar: 0,
      });
      olusturulan++;
    } else if (mevcut.durum !== "odendi") {
      // henüz onaylanmamış (açık) kaydı güncel tut
      const degisti =
        Math.abs(mevcut.matrah - matrah) > 0.001 ||
        mevcut.durum !== "acik" ||
        mevcut.taraf !== (k.personelAd ?? mevcut.taraf);
      if (degisti) {
        updateMuhasebe(mevcut.id, {
          matrah, durum: "acik", odenenTutar: 0,
          taraf: k.personelAd ?? mevcut.taraf,
          aciklama: `${k.asama} — ${k.ad}`,
        });
        guncellenen++;
      }
    }
    // mevcut.durum === "odendi" → onaylanmış, dokunma
  }

  // Silinen kalemlerin AÇIK karşılıklarını temizle (ödenmiş geçmiş korunur)
  for (const [belge, m] of bagli) {
    if (!gecerli.has(belge) && m.durum !== "odendi") {
      deleteMuhasebe(m.id);
      silinen++;
    }
  }

  return { olusturulan, guncellenen, silinen };
}

export interface BekleyenMuh {
  muhasebeId: string;
  kalemId: string;
  asama: string;
  ad: string;
  kisi?: string;
  matrah: number;
}

/* ── Puantaj → Muhasebe (aylık işçilik gideri) ───────────── */

const PUANTAJ_ON = "PUANTAJ:";
const puantajBelge = (personelId: string, ay: string) => `${PUANTAJ_ON}${personelId}:${ay}`;

/** Bir ayın puantaj işçiliğini muhasebeye "açık (tahmini ödenecek) işçilik"
   gideri olarak işler — kişi başı bir kayıt (cari = çalışan). */
export function senkronPuantajMuhasebe(projectId: string, ay: string): SenkronSonuc {
  const proje = getProject(projectId);
  if (!proje) return { olusturulan: 0, guncellenen: 0, silinen: 0 };

  const personel = loadPersonel(projectId);
  const harita = loadPuantajAy(projectId, ay);
  const gunler = ayinGunleri(ay);
  const muh = loadMuhasebe(projectId);
  const bagli = new Map<string, MuhasebeKayit>();
  for (const m of muh) if (m.belgeNo?.startsWith(`${PUANTAJ_ON}`) && m.belgeNo.endsWith(`:${ay}`)) bagli.set(m.belgeNo, m);

  let olusturulan = 0, guncellenen = 0, silinen = 0;
  const gecerli = new Set<string>();

  for (const p of personel) {
    const gun = personelGun(harita, p.id, gunler);
    const tutar = +(gun * (p.yevmiye || 0)).toFixed(2);
    const belge = puantajBelge(p.id, ay);
    const mevcut = bagli.get(belge);
    if (tutar <= 0) {
      if (mevcut && mevcut.durum !== "odendi") { deleteMuhasebe(mevcut.id); silinen++; }
      continue;
    }
    gecerli.add(belge);
    const aciklama = `İşçilik ${ay} — ${gun} gün`;
    if (!mevcut) {
      addMuhasebe({
        projectId, tip: "gider", kategori: "İşçilik", aciklama,
        taraf: `${p.ad} ${p.soyad}`.trim(), belgeNo: belge,
        matrah: tutar, kdvOran: 0, tevkifatOran: 0,
        tarih: `${ay}-01`, durum: "acik", odenenTutar: 0,
      });
      olusturulan++;
    } else if (mevcut.durum !== "odendi") {
      if (Math.abs(mevcut.matrah - tutar) > 0.001 || mevcut.aciklama !== aciklama) {
        updateMuhasebe(mevcut.id, { matrah: tutar, durum: "acik", odenenTutar: 0, aciklama, taraf: `${p.ad} ${p.soyad}`.trim() });
        guncellenen++;
      }
    }
  }
  return { olusturulan, guncellenen, silinen };
}

/* ── Aşama kalemleri → İş Süreçleri (Gantt/program) ──────── */

function kalemIlerleme(durum: AsamaKalem["durum"]): number {
  return durum === "tamam" ? 100 : durum === "devam" ? 50 : 0;
}

/** Aşama iş kalemlerini İş Süreçleri programına yansıtır (kaynakKalemId ile bağlı). */
export function senkronAsamaIsSurecleri(projectId: string): SenkronSonuc {
  const flat = Object.values(projeTumKalemler(projectId)).flat();
  const mevcutler = isKalemleriHam(projectId);
  const bagliMap = new Map<string, IsKalemi>();
  for (const k of mevcutler) if (k.kaynakKalemId) bagliMap.set(k.kaynakKalemId, k);

  const gecerli = new Set<string>();
  let olusturulan = 0, guncellenen = 0, silinen = 0;

  for (const k of flat) {
    gecerli.add(k.id);
    const hedef = {
      ad: k.ad, grup: k.asama, sorumlu: k.personelAd ?? "",
      baslangic: k.baslangic ?? "", bitis: k.bitis ?? "",
      ilerleme: kalemIlerleme(k.durum),
    };
    const mevcut = bagliMap.get(k.id);
    if (!mevcut) {
      addIsKalemi({ projectId, ...hedef, oncekiler: [], kaynakKalemId: k.id });
      olusturulan++;
    } else {
      const degisti =
        mevcut.ad !== hedef.ad || mevcut.grup !== hedef.grup || mevcut.sorumlu !== hedef.sorumlu ||
        mevcut.baslangic !== hedef.baslangic || mevcut.bitis !== hedef.bitis || mevcut.ilerleme !== hedef.ilerleme;
      if (degisti) { updateIsKalemi(mevcut.id, hedef); guncellenen++; }
    }
  }

  // Silinen aşama kalemlerinin İş Süreçleri karşılığını temizle
  for (const [kaynakId, k] of bagliMap) {
    if (!gecerli.has(kaynakId)) { deleteIsKalemi(k.id); silinen++; }
  }

  return { olusturulan, guncellenen, silinen };
}

/** Muhasebeleştirme bekleyenler: aşamada "Ödendi" işaretli ama muhasebe
   kaydı henüz onaylanmamış (ödendi olmamış) kalemler. */
export function bekleyenMuhasebelestirme(projectId: string): BekleyenMuh[] {
  const flat = Object.values(projeTumKalemler(projectId)).flat();
  const odenenIds = new Set(flat.filter((k) => k.odendi).map((k) => k.id));
  const kalemById = new Map(flat.map((k) => [k.id, k]));
  const sonuc: BekleyenMuh[] = [];
  for (const m of loadMuhasebe(projectId)) {
    if (!m.belgeNo?.startsWith(ASAMA_ON) || m.durum === "odendi") continue;
    const kalemId = m.belgeNo.slice(ASAMA_ON.length);
    if (!odenenIds.has(kalemId)) continue;
    const k = kalemById.get(kalemId);
    sonuc.push({
      muhasebeId: m.id, kalemId,
      asama: k?.asama ?? "", ad: k?.ad ?? m.aciklama,
      kisi: k?.personelAd, matrah: m.matrah,
    });
  }
  return sonuc;
}
