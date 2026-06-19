/* ──────────────────────────────────────────────────────────
   insPRO — API CORS ara katmanı

   Native (Capacitor) uygulama capacitor://localhost origin'inden
   canlı backend'deki /api/* uçlarına istek atar. Tarayıcı/WebView
   bu çapraz-origin isteklerde CORS başlığı arar; yoksa engeller ve
   mk_ai online çağrısı başarısız olup "demo"ya düşer. Bu katman API
   yollarına CORS başlıklarını ekler ve preflight (OPTIONS) yanıtlar.

   Sadece web (Vercel) tarafında çalışır; statik export (native paket)
   build'inde middleware ve api kapsam dışıdır.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function middleware(req: NextRequest) {
  // Preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
