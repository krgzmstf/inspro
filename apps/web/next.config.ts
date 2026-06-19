import type { NextConfig } from "next";

// Capacitor (native) yapısı: CAP_EXPORT=1 verildiğinde statik export üretilir
// (out/). Bu mod Vercel'i etkilemez; Vercel normal sunucu yapısını kullanır.
const capExport = process.env.CAP_EXPORT === "1";

// Güvenlik başlıkları — clickjacking, MIME-sniffing, bilgi sızıntısı sertleştirme.
// (Statik export'ta headers() desteklenmez → yalnız sunucu yapısında uygulanır.)
const guvenlikBasliklari = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = capExport
  ? {
      // Native (Capacitor) için tamamen statik istemci paketi → out/
      output: "export",
      images: { unoptimized: true },
      // Statik dosya sunumunda /panel → /panel/index.html çözümü
      trailingSlash: true,
    }
  : {
      // Vercel (web) — sunucu yapısı + güvenlik başlıkları
      async headers() {
        return [{ source: "/:path*", headers: guvenlikBasliklari }];
      },
    };

export default nextConfig;
