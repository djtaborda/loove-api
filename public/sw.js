self.addEventListener("install", (e)=> self.skipWaiting());
self.addEventListener("activate", (e)=> e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event)=>{
  let data = {};
  try{ data = event.data?.json?.() || {}; }catch{ data = { title:"Loove", body:"Você recebeu uma novidade!" }; }
  const title = data.title || "Loove";
  const options = {
    body: data.body || "Nova mensagem.",
    icon: "/loove-logo.png",
    badge: "/loove-logo.png",
    data: data.url || "/",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event)=>{
  event.notification.close();
  const url = event.notification.data || "/";
  event.waitUntil((async ()=>{
    const all = await clients.matchAll({ type:"window" });
    const had = all.find(c => c.url === url);
    if(had) return had.focus();
    return clients.openWindow(url);
  })());
});
