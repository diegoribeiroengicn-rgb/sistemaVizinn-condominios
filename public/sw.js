// Service worker mínimo — sem cache agressivo de propósito (o sistema
// é um SaaS com dados que mudam o tempo todo; cachear a esmo aqui
// serviria pro usuário ver tela desatualizada). Existir e responder a
// "fetch" é o que os navegadores exigem pra considerar o site
// instalável como app — o essencial é isso, não cache offline completo.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
