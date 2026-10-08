const CACHE = 'engmapa-shell-v6';
const ASSETS = ['./','./index.html','./cadastro.html','./login.html','./painel.html','./admin.html','./clientes.html','./contato.html','./style.css','./app.js','./config.js','./manifest.json'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co') || event.request.url.includes('cdn.jsdelivr.net') || event.request.url.includes('cdnjs.cloudflare.com')) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match('./index.html'))));
});
