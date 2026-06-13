import {
  aktifSaglayicilar,
  mkAiSohbet,
  type SohbetMesaj,
  type SaglayiciId,
} from "@/lib/aiSaglayici";

/* ──────────────────────────────────────────────────────────
   mk_ai — Sohbet (serbest soru-cevap)

   POST /api/mk-ai/sohbet
   Body: { messages: {role,content}[], baglam?: string, tercih?: SaglayiciId }

   Çok-sağlayıcılı router (lib/aiSaglayici.ts) üzerinden ücretsiz
   bir LLM ile sohbet eder. `baglam` verilirse (seçili projenin risk
   özeti) mk_ai o projeye özel cevap verir.

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
  "maliyet/bütçe (EVM: CPI, EAC), takvim, saha kalite/iş emri ve risk konularında uzmansın. Türkçe, kısa, " +
  "net ve uygulanabilir cevap ver. Bilmediğin veya veride olmayan bir şeyi uydurma; veri yoksa bunu söyle. " +
  "Sayısal bir iddiada bulunacaksan yalnızca sana verilen proje bağlamındaki rakamları kullan.";

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
    return Response.json({
      demoMode: true,
      saglayici: null,
      text:
        "**mk_ai (demo).** Şu an bağlı bir AI sağlayıcısı yok, bu yüzden serbest soruları yanıtlayamıyorum. " +
        "Bir ücretsiz sağlayıcı anahtarı (Groq / Gemini / GitHub Models) tanımlanınca bu sohbet gerçek cevaplar verir.",
    });
  }

  const sistem = body.baglam?.trim()
    ? `${TEMEL_SISTEM}\n\nKullanıcının şu an seçili projesinin güncel risk bağlamı:\n${body.baglam.trim()}`
    : TEMEL_SISTEM;

  try {
    const sonuc = await mkAiSohbet({ system: sistem, messages, tercih: body.tercih });
    if (!sonuc) return Response.json({ error: "Aktif sağlayıcı bulunamadı." }, { status: 500 });
    return Response.json({ demoMode: false, saglayici: sonuc.saglayici, text: sonuc.text });
  } catch (e) {
    return Response.json({ error: `mk_ai sohbet başarısız: ${(e as Error).message}` }, { status: 500 });
  }
}
