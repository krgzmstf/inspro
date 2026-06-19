import { z } from "zod";
import { aktifSaglayicilar, mkAiUret, type SaglayiciId } from "@/lib/aiSaglayici";
import { hizSiniri } from "@/lib/hizSiniri";

/* ──────────────────────────────────────────────────────────
   mk_ai — Proje Risk Yorumu (sunucu tarafı)

   POST /api/mk-ai
   Body: { ozet: string, skor: number, seviye: string, tercih?: SaglayiciId }

   Kural-bazlı motor (lib/mkAi.ts) skoru + faktörleri üretir
   (OTORİTE). Bu uç o özeti alıp ÜCRETSIZ bir LLM ile yönetici
   diliyle DEĞERLENDİRME + ÖNERİLER yazar (YORUMCU).

   v4: Çok-sağlayıcılı kendi platformumuz (lib/aiSaglayici.ts).
   Gemini / DeepSeek / GitHub Models arasında otomatik seçim +
   fallback. Paralı Anthropic bağımlılığı kaldırıldı. Yapılandırılmış
   çıktı (Vercel AI SDK generateObject + Zod) korunur.

   Hiçbir sağlayıcı anahtarı yoksa demo yorum döner (UI denenebilsin).
   GÜVENLİK: API anahtarları yalnızca sunucuda (env) tutulur.
   ────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const maxDuration = 60;

interface Govde {
  ozet?: string;
  skor?: number;
  seviye?: string;
  tercih?: SaglayiciId;
}

const RiskKategori = z.enum(["maliyet", "takvim", "kalite", "nakit"]);

const mkAiCikti = z.object({
  yorum: z
    .string()
    .describe("2-4 cümlelik yönetici değerlendirmesi (markdown olabilir). Önce en kritik kalemi söyle."),
  oneriler: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Öncelik sırasına göre somut, ölçülebilir, bu hafta uygulanabilir eylemler (kim/ne/ne zaman)."),
  kategoriOdak: RiskKategori.describe("Bu projede en kritik risk kategorisi."),
  guven: z
    .number()
    .min(0)
    .max(1)
    .describe("Veri yeterliliğine göre değerlendirmeye duyulan güven (0-1). Veri azsa düşür."),
});

const SISTEM =
  "Sen mk_ai adlı, kıdemli bir inşaat proje kontrol (cost & schedule control) uzmanısın. Earned Value " +
  "Management (CPI, EAC, tahmini bitiş) ve risk yönetimi konusunda uzmansın. Sana verilen kural-bazlı analizi " +
  "ve EVM projeksiyonlarını yorumlarsın. Kurallar: (1) SADECE verilen veriye dayan, sayı uydurma; veri yetersizse " +
  "guven değerini düşür. (2) Önce en kritik kalemi söyle. (3) Öneriler somut, ölçülebilir ve bu hafta " +
  "uygulanabilir olsun (kim/ne/ne zaman). (4) CPI<1 veya bütçe sapması varsa maliyet kontrolüne, gecikme varsa " +
  "kritik yola odaklan. (5) Türkçe, kısa, abartısız yaz.";

export async function POST(req: Request) {
  const rl = hizSiniri(req, 30); if (rl) return rl;
  let body: Govde;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const ozet = (body.ozet ?? "").trim();
  if (!ozet) return Response.json({ error: "Analiz özeti boş." }, { status: 400 });

  // ── Demo modu (hiç sağlayıcı anahtarı yok) ──
  if (aktifSaglayicilar().length === 0) {
    const sev = body.seviye ?? "orta";
    const yorum =
      `**mk_ai değerlendirmesi (demo).** Hesaplanan risk skoru ${body.skor ?? "-"}/100 — ${sev} seviye. ` +
      `Aşağıdaki kural-bazlı faktörler önceliklendirilmeli; en yüksek puanlı kalemden başlayın. ` +
      `Gerçek AI yorumu için bir ücretsiz sağlayıcı anahtarı tanımlayın (Gemini / DeepSeek / GitHub Models).`;
    const oneriler = [
      "En yüksek puanlı risk faktörünü bu hafta kapatmayı hedefleyin.",
      "Bütçe ve ilerleme verisini güncel tutun; analiz veriyle keskinleşir.",
      "Geciken iş kalemlerine yeni termin ve sorumlu atayın.",
    ];
    return Response.json({ demoMode: true, saglayici: null, yorum, oneriler, kategoriOdak: null, guven: null });
  }

  // ── Gerçek mod (çok-sağlayıcılı, fallback'li) ──
  try {
    const sonuc = await mkAiUret({
      schema: mkAiCikti,
      schemaName: "mkAiDegerlendirme",
      schemaDescription: "mk_ai inşaat proje risk değerlendirmesi ve öncelikli eylem önerileri.",
      system: SISTEM,
      prompt:
        "Aşağıdaki proje risk analizini ve EVM projeksiyonlarını değerlendir; öncelik sırasına göre en fazla " +
        `5 somut öneri ver:\n\n${ozet}`,
      temperature: 0.3,
      tercih: body.tercih,
    });

    if (!sonuc) {
      return Response.json({ error: "Aktif sağlayıcı bulunamadı." }, { status: 500 });
    }

    return Response.json({
      demoMode: false,
      saglayici: sonuc.saglayici,
      yorum: sonuc.object.yorum,
      oneriler: sonuc.object.oneriler,
      kategoriOdak: sonuc.object.kategoriOdak,
      guven: sonuc.object.guven,
    });
  } catch (e) {
    return Response.json({ error: `mk_ai analizi başarısız: ${(e as Error).message}` }, { status: 500 });
  }
}
