
const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const vm = require('vm');

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

// --- Logging setup (console + file) ---
const LOG_PATH = process.env.LOG_FILE || path.join(__dirname, 'server.log');
const MAX_LOG_BYTES = parseInt(process.env.LOG_MAX_BYTES || '0', 10); // 0 disables rotation
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const LOG_LEVEL_STR = (process.env.LOG_LEVEL || 'info').toLowerCase();
const LEVEL_THRESHOLD = LEVELS[LOG_LEVEL_STR] || 20;

let logStream = null;
let logBytesWritten = 0;
try {
  if (fs.existsSync(LOG_PATH)) {
    try { logBytesWritten = fs.statSync(LOG_PATH).size; } catch {}
  }
  logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
} catch (e) {
  console.error('[WARN] Could not open log file for writing:', e.message);
}

const rotateLogsIfNeeded = (nextBytes) => {
  if (!MAX_LOG_BYTES || MAX_LOG_BYTES <= 0) return;
  if ((logBytesWritten + nextBytes) <= MAX_LOG_BYTES) return;
  try {
    if (logStream) {
      logStream.end();
    }
    const bak = LOG_PATH + '.1';
    try { if (fs.existsSync(bak)) fs.unlinkSync(bak); } catch {}
    try { if (fs.existsSync(LOG_PATH)) fs.renameSync(LOG_PATH, bak); } catch {}
  } catch {}
  try {
    logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
    logBytesWritten = 0;
  } catch (e) {
    console.error('[WARN] Failed to reopen log file after rotation:', e.message);
  }
};

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

// Simple template renderer for placeholders like {{method}}, {{query.foo}}, {{headers.authorization}}, {{bodyJson.userId}}, {{isoNow}}, {{epochMs}}, {{uuid}}
const deepGet = (obj, pathStr) => {
  if (!obj) return undefined;
  const parts = String(pathStr).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
    else return undefined;
  }
  return cur;
};

const helpers = {
  upper: (s) => String(s ?? '').toUpperCase(),
  lower: (s) => String(s ?? '').toLowerCase(),
  base64: (s) => Buffer.from(String(s ?? ''), 'utf8').toString('base64'),
  json: (o) => {
    try { return JSON.stringify(o); } catch { return ''; }
  },
  parseJson: (s) => {
    try { return JSON.parse(String(s ?? '')); } catch { return null; }
  },
  randomInt: (min = 0, max = 1) => {
    min = Math.floor(min); max = Math.floor(max);
    if (max < min) [min, max] = [max, min];
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
};

const renderTemplate = (value, ctx) => {
  if (typeof value !== 'string' || !value.includes('{{')) return value;
  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (m, keyPath) => {
    const k = String(keyPath).trim();
    if (k === 'uuid') return randomUUID();
    // JS expression: {{= expr}} or {{js: expr}}
    if (k.startsWith('=') || k.startsWith('js:')) {
      const expr = k.startsWith('js:') ? k.slice(3) : k.slice(1);
      try {
        const sandbox = {
          ...ctx,
          helpers,
          Math,
          Date,
          JSON,
        };
        // Run with a short timeout and isolated context
        const script = new vm.Script(`(function(){ return (${expr}); })()`);
        const result = script.runInNewContext(sandbox, { timeout: 50 });
        return result == null ? '' : String(result);
      } catch (e) {
        return '';
      }
    }
    const val = deepGet(ctx, k);
    return val == null ? '' : String(val);
  });
};

const buildTemplateContext = (req, urlObj, rawBody) => {
  // headers as lowercased map
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : (v ?? '')])
  );
  const query = Object.fromEntries(urlObj.searchParams.entries());
  let bodyJson = null;
  try { bodyJson = rawBody ? JSON.parse(rawBody) : null; } catch {}
  return {
    method: req.method,
    path: urlObj.pathname,
    url: req.url,
    host: headers['host'] || 'localhost',
    query,
    headers,
    body: rawBody || '',
    bodyJson,
    isoNow: new Date().toISOString(),
    epochMs: Date.now(),
    uuid: randomUUID(),
  };
};

loadMocksFromFile();

// In-memory logs buffer and SSE clients
const MAX_LOGS_BUFFER = parseInt(process.env.LOG_BUFFER_SIZE || '1000', 10);
const logsBuffer = [];
const sseClients = new Set();

// Structured logging helpers
const hrtimeMs = (startHr) => Number(process.hrtime.bigint() - startHr) / 1e6;
const jlog = (level, event, data = {}) => {
  const payload = { ts: new Date().toISOString(), level, event, ...data };
  const lvl = LEVELS[(level || 'info').toLowerCase()] || 20;
  if (lvl < LEVEL_THRESHOLD) return;
  try {
    if (level === 'error') console.error(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
    if (logStream) {
      const line = JSON.stringify(payload) + '\n';
      // rotate if needed before writing
      rotateLogsIfNeeded(Buffer.byteLength(line));
      logStream.write(line);
      logBytesWritten += Buffer.byteLength(line);
    }
  } catch {
    console.log(`[${level}] ${event}`, data);
  }
  // buffer and broadcast
  try {
    logsBuffer.push(payload);
    if (logsBuffer.length > MAX_LOGS_BUFFER) logsBuffer.shift();
    const line = 'data: ' + JSON.stringify(payload) + '\n\n';
    sseClients.forEach((res) => { try { res.write(line); } catch {} });
  } catch {}
};

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
};

