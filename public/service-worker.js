const CACHE_VERSION = 'v2';
const HTML_CACHE = `fridge-magnets-html-${CACHE_VERSION}`;
const ASSET_CACHE = `fridge-magnets-assets-${CACHE_VERSION}`;
const OFFLINE_HTML_URL = '/index.html';
const EXPECTED_CACHES = [HTML_CACHE, ASSET_CACHE];

self.addEventListener('install', (event) => {
  event.waitUntil(seedOfflineHtml());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!EXPECTED_CACHES.includes(cacheName)) {
              return caches.delete(cacheName);
            }

            return undefined;
          })
        )
      ),
    ])
  );
  self.clients.claim();
});

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isHtmlShellRequest(request, requestUrl) {
  return (
    isNavigationRequest(request) ||
    requestUrl.pathname === '/' ||
    requestUrl.pathname === '/index.html'
  );
}

function isBuildAsset(requestUrl) {
  return requestUrl.pathname.startsWith('/assets/');
}

function isApiRequest(requestUrl) {
  return requestUrl.pathname.startsWith('/api/');
}

async function seedOfflineHtml() {
  const cache = await caches.open(HTML_CACHE);
  const response = await fetch(new Request(OFFLINE_HTML_URL, { cache: 'no-store' }));

  if (response.ok) {
    await cache.put(OFFLINE_HTML_URL, response);
  }
}

async function networkFirstHtml(request) {
  const cache = await caches.open(HTML_CACHE);

  try {
    const freshRequest = new Request(request, { cache: 'no-store' });
    const response = await fetch(freshRequest);

    if (response.ok) {
      await cache.put(OFFLINE_HTML_URL, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await cache.match(OFFLINE_HTML_URL);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response('Offline - Please check your connection', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain',
      }),
    });
  }
}

async function cacheFirstAsset(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (!isSameOrigin(requestUrl)) {
    return;
  }

  if (isApiRequest(requestUrl)) {
    return;
  }

  if (isHtmlShellRequest(request, requestUrl)) {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  if (isBuildAsset(requestUrl)) {
    event.respondWith(cacheFirstAsset(request));
  }
});
