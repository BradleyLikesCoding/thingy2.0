importScripts(new URL('./cdntest.js', self.location.href).href);

self.addEventListener("install", event => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

const clientGameMap = new Map();

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  
  // Handle /load navigation requests
  if (url.pathname === "/load") {
    const id = url.searchParams.get("id");
    if (id) {
      event.respondWith((async () => {
        const response = await fetch(id + "/index.html");
        if (event.resultingClientId) {
          clientGameMap.set(event.resultingClientId, id);
        }
        
        // Rewrite headers to ensure browser renders as HTML
        const newHeaders = new Headers();
        newHeaders.set("Content-Type", "text/html; charset=utf-8");
        newHeaders.set("X-Content-Type-Options", "nosniff");
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      })());
      return;
    }
  }

  if (event.request.mode === "navigate") return;

  // Proxy /js/main.js to /games.js
  if (url.pathname === "/js/main.js") {
    event.respondWith(fetch("/games.js"));
    return;
  }

  // Subresource requests
  event.respondWith((async () => {
    let gameId = clientGameMap.get(event.clientId);
    
    if (!gameId && event.clientId) {
      const client = await self.clients.get(event.clientId);
      if (client) {
        gameId = new URL(client.url).searchParams.get("id");
        if (gameId) clientGameMap.set(event.clientId, gameId);
      }
    }
    
    if (gameId) {
      return fetch(gameId + url.pathname);
    }

    return fetch(event.request);
  })());
});