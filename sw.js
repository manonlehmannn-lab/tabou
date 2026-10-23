// Service worker généré par tools/build_sw.py — ne pas modifier à la main.
// Stratégie : tout est mis en cache à l'installation, puis servi depuis le cache (hors ligne).
const VERSION = '3a31cb283a08';
const CACHE = `tabou-${VERSION}`;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/engine/challenges.js',
  'js/engine/deck.js',
  'js/engine/game.js',
  'js/engine/random.js',
  'js/engine/scoring.js',
  'js/engine/storage.js',
  'js/engine/teams.js',
  'js/engine/timer.js',
  'js/ui/dom.js',
  'js/ui/fx.js',
  'js/ui/icons.js',
  'js/ui/parts.js',
  'js/ui/screens/board.js',
  'js/ui/screens/home.js',
  'js/ui/screens/intro.js',
  'js/ui/screens/library.js',
  'js/ui/screens/over.js',
  'js/ui/screens/play.js',
  'js/ui/screens/review.js',
  'js/ui/screens/rules.js',
  'js/ui/screens/settings.js',
  'js/ui/screens/setup.js',
  'js/ui/screens/stats.js',
  'data/cards.json',
  'assets/fonts/barlow-condensed-600.woff2',
  'assets/fonts/barlow-condensed-700.woff2',
  'assets/fonts/barlow-condensed-800.woff2',
  'assets/fonts/fredoka-500.woff2',
  'assets/fonts/fredoka-600.woff2',
  'assets/fonts/fredoka-700.woff2',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'assets/icons/icon-1024.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tabou-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./') : Response.error()));
    })
  );
});
