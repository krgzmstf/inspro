/* ──────────────────────────────────────────────────────────
   insPRO — Basit hız sınırlayıcı (rate limit)

   AI uçları (mk_ai, görsel üretim) herkese açık olduğundan kötüye
   kullanım → sağlayıcı maliyeti riskini hafifletir. IP başına sabit
   pencere sayacı. Bellek içi: serverless'ta sıcak (warm) instance'lar
   arasında çalışır — kusursuz değil ama ucuz ve etkili ilk savunma.
   ────────────────────────────────────────────────────────── */

interface Kova { sayac: number; sifir: number }
const kovalar = new Map<string, Kova>();

/** İstekçinin IP'sini başlıklardan çıkarır. */
function istekIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "bilinmeyen";
}

/**
 * Limit aşıldıysa 429 Response döner; aşılmadıysa null (devam et).
 * @param limit   pencere başına izinli istek
 * @param pencereMs  pencere süresi (ms)
 */
export function hizSiniri(req: Request, limit = 30, pencereMs = 60_000): Response | null {
  const ip = istekIp(req);
  const simdi = Date.now();
  const k = kovalar.get(ip);

  if (!k || simdi > k.sifir) {
    kovalar.set(ip, { sayac: 1, sifir: simdi + pencereMs });
    // Ara sıra eski kayıtları temizle (bellek şişmesin)
    if (kovalar.size > 5000) {
      for (const [anahtar, v] of kovalar) if (simdi > v.sifir) kovalar.delete(anahtar);
    }
    return null;
  }

  k.sayac++;
  if (k.sayac > limit) {
    const bekle = Math.ceil((k.sifir - simdi) / 1000);
    return new Response(
      JSON.stringify({ error: `Çok fazla istek. ${bekle} sn sonra tekrar deneyin.` }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(bekle) } },
    );
  }
  return null;
}
