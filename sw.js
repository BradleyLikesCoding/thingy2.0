importScripts("./cdntest.js");

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
        const response = await getCDNS(id + "index.html", true);
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
  
  if (event.request.mode === "navigate" || !event.request.url.includes("/load")) return;

  // Proxy /js/main.js to /games.js
  if (url.pathname === "/js/main.js") {
    event.respondWith(getCDNS("games.js", true));
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
      return getCDNS(gameID + url.pathname, true);
    }

    console.log("Couldn't fetch " + event.request.url + " because a game id could not be found");
    return fetch(event.request);
  })());
});