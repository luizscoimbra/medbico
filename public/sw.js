/*
 * Service worker do HerbiLog (PWA offline).
 *
 * Estratégia:
 *  - App shell (index, JS/CSS com hash, imagens do tema): cache-first — o
 *    bundle do Vite tem hash no nome, então nunca fica velho no cache;
 *  - Navegações (SPA): network-first com fallback para o shell cacheado —
 *    sem sinal o app abre e navega normalmente entre telas já visitadas;
 *  - Dados do Supabase (api.supabase.com): apenas rede — dados de empresa
 *    nunca são guardados no cache do navegador por segurança.
 */

const CACHE = "herbilog-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/herbilog_logo.png",
  "/herbilog_sidebar.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Dados autenticados do Supabase ficam só na rede.
  if (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in")) {
    return;
  }

  // Recursos do próprio app.
  if (url.origin !== self.location.origin) return;

  // Navegação SPA: rede primeiro, shell offline como fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          return resp;
        })
        .catch(() =>
          caches
            .match("/index.html")
            .then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Assets com hash: cache primeiro, rede preenche o cache.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});
