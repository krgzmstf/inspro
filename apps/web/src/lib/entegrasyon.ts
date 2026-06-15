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
