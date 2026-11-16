// Service worker: guarda la app para que abra sin internet.
// Cambia el número de versión cada vez que subas cambios, para que el iPhone los descargue.
const CACHE = 'bestlx-v2';
const ARCHIVOS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './data/frases.json', './data/retos.json', './data/preguntas.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Las llamadas al Apps Script (otro dominio) siempre van directo a la red
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => {
    const red = fetch(e.request).then(r => {
      if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
      return r.clone();
    }).catch(() => hit);
    return hit || red;
  }));
});
