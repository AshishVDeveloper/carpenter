const C = 'mi-offline-mwktqogb', OFF = '/offline/';
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll([OFF, '/assets/logo-96.png', '/favicon.ico']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== C).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match(OFF))); return; }
  if (u.pathname === '/assets/logo-96.png' || u.pathname === '/favicon.ico') e.respondWith(fetch(r).catch(() => caches.match(u.pathname)));
});
