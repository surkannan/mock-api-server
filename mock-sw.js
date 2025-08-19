// --- START: Duplicated Types from types.ts ---
// These are duplicated here because Service Workers run in a separate context
// and cannot easily share ES modules without a complex build setup.

/** @typedef {'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'} HttpMethod */
/** @typedef {{id: string, key: string, value: string}} KeyValue */
/** @typedef {{method: HttpMethod, path: string, headers: KeyValue[], body?: string, queryParams: KeyValue[]}} RequestMatcher */
/** @typedef {{status: number, headers: KeyValue[], body?: string, delay: number}} MockResponse */
/** @typedef {{id: string, name: string, matcher: RequestMatcher, response: MockResponse}} Mock */
/** @typedef {{id: string, timestamp: Date, method: HttpMethod, path: string, headers: KeyValue[], queryParams: KeyValue[], body?: string}} LiveRequest */
/** @typedef {{id: string, request: LiveRequest, matchedMock?: Mock, actualResponse: {status: number, body?: string}}} LogEntry */

// --- START: Duplicated DB Logic from services/db.ts ---
const DB_NAME = 'MockApiServerDB';
const DB_VERSION = 1;
const STORE_NAME = 'mocks';

let swDb = null;

const openSwDB = () => {
  return new Promise((resolve, reject) => {
    if (swDb) {
      return resolve(swDb);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => {
      swDb = event.target.result;
      resolve(swDb);
    };
    request.onerror = (event) => {
      console.error('SW IndexedDB error:', event.target.error);
      reject('Error opening IndexedDB in Service Worker.');
    };
  });
};

const getMocksFromDB = async () => {
  const db = await openSwDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

// --- START: Duplicated Matcher Logic from services/matcher.ts ---
const pathMatches = (template, actual) => {
  const normalizedActual = actual.length > 1 && actual.endsWith('/') ? actual.slice(0, -1) : actual;
  let regexString = template.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  regexString = regexString.replace(/\*\*/g, '(.*)');
  regexString = regexString.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)');
  regexString = regexString.replace(/\*/g, '([^/]+)');
  try {
    const regex = new RegExp(`^${regexString}$`);
    return regex.test(normalizedActual);
  } catch (e) {
    return false;
  }
};

const valueMatches = (expected, actual) => {
  try {
    const regex = new RegExp(expected);
    return regex.test(actual);
  } catch (e) {
    return actual.includes(expected);
  }
};

const findMatchingMock = (request, mocks) => {
  for (const mock of mocks) {
    const matcher = mock.matcher;
    if (matcher.method !== request.method) continue;

    const [requestPath] = request.path.split('?');
    if (!pathMatches(matcher.path, requestPath)) continue;

    const definedMatcherHeaders = matcher.headers.filter(h => h.key);
    const allHeadersMatch = definedMatcherHeaders.every(mockHeader =>
      request.headers.some(reqHeader =>
        reqHeader.key.toLowerCase() === mockHeader.key.toLowerCase() &&
        valueMatches(mockHeader.value, reqHeader.value)
      )
    );
    if (!allHeadersMatch) continue;
    
    const definedMatcherQueryParams = matcher.queryParams.filter(q => q.key);
    const allQueryParamsMatch = definedMatcherQueryParams.every(mockQueryParam =>
      request.queryParams.some(reqQueryParam =>
        reqQueryParam.key === mockQueryParam.key &&
        valueMatches(mockQueryParam.value, reqQueryParam.value)
      )
    );
    if (!allQueryParamsMatch) continue;

    if (matcher.body && !valueMatches(matcher.body, request.body || '')) {
      continue;
    }

    return mock;
  }
  return null;
};

// --- Service Worker Implementation ---

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // --- Bypass conditions ---
  // 1. Only handle requests from the same origin.
  if (url.origin !== self.origin) {
    return;
  }

  // 2. IMPORTANT: Never intercept HTML navigations or UI assets in dev.
  // Treat navigations and document requests as UI and bypass.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    return;
  }
  // Requests that accept HTML should be treated as UI navigations, bypass them.
  const accept = event.request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return;
  }
  // Bypass known Vite UI asset paths and internal endpoints
  if (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/vite.svg' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@id/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/.ui/')
  ) {
    return;
  }
  
  // 3. Ignore the service worker file itself to prevent loops.
  if (url.pathname === '/mock-sw.js') {
    return;
  }

  // Any other request to this origin is considered a mockable API call.
  event.respondWith(handleApiRequest(event));
});

const createLiveRequest = async (request) => {
    const url = new URL(request.url);
    const queryParams = Array.from(url.searchParams.entries()).map(([key, value]) => ({ id: `${key}-${value}`, key, value }));
    const headers = Array.from(request.headers.entries()).map(([key, value]) => ({ id: key, key, value }));
    let body = '';
    // Avoid consuming the body for methods that shouldn't have one.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
            body = await request.text();
        } catch (e) {
            // Ignore errors for requests that might have a content-type but no body.
        }
    }

    return {
        id: Date.now().toString() + Math.random(),
        timestamp: new Date().toISOString(), // Use ISO string for serialization
        method: request.method,
        path: url.pathname, // Use the full path for matching, no prefix stripping.
        headers,
        queryParams,
        body,
    };
};

const createNoMatchResponse = (liveRequest) => {
    const query = liveRequest.queryParams.length > 0
        ? '?' + new URLSearchParams(liveRequest.queryParams.map(p => [p.key, p.value])).toString()
        : '';
    const fullUrl = `${liveRequest.path}${query}`;
    const headersObject = liveRequest.headers.reduce((acc, h) => { acc[h.key] = h.value; return acc; }, {});

    const errorBody = {
        error: "No mock match found for the request.",
        request: { method: liveRequest.method, url: fullUrl, headers: headersObject, body: liveRequest.body || null }
    };

    return { status: 404, body: JSON.stringify(errorBody, null, 2) };
};

const postLogToClients = async (logPayload) => {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
        client.postMessage({ type: 'log', payload: logPayload });
    });
};

const handleApiRequest = async (event) => {
    try {
        const mocks = await getMocksFromDB();
        const liveRequest = await createLiveRequest(event.request.clone());
        const matchedMock = findMatchingMock(liveRequest, mocks);

        if (matchedMock) {
            const { response: mockResponse } = matchedMock;
            if (mockResponse.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, mockResponse.delay));
            }

            const headers = new Headers();
            mockResponse.headers.forEach(h => h.key && headers.append(h.key, h.value));
            
            postLogToClients({
                id: liveRequest.id, request: liveRequest, matchedMock,
                actualResponse: { status: mockResponse.status, body: mockResponse.body }
            });

            return new Response(mockResponse.body, { status: mockResponse.status, headers });
        }

        const { status, body } = createNoMatchResponse(liveRequest);
        postLogToClients({
            id: liveRequest.id, request: liveRequest,
            actualResponse: { status, body }
        });
        
        return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in service worker fetch handler:', error);
        const errorBody = JSON.stringify({ error: 'Service worker error', message: error.message });
        return new Response(errorBody, { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};