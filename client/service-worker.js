self.addEventListener('install', (e) => {
self.skipWaiting();
});
self.addEventListener('activate', (e) => {
clients.claim();
});
const DL_CACHE = 'loove-downloads-v1';
self.addEventListener('message', async (event) => {
const { type, url } = event.data || {};
if (type === 'DOWNLOAD_URL' && url) {
const cache = await caches.open(DL_CACHE);
const res = await fetch(url, { mode: 'no-cors' });
await cache.put(url, res);
event.ports[0]?.postMessage({ ok: true });
}
});
self.addEventListener('fetch', (event) => {
event.respondWith((async () => {
// offline first para downloads
const cache = await caches.open(DL_CACHE);
const cached = await cache.match(event.request.url);
if (cached) return cached;
try { return await fetch(event.request); } catch (e) { return new
Response('Offline', { status: 503 }); }
})());
});
