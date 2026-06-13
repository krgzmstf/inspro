/* ──────────────────────────────────────────────────────────
   mk_ai — Proje Dosyası derleyici

   Seçili projenin TÜM modüllerinden (künye, aşamalar, muhasebe,
   iş süreçleri, saha, metraj, personel, hakediş, teklif) tek bir
   metin "dosya" üretir. mk_ai sohbeti ve değerlendirmesi bu dosyayı
   bağlam olarak alır → projeye tam hâkim olur.

   İstemci tarafında çalışır (veriler localStorage'da). Tüm sayıları
   buradan alır; LLM sayı uydurmaz.
   ────────────────────────────────────────────────────────── */

import { getProject, formatTL } from "./projects";
import { loadMuhasebe, muhasebeOzeti } from "./muhasebe";
import { loadSaha } from "./saha";
import { loadIsSurecleri, isOzeti } from "./isSurecleri";
import { loadMetraj } from "./metraj";
import { loadPersonel } from "./personel";
import { loadHakedisler } from "./hakedis";
import { loadTeklifler, teklifToplam } from "./teklif";

const tl = (n: number) => formatTL(n);

/** Bir projenin tüm verisinden mk_ai için kapsamlı metin dosyası üretir. */
export function mkAiProjeDosyasi(projectId: string): string {
  const p = getProject(projectId);
  if (!p) return "";
  const bugun = new Date().toISOString().slice(0, 10);
  const S: string[] = [];

  // ── Künye ──
  S.push(`# PROJE DOSYASI — ${p.name}`);
  S.push(
    `Şehir: ${p.city} | Tip: ${p.type} | Alan: ${p.area} m² | Kat: ${p.floors} | ` +
      `Bütçe: ${p.budget != null ? tl(p.budget) : "tanımsız"}`,
  );

  // ── Aşamalar ──
  if (p.phases?.length) {
    const sayac = new Map<string, number>();
    for (const f of p.phases) sayac.set(f.status, (sayac.get(f.status) ?? 0) + 1);
    const dagilim = [...sayac.entries()].map(([s, n]) => `${n} ${s}`).join(", ");
    const aktif = p.phases.find((f) => f.status !== "tamam");
    S.push(`\n## Aşamalar (${p.phases.length})`);
    S.push(`Durum dağılımı: ${dagilim}.${aktif ? ` Güncel aşama: ${aktif.name}.` : " Tüm aşamalar tamam."}`);
  }

  // ── Muhasebe (nakit) ──
  const muh = loadMuhasebe(projectId);
  if (muh.length) {
    const m = muhasebeOzeti(muh);
    S.push(`\n## Muhasebe / Nakit (${muh.length} kayıt)`);
    S.push(`Toplam gelir: ${tl(m.toplamGelir)} | Toplam gider: ${tl(m.toplamGider)} | Bakiye: ${tl(m.bakiye)}`);
    if (p.budget && p.budget > 0) {
      S.push(`Bütçe kullanımı: %${Math.round((m.toplamGider / p.budget) * 100)}`);
    }
  } else {
    S.push(`\n## Muhasebe / Nakit\nKayıt yok.`);
  }

  // ── İş süreçleri (takvim/ilerleme) ──
  const isler = loadIsSurecleri(projectId);
  if (isler.length) {
    const io = isOzeti(isler);
    S.push(`\n## İş Süreçleri (${io.toplam} kalem)`);
    S.push(`Genel ilerleme: %${io.genelIlerleme} | Tamamlanan: ${io.tamamlanan} | Geciken: ${io.geciken}`);
    const geciken = isler.filter((k) => k.bitis && k.bitis < bugun && k.ilerleme < 100).slice(0, 8);
    if (geciken.length) {
      S.push(`Geciken kalemler: ${geciken.map((k) => `${k.ad} (%${k.ilerleme}, termin ${k.bitis})`).join("; ")}`);
    }
  } else {
    S.push(`\n## İş Süreçleri\nKalem yok.`);
  }

  // ── Saha (kusur / iş emri) ──
  const saha = loadSaha(projectId);
  if (saha.length) {
    const kusur = saha.filter((s) => s.tip === "kusur");
    const isemri = saha.filter((s) => s.tip === "isemri");
    const acikKusur = kusur.filter((s) => s.durum !== "tamam");
    const acikEmri = isemri.filter((s) => s.durum !== "tamam");
    S.push(`\n## Saha (${saha.length} kayıt)`);
    S.push(
      `Kusur: ${kusur.length} (açık ${acikKusur.length}) | İş emri: ${isemri.length} (açık ${acikEmri.length})`,
    );
    const oncelikli = [...acikKusur, ...acikEmri]
      .filter((s) => s.oncelik === "acil" || s.oncelik === "yuksek")
      .slice(0, 8);
    if (oncelikli.length) {
      S.push(
        `Öncelikli açık kayıtlar: ${oncelikli
          .map((s) => `[${s.tip === "kusur" ? "Kusur" : "İş emri"}] ${s.baslik} (${s.oncelik}${s.sorumlu ? `, ${s.sorumlu}` : ""}${s.termin ? `, termin ${s.termin}` : ""})`)
          .join("; ")}`,
      );
    }
  } else {
    S.push(`\n## Saha\nKayıt yok.`);
  }

  // ── Metraj ──
  const metraj = loadMetraj(projectId);
  if (metraj.length) {
    const mahaller = new Set(metraj.map((m) => m.mahal));
    S.push(`\n## Metraj (${metraj.length} satır, ${mahaller.size} mahal)`);
  }

  // ── Personel ──
  const personel = loadPersonel(projectId);
  if (personel.length) {
    const aktif = personel.filter((k) => k.aktif);
    const gorevler = new Map<string, number>();
    for (const k of aktif) gorevler.set(k.gorev || "—", (gorevler.get(k.gorev || "—") ?? 0) + 1);
    const gunlukMaliyet = aktif.reduce((s, k) => s + (k.yevmiye || 0), 0);
    S.push(`\n## Personel (${personel.length}, aktif ${aktif.length})`);
    S.push(
      `Görev dağılımı: ${[...gorevler.entries()].map(([g, n]) => `${n} ${g}`).join(", ")}. ` +
        `Toplam günlük yevmiye: ${tl(gunlukMaliyet)}`,
    );
  }

  // ── Hakediş ──
  const hakedisler = loadHakedisler(projectId);
  if (hakedisler.length) {
    const taseronlar = new Set(hakedisler.map((h) => h.taseron).filter(Boolean));
    S.push(`\n## Hakediş (${hakedisler.length} hakediş, ${taseronlar.size} taşeron)`);
  }

  // ── Teklif ──
  const teklifler = loadTeklifler(projectId);
  if (teklifler.length) {
    const toplam = teklifler.reduce((s, t) => s + teklifToplam(t).genelToplam, 0);
    S.push(`\n## Teklifler (${teklifler.length})`);
    S.push(`Toplam teklif tutarı: ${tl(toplam)}`);
  }

  return S.join("\n");
}
