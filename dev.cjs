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

function start(name, cmd, args) {
  const p = spawn(cmd, args, { stdio: 'inherit', env: process.env });
  procs.push(p);
  p.on('exit', (code, signal) => {
    // If one exits, stop the others to keep things tidy
    procs.forEach((cp) => {
      if (cp.pid && cp !== p) {
        try { cp.kill('SIGTERM'); } catch {}
      }
    });
    process.exit(code ?? 0);
  });
  return p;
}

// Start Vite UI
start('vite', viteBin, []);

// Start mock server (accepts optional CLI flags via environment e.g. DEV_SERVER_ARGS="--config path.json")
const serverArgs = (process.env.DEV_SERVER_ARGS || '').trim().split(/\s+/).filter(Boolean);
start('server', 'node', [serverScript, ...serverArgs]);

// Cleanup on termination
function cleanup() {
  procs.forEach((p) => {
    try { p.kill('SIGTERM'); } catch {}
  });
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
