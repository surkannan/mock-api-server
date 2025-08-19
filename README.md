<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Mock API Server - Dev & Usage

This repo contains a React/Vite UI to configure mock API endpoints and a standalone Node server that serves those mocks.

You can run both together via the provided dev wrapper.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Start dev (UI + Server):
   `npm run dev`
   - To pass server args: `DEV_SERVER_ARGS="--config path/to/mocks-config.json" npm run dev`
3. Or run separately:
   - UI only: `npm run dev:ui`
   - Server only: `npm run dev:server` (optionally pass a config with `--config path/to/mocks-config.json` or env `MOCKS_CONFIG`)
