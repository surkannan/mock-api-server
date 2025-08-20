#!/usr/bin/env node
/*
  Dev wrapper: starts Vite (UI) and the standalone mock server together.
  - Vite serves the configuration UI
  - server.cjs serves mocks on port 4000
*/
const { spawn } = require('child_process');
const path = require('path');

const viteBin = path.resolve(__dirname, 'node_modules', '.bin', 'vite');
const serverScript = path.resolve(__dirname, 'server.cjs');

const procs = [];

const COLORS = { cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m', reset: '\x1b[0m' };

function writePrefixed(name, colorCode, chunk, toStdErr = false) {
  const text = chunk.toString();
  // Prefix each line in the chunk
  const prefix = `${colorCode}[${name}]${COLORS.reset} `;
  const prefixed = text.replace(/^/gm, prefix);
  (toStdErr ? process.stderr : process.stdout).write(prefixed);
}

function start(name, cmd, args, colorName) {
  const colorCode = COLORS[colorName] || '';
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  procs.push(p);

  if (p.stdout) p.stdout.on('data', (d) => writePrefixed(name, colorCode, d, false));
  if (p.stderr) p.stderr.on('data', (d) => writePrefixed(name, colorCode, d, true));

  p.on('exit', (code, signal) => {
    // If one exits, stop the others to keep things tidy
    procs.forEach((cp) => {
      if (cp.pid && cp !== p) {
        try { cp.kill('SIGTERM'); } catch {}
      }
    });
    const msg = `${name} exited with code ${code}${signal ? ` (signal ${signal})` : ''}`;
    writePrefixed(name, COLORS.gray, msg + '\n', true);
    process.exit(code ?? 0);
  });
  return p;
}

// Start Vite UI; default to 'info' so the startup URL/port is visible
const viteArgs = [
  '--clearScreen', 'false',
  '--logLevel', process.env.DEV_VITE_LOG_LEVEL || 'info',
  ...((process.env.DEV_VITE_ARGS || '').trim().split(/\s+/).filter(Boolean))
];
start('vite', viteBin, viteArgs, 'cyan');

// Start mock server (accepts optional CLI flags via environment e.g. DEV_SERVER_ARGS="--config path.json")
const serverArgs = (process.env.DEV_SERVER_ARGS || '').trim().split(/\s+/).filter(Boolean);
start('server', 'node', [serverScript, ...serverArgs], 'magenta');

// Cleanup on termination
function cleanup() {
  procs.forEach((p) => {
    try { p.kill('SIGTERM'); } catch {}
  });
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