const server = http.createServer((req, res) => {
  const startHr = process.hrtime.bigint();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : undefined;

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
    const body = {
      ok: true,
      port: PORT,
      configPath,
      hasConfigFile: fs.existsSync(configPath),
      mocksCount: currentMocks.length,
    };
    jlog('info', 'admin.health', { clientIp });
    return sendJson(200, body);
  }

  if (url.pathname === '/__mocks') {
    if (req.method === 'GET') {
      jlog('info', 'admin.get_mocks', { clientIp, count: currentMocks.length });
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
          jlog('info', 'admin.put_mocks', { clientIp, count: currentMocks.length, persisted });
          return sendJson(200, { ok: true, count: currentMocks.length, persisted });
        } catch (e) {
          jlog('error', 'admin.put_mocks_error', { clientIp, message: e.message });
          return sendJson(400, { ok: false, error: 'Invalid JSON body', message: e.message });
        }
      });
      return;
    }
  }

  if (url.pathname === '/__reload' && req.method === 'POST') {
    loadMocksFromFile();
    jlog('info', 'admin.reload', { clientIp, count: currentMocks.length });
    return sendJson(200, { ok: true, count: currentMocks.length });
  }

  // Logs endpoints
  if (url.pathname === '/__logs' && req.method === 'GET') {
    const limit = Math.max(0, parseInt(url.searchParams.get('limit') || '500', 10));
    const format = (url.searchParams.get('format') || 'ndjson').toLowerCase();
    const start = Math.max(logsBuffer.length - limit, 0);
    const slice = logsBuffer.slice(start);
    if (format === 'json') {
      // Pretty JSON array
      setCors(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(slice, null, 2));
    } else {
      // NDJSON
      setCors(res);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(slice.map((e) => JSON.stringify(e)).join('\n'));
    }
    jlog('info', 'admin.logs_dump', { clientIp, limit, format });
    return;
  }

  if (url.pathname === '/__logs/stream' && req.method === 'GET') {
    setCors(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const replay = Math.max(0, parseInt(url.searchParams.get('replay') || '100', 10));
    const start = Math.max(logsBuffer.length - replay, 0);
    logsBuffer.slice(start).forEach((payload) => {
      res.write('data: ' + JSON.stringify(payload) + '\n\n');
    });
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
    jlog('info', 'admin.logs_stream_open', { clientIp, replay });
    return;
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
    const reqHeadersObj = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : (value ?? '')]));
    const templateCtx = buildTemplateContext(req, url, body);

    const matchedMock = findMatchingMock(liveRequest, currentMocks);
    const timestamp = new Date().toLocaleTimeString();

    if (matchedMock) {
      const { response: mockResponse } = matchedMock;
      console.log(`[${timestamp}] [200] ${req.method} ${req.url} -> Matched: "${matchedMock.name}"`);

      const sendResponse = () => {
        // CORS on API responses too
        setCors(res);
        // Debug headers
        res.setHeader('X-Mock-Matched', 'true');
        if (matchedMock.name) res.setHeader('X-Mock-Name', matchedMock.name);
        if (matchedMock.id) res.setHeader('X-Mock-Id', matchedMock.id);
        mockResponse.headers.forEach((h) => {
          if (h && h.key) {
            const renderedVal = renderTemplate(h.value, templateCtx);
            res.setHeader(h.key, renderedVal);
          }
        });
        res.writeHead(mockResponse.status);
        const renderedBody = typeof mockResponse.body === 'string' ? renderTemplate(mockResponse.body, templateCtx) : '';
        res.end(renderedBody);
        const durationMs = hrtimeMs(startHr).toFixed(1);
        const responseHeaders = res.getHeaders();
        jlog('info', 'request.matched', {
          method: req.method,
          url: req.url,
          status: mockResponse.status,
          durationMs: Number(durationMs),
          mockId: matchedMock.id,
          mockName: matchedMock.name,
          clientIp,
          requestHeaders: reqHeadersObj,
          responseHeaders,
        });
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
      // Add debug header on 404 as well
      res.setHeader('X-Mock-Matched', 'false');
      const durationMs = hrtimeMs(startHr).toFixed(1);
      // send JSON and then log response headers
      const status = 404;
      const result = sendJson(404, errorBody);
      const responseHeaders = res.getHeaders();
      jlog('info', 'request.no_match', {
        method: req.method,
        url: req.url,
        status,
        durationMs: Number(durationMs),
        clientIp,
        requestHeaders: reqHeadersObj,
        responseHeaders,
      });
      return result;
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Mock Server is running on http://localhost:${PORT}`);
  console.log(`   Config path: ${configPath} (exists: ${fs.existsSync(configPath)})`);
  console.log(`   Admin endpoints: /__health, /__mocks (GET/PUT), /__reload`);
  jlog('info', 'server.start', { port: PORT, configPath, hasConfigFile: fs.existsSync(configPath), logPath: LOG_PATH });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[ERROR] Port ${PORT} is already in use. Please stop the other process or choose a different port.`);
  } else {
    console.error('[ERROR] Server error:', err);
  }
});
