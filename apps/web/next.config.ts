import type { NextConfig } from "next";

// Güvenlik başlıkları — clickjacking, MIME-sniffing, bilgi sızıntısı sertleştirme.
// (CSP eklenmedi: Next.js geliştirme modu eval gerektirir; ileride üretim için
//  ayrı, alan adına özel bir CSP tanımlanabilir.)
const guvenlikBasliklari = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone", // Docker üretim imajı için (küçük, kendi kendine yeten)
  async headers() {
    return [{ source: "/:path*", headers: guvenlikBasliklari }];
  },
};

export default nextConfig;
