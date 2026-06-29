// Service worker básico: cachea el "esqueleto" para que abra rápido/offline.
// Los datos (battles/profile) siempre van por red (no se cachean).
var CACHE = 'nagi-brawl-v2';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'brawlers-meta.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { if (k !== CACHE) return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  // Datos y CDN: siempre red.
  if (url.indexOf('githubusercontent.com') !== -1 || url.indexOf('cdn.brawlify.com') !== -1) return;
  // Esqueleto: cache primero, luego red.
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});
