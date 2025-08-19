
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;
const CONFIG_FILE = 'mocks-config.json';

// --- Config path and in-memory store ---
const args = process.argv.slice(2);
let providedConfigPath = process.env.MOCKS_CONFIG || null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' && args[i + 1]) {
    providedConfigPath = args[i + 1];
    i++;
  }
}

const defaultConfigPath = path.join(__dirname, CONFIG_FILE);
const configPath = providedConfigPath || defaultConfigPath;

let currentMocks = [];

const loadMocksFromFile = () => {
  try {
    if (configPath && fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      currentMocks = JSON.parse(raw);
      console.log(`Loaded ${currentMocks.length} mocks from ${configPath}`);
    } else {
      currentMocks = [];
      console.log(`No config file found. Running with 0 mocks. (Optional) Looking for: ${configPath}`);
    }
  } catch (err) {
    console.error(`[WARN] Failed to read or parse config at ${configPath}:`, err.message);
    currentMocks = [];
  }
};

const persistMocksToFile = () => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(currentMocks, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[ERROR] Failed to persist mocks to file:', err.message);
    return false;
  }
};

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

loadMocksFromFile();

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const sendJson = (status, obj) => {
    setCors(res);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj, null, 2));
  };

  // Admin endpoints
  if (url.pathname === '/__health' && req.method === 'GET') {
    return sendJson(200, {
      ok: true,
      port: PORT,
      configPath,
      hasConfigFile: fs.existsSync(configPath),
      mocksCount: currentMocks.length,
    });
  }

  if (url.pathname === '/__mocks') {
    if (req.method === 'GET') {
      return sendJson(200, currentMocks);
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => (body += chunk.toString()));
      req.on('end', () => {
        try {
          const incoming = JSON.parse(body || '[]');
          if (!Array.isArray(incoming)) {
            return sendJson(400, { ok: false, error: 'Body must be an array of mocks' });
          }
          currentMocks = incoming;
          const persist = (url.searchParams.get('persist') || 'false') === 'true';
          let persisted = false;
          if (persist) persisted = persistMocksToFile();
          return sendJson(200, { ok: true, count: currentMocks.length, persisted });
        } catch (e) {
          return sendJson(400, { ok: false, error: 'Invalid JSON body', message: e.message });
        }
      });
      return;
    }
  }

  if (url.pathname === '/__reload' && req.method === 'POST') {
    loadMocksFromFile();
    return sendJson(200, { ok: true, count: currentMocks.length });
  }

  // Mock matching for all other routes
  let body = '';
  req.on('data', (chunk) => {
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

    const matchedMock = findMatchingMock(liveRequest, currentMocks);
    const timestamp = new Date().toLocaleTimeString();

    if (matchedMock) {
      const { response: mockResponse } = matchedMock;
      console.log(`[${timestamp}] [200] ${req.method} ${req.url} -> Matched: "${matchedMock.name}"`);

      const sendResponse = () => {
        // CORS on API responses too
        setCors(res);
        mockResponse.headers.forEach((h) => {
          if (h && h.key) res.setHeader(h.key, h.value);
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
        error: 'No mock match found for the request.',
        request: { method: liveRequest.method, url: req.url, headers: req.headers, body: liveRequest.body || null },
      };
      return sendJson(404, errorBody);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Mock Server is running on http://localhost:${PORT}`);
  console.log(`   Config path: ${configPath} (exists: ${fs.existsSync(configPath)})`);
  console.log(`   Admin endpoints: /__health, /__mocks (GET/PUT), /__reload`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[ERROR] Port ${PORT} is already in use. Please stop the other process or choose a different port.`);
  } else {
    console.error('[ERROR] Server error:', err);
  }
});
