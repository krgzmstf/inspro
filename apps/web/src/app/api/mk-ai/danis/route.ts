import { tool } from "ai";
import { z } from "zod";
import {
  aktifSaglayicilar,
  mkAiAjan,
  type SohbetMesaj,
  type SaglayiciId,
} from "@/lib/aiSaglayici";
import { yonetmelikAra, type YonetmelikIsabet } from "@/lib/yonetmelik";

/* ──────────────────────────────────────────────────────────
   mk_ai — Agentic danışma (araç çağıran sohbet + RAG)

   POST /api/mk-ai/danis
   Body: { messages: {role,content}[], baglam?: string, tercih?: SaglayiciId }

   Sıradan sohbetten farkı: mk_ai burada ARAÇ ÇAĞIRABİLİR. Mevzuat/
   yönetmelik bilgisi gereken bir soruda `yonetmelik_ara` aracını
   çağırır, kamuya açık bilgi tabanından (lib/yonetmelik.ts) ilgili
   maddeleri çeker (RAG) ve cevabını KAYNAK göstererek yazar.

   Mimari ilke: "kaynak otorite, LLM yorumcu" — kural/sayı bilgi
   tabanından gelir, mk_ai yalnızca yorumlar ve teyidi önerir.

   Çıktı: { text, saglayici, kaynaklar[] } — kaynaklar, üretim
   sırasında araçla getirilen yönetmelik maddeleridir (citation).

   Hiç sağlayıcı yoksa demo cevap döner.
   GÜVENLİK: API anahtarları yalnızca sunucuda (env) tutulur.
   ────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const maxDuration = 60;

interface Govde {
  messages?: SohbetMesaj[];
  baglam?: string;
  tercih?: SaglayiciId;
}

const TEMEL_SISTEM =
  "Sen mk_ai adlı, insPRO inşaat yönetim platformunun yapay zekâ asistanısın. İnşaat proje yönetimi, " +
  "maliyet/bütçe (EVM: CPI, EAC), takvim, saha kalite/iş emri, risk VE Türk inşaat mevzuatı (imar, deprem, " +
  "yangın, İSG, enerji, yapı denetimi) konularında uzmansın. Kurallar: " +
  "(1) Mevzuat, yönetmelik, standart, sayısal kural (pas payı, çekme mesafesi, otopark, kat yüksekliği, beton " +
  "sınıfı, yangın, erişilebilirlik vb.) gereken HER soruda ÖNCE `yonetmelik_ara` aracını çağır; cevabını yalnızca " +
  "aracın döndürdüğü bilgiye dayandır, ezberden mevzuat sayısı uydurma. " +
  "(2) Aracın sonucunu kullandığında cevabının sonunda 'Kaynak: <dayanak>' biçiminde dayanağı belirt ve mevzuat " +
  "değişebileceği için resmî güncel metinle (mevzuat.gov.tr / ÇŞB) teyidi öner. " +
  "(3) Araç sonuç döndürmezse bunu dürüstçe söyle, uydurma. " +
  "(4) Proje verisiyle ilgili sorularda sana verilen proje bağlamındaki rakamları kullan; veri yoksa bunu söyle. " +
  "(5) Türkçe, kısa, net ve uygulanabilir yaz.";

export async function POST(req: Request) {
  let body: Govde;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim(),
  );
  if (messages.length === 0) {
    return Response.json({ error: "Mesaj yok." }, { status: 400 });
  }

  // ── Demo modu (hiç sağlayıcı anahtarı yok) ──
  if (aktifSaglayicilar().length === 0) {
    // Sağlayıcı yoksa da yönetmelik aramayı yerel çalıştırıp en azından
    // ilgili maddeleri gösterelim (RAG kısmı LLM'siz de değerli).
    const sonSoru = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const isabet = yonetmelikAra(sonSoru, 3);
    const metin = isabet.length
      ? "**mk_ai (demo).** AI sağlayıcısı bağlı değil; yine de mevzuat bilgi tabanından ilgili maddeleri buldum:\n\n" +
        isabet.map((k) => `• **${k.baslik}** — ${k.metin}\n  _Kaynak: ${k.kaynak}_`).join("\n\n")
      : "**mk_ai (demo).** Şu an bağlı bir AI sağlayıcısı yok. Bir ücretsiz anahtar (Groq / Gemini / GitHub Models) tanımlanınca agentic danışma gerçek cevaplar verir.";
    return Response.json({ demoMode: true, saglayici: null, text: metin, kaynaklar: kaynakDtoListesi(isabet) });
  }

  // ── Araç: yönetmelik arama (RAG). Getirilen maddeleri citation için topla. ──
  const toplanan = new Map<string, YonetmelikIsabet>();
  const tools = {
    yonetmelik_ara: tool({
      description:
        "Türk inşaat mevzuatı/yönetmelik/standart bilgi tabanında arama yapar. İmar (çekme mesafesi, kat yüksekliği, " +
        "otopark), deprem (TBDY), beton/betonarme (sınıf, pas payı), yangın, asansör, erişilebilirlik, enerji (BEP/TS 825), " +
        "İSG ve yapı denetimi konularında özet bilgi ve resmî dayanak döndürür.",
      inputSchema: z.object({
        sorgu: z
          .string()
          .describe("Aranacak konu/anahtar kelimeler, ör. 'beton pas payı', 'ön bahçe çekme mesafesi', 'yangın merdiveni', 'otopark'."),
      }),
      execute: async ({ sorgu }: { sorgu: string }) => {
        const isabet = yonetmelikAra(sorgu, 4);
        for (const k of isabet) toplanan.set(k.id, k);
        if (isabet.length === 0) return { bulunan: 0, sonuclar: [], not: "Bilgi tabanında eşleşme yok." };
        return {
          bulunan: isabet.length,
          sonuclar: isabet.map((k) => ({ baslik: k.baslik, kaynak: k.kaynak, bilgi: k.metin })),
        };
      },
    }),
  };

  const sistem = body.baglam?.trim()
    ? `${TEMEL_SISTEM}\n\nKullanıcının şu an seçili projesinin güncel bağlamı:\n${body.baglam.trim()}`
    : TEMEL_SISTEM;

  try {
    const sonuc = await mkAiAjan({ system: sistem, messages, tools, tercih: body.tercih, maxAdim: 5 });
    if (!sonuc) return Response.json({ error: "Aktif sağlayıcı bulunamadı." }, { status: 500 });
    return Response.json({
      demoMode: false,
      saglayici: sonuc.saglayici,
      text: sonuc.text,
      kaynaklar: kaynakDtoListesi([...toplanan.values()]),
    });
  } catch (e) {
    return Response.json({ error: `mk_ai danışma başarısız: ${(e as Error).message}` }, { status: 500 });
  }
}

function kaynakDtoListesi(isabet: YonetmelikIsabet[]) {
  return isabet.map((k) => ({ id: k.id, baslik: k.baslik, kaynak: k.kaynak }));
}
