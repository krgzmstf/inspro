/* insPRO — Service Worker (çevrimdışı önbellek + kurulabilirlik)
   Güvenli strateji: dış istekler (Supabase api-inspro.*) ve /api/ ASLA
   önbelleğe alınmaz; sayfalar ağ-öncelikli, statik varlıklar
   stale-while-revalidate. */
const CACHE = "inspro-v1";
const SHELL = ["/", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase vb. dış istekleri atla
  if (url.pathname.startsWith("/api/")) return;      // API'leri önbelleğe alma

  // Sayfa gezinmeleri: önce ağ, çevrimdışıysa önbellek, son çare ana sayfa
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const kopya = res.clone();
          caches.open(CACHE).then((c) => c.put(req, kopya));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Statik varlıklar: önbellekten ver, arkada güncelle
  if (url.pathname.startsWith("/_next/") || /\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const agdan = fetch(req)
          .then((res) => {
            const kopya = res.clone();
            caches.open(CACHE).then((c) => c.put(req, kopya));
            return res;
          })
          .catch(() => cached);
        return cached || agdan;
      })
    );
  }
});
