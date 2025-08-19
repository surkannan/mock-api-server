
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;
const CONFIG_FILE = 'mocks-config.json';

// --- Matcher Logic (ported from services/matcher.ts) ---

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


// --- Server Implementation ---

const server = http.createServer((req, res) => {
  let mocks = [];
  try {
    const rawConfig = fs.readFileSync(path.join(__dirname, CONFIG_FILE), 'utf-8');
    mocks = JSON.parse(rawConfig);
  } catch (err) {
    console.error(`[ERROR] Could not read or parse ${CONFIG_FILE}.`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Could not load ${CONFIG_FILE}. Make sure the file exists and is valid JSON.` }));
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    const liveRequest = {
      method: req.method,
      path: url.pathname,
      headers: Object.entries(req.headers).map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join(', ') : value })),
      queryParams: Array.from(url.searchParams.entries()).map(([key, value]) => ({ key, value })),
      body: body,
    };

    const matchedMock = findMatchingMock(liveRequest, mocks);
    const timestamp = new Date().toLocaleTimeString();

    if (matchedMock) {
      const { response: mockResponse } = matchedMock;
      console.log(`[${timestamp}] [200] ${req.method} ${req.url} -> Matched: "${matchedMock.name}"`);
      
      const sendResponse = () => {
        Object.entries(mockResponse.headers).forEach(([key, value]) => {
          if (value.key) res.setHeader(value.key, value.value);
        });
        res.writeHead(mockResponse.status);
        res.end(mockResponse.body);
      };

      if (mockResponse.delay > 0) {
        setTimeout(sendResponse, mockResponse.delay);
      } else {
        sendResponse();
      }
    } else {
      console.log(`[${timestamp}] [404] ${req.method} ${req.url} -> No Match`);
      const errorBody = {
          error: "No mock match found for the request.",
          request: { method: liveRequest.method, url: req.url, headers: req.headers, body: liveRequest.body || null }
      };
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorBody, null, 2));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Mock Server is running on http://localhost:${PORT}`);
  console.log(`   Waiting for '${CONFIG_FILE}'... (Export from the UI)`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[ERROR] Port ${PORT} is already in use. Please stop the other process or choose a different port.`);
    } else {
        console.error('[ERROR] Server error:', err);
    }
});
