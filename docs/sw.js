// Service worker "red primero": cuando hay internet, SIEMPRE carga lo último
// (así la app se actualiza sola, sin reinstalar). La caché es solo respaldo offline.
var CACHE = 'nagi-brawl-v5';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'brawlers-meta.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { if (k !== CACHE) return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  // Datos y CDN: siempre red directa (no cachear aquí).
  if (url.indexOf('githubusercontent.com') !== -1 || url.indexOf('cdn.brawlify.com') !== -1) return;
  // Resto (la app): RED PRIMERO; si falla (sin internet), tira de caché.
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
      return res;
    }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); })
  );
});
