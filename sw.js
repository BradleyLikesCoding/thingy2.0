importScripts("./cdntest.js");

self.addEventListener("install", event => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

const clientGameMap = new Map();

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/__reload")) return;
  
  console.log("[SW] Intercepted:", url.pathname, "mode:", event.request.mode, "dest:", event.request.destination, "clientId:", event.clientId);
  
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
  
  if (event.request.mode === "navigate") {
    // Handle navigation within a game (e.g., game linking to another HTML file)
    event.respondWith((async () => {
      // Try to find the game ID from the clientGameMap first (for chained navigations)
      let gameId = null;
      
      // Check if the current client already has a gameId
      if (event.clientId) {
        gameId = clientGameMap.get(event.clientId);
      }
      
      // Try to find from referrer
      if (!gameId && event.request.referrer) {
        try {
          const referrerUrl = new URL(event.request.referrer);
          if (referrerUrl.pathname === "/load") {
            gameId = referrerUrl.searchParams.get("id");
          }
        } catch (e) {}
      }
      
      // Check all open clients for a /load page or known game session
      if (!gameId) {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          // First check if this client has a stored gameId
          const storedId = clientGameMap.get(client.id);
          if (storedId) {
            gameId = storedId;
            break;
          }
          // Then check if it's on /load
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname === "/load") {
            gameId = clientUrl.searchParams.get("id");
            if (gameId) break;
          }
        }
      }
      
      if (gameId) {
        // Store the gameId for the new client (after navigation)
        if (event.resultingClientId) {
          clientGameMap.set(event.resultingClientId, gameId);
        }
        
        // Fetch the HTML file from the game's folder
        const resourcePath = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
        const fullPath = gameId.endsWith("/") ? gameId + resourcePath : gameId + "/" + resourcePath;
        console.log("[SW] Game navigation to: " + fullPath);
        
        const response = await getCDNS(fullPath, true, true);
        
        const newHeaders = new Headers();
        newHeaders.set("Content-Type", "text/html; charset=utf-8");
        newHeaders.set("X-Content-Type-Options", "nosniff");
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }
      
      // Not a game navigation, pass through to network
      return fetch(event.request);
    })());
    return;
  }

  // Proxy /js/main.js to /games.js
  if (url.pathname === "/js/main.js") {
    event.respondWith(getCDNS("games.js", true));
    return;
  }

  // Subresource requests
  event.respondWith((async () => {
    let gameId = clientGameMap.get(event.clientId);
    console.log("[SW] Step 1 - Map lookup:", gameId, "mapSize:", clientGameMap.size);
    
    if (!gameId && event.clientId) {
      const client = await self.clients.get(event.clientId);
      console.log("[SW] Step 2 - Client:", client ? client.url : "null");
      if (client) {
        const clientUrl = new URL(client.url);
        console.log("[SW] Step 2 - Client pathname:", clientUrl.pathname);
        if (clientUrl.pathname === "/load") {
          gameId = clientUrl.searchParams.get("id");
          if (gameId) clientGameMap.set(event.clientId, gameId);
        }
      }
    }
    
    // Fallback: try to extract game ID from the referrer
    if (!gameId && event.request.referrer) {
      console.log("[SW] Step 3 - Referrer:", event.request.referrer);
      try {
        const referrerUrl = new URL(event.request.referrer);
        if (referrerUrl.pathname === "/load") {
          gameId = referrerUrl.searchParams.get("id");
          if (gameId && event.clientId) clientGameMap.set(event.clientId, gameId);
        }
      } catch (e) {}
    }
    
    // Last resort: try to find any client with a stored gameId or on /load page
    if (!gameId) {
      const clients = await self.clients.matchAll({ type: "window" });
      console.log("[SW] Step 4 - All clients:", clients.map(c => c.url));
      for (const client of clients) {
        // First check if this client has a stored gameId
        const storedId = clientGameMap.get(client.id);
        if (storedId) {
          gameId = storedId;
          if (event.clientId) clientGameMap.set(event.clientId, gameId);
          break;
        }
        // Then check if it's on /load
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === "/load") {
          gameId = clientUrl.searchParams.get("id");
          if (gameId) {
            if (event.clientId) clientGameMap.set(event.clientId, gameId);
            break;
          }
        }
      }
    }
    
    if (gameId) {
      // Remove leading slash from pathname to avoid double slashes
      const resourcePath = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
      const fullPath = gameId.endsWith("/") ? gameId + resourcePath : gameId + "/" + resourcePath;
      console.log("Fetching: " + fullPath);
      
      const response = await getCDNS(fullPath, true, true);
      console.log(response.url + " is the url and status is " + response.status);

      // Determine correct content-type based on file extension
      const ext = resourcePath.split('.').pop().toLowerCase();
      const mimeTypes = {
        'js': 'application/javascript',
        'mjs': 'application/javascript',
        'json': 'application/json',
        'css': 'text/css',
        'html': 'text/html',
        'htm': 'text/html',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'ico': 'image/x-icon',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
        'otf': 'font/otf',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'wasm': 'application/wasm',
        'xml': 'application/xml',
        'txt': 'text/plain',
      };
      
      const newHeaders = new Headers();
      const contentType = mimeTypes[ext] || response.headers.get('Content-Type') || 'application/octet-stream';
      newHeaders.set('Content-Type', contentType);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('X-Content-Type-Options', 'nosniff');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    console.log("Couldn't fetch " + event.request.url + " because a game id could not be found (clientId: " + event.clientId + ", referrer: " + event.request.referrer + ")");
    return fetch(event.request);
  })());
});
