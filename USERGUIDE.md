# Mock Server - User Guide

Welcome! This tool allows you to create a powerful mock API server for your development and testing needs. The system is split into two parts: a web-based **Configuration Editor** and a standalone **Node.js Server**.

This decoupled architecture provides the best of both worlds: a rich, user-friendly interface for building your mock APIs, and a lightweight, high-performance server that can be integrated into any development workflow and used by any HTTP client.

## Table of Contents
1.  [Core Architecture](#1-core-architecture)
2.  [The 5-Step Workflow](#2-the-5-step-workflow)
3.  [The Configuration Editor UI](#3-the-configuration-editor-ui)
    -   [Creating a New Mock](#creating-a-new-mock)
    -   [Request Matching](#request-matching)
    -   [Mock Responses](#mock-responses)
    -   [Importing and Exporting](#importing-and-exporting)
4.  [Running the Mock Server](#4-running-the-mock-server)
    -   [Example with `curl`](#example-with-curl)
    -   [Debugging a Mismatched Request](#debugging-a-mismatched-request)
5.  [Advanced Matching Details](#5-advanced-matching-details)
    -   [Path Matching](#path-matching)
    -   [Regular Expressions](#regular-expressions)

---

## 1. Core Architecture

-   **Mock Configuration Editor (Web UI):** Define mock endpoints (matchers + responses), then either:
    -   **Export** to a `mocks-config.json` file, or
    -   **Sync to Server** to push mocks directly into the running server.

-   **Mock Server (`server.cjs`):** A standalone Node.js server that serves the configured mocks. It accepts an optional config file and exposes admin endpoints to view/set mocks. You can hit it with `curl`, Postman, or your apps.

---

## 2. The 5-Step Workflow

This is the standard process for using the tool.

1.  **Start Dev (Recommended):**
    ```bash
    npm run dev
    ```
    This runs both the UI (Vite) and the mock server together. Open the UI and configure your mocks.
2.  **Choose how to apply mocks:**
    -   **Option A – Sync:** Use the UI "Sync" button to push mocks to the running server and persist them to its config file on disk.
        -   Use the dropdown ▾ next to Sync to choose **Sync (memory only)** if you don't want to persist.
    -   **Option B – Export File:** Click "Export" to download `mocks-config.json` and place it next to `server.cjs`. Then either run `npm run dev:server` or `node server.cjs --config mocks-config.json`.
3.  **Connect:** The server is available at `http://localhost:4000`. Point your applications to this address. You can reload the server from file via the UI or `POST /__reload`.

---

## 2a. Development/Testing Only

This tool is designed for development and testing workflows. It is not intended or hardened for production use.

- **Single instance:** The mock server is a simple single-process service. There is no clustering, multi-tenancy, or high availability.
- **Local persistence:**
  - The UI stores editor state in your browser’s `localStorage` (e.g., the current mocks you are working on).
  - When you choose "Sync" with persist, the server writes `mocks-config.json` on its filesystem. This assumes local, trusted dev environments.
- **No concurrency controls:** Multiple users pointing at the same server may overwrite each other’s changes.
- **Security:** Minimal security and auth. Do not expose this to untrusted networks.
- **Data durability:** Files can be changed or deleted by other processes; there are no backups/versioning built-in.

For CI or local testing, export/import the `mocks-config.json` file to track changes explicitly with version control.

---

## 3. The Configuration Editor UI

### Creating a New Mock
1.  Click the **"New"** button to open the form.
2.  Give your mock a descriptive **Name** (e.g., "Get User Success").
3.  Fill out the **Request Matcher** section to define what kind of incoming request this mock should apply to.
4.  Fill out the **Mock Response** section to define the response the server should send back.
5.  Click **"Save Mock"**.

### Request Matching
For a request to be matched, it must satisfy **all** criteria defined in the matcher:
-   **Method & Path:** The HTTP method and URL path (e.g., `GET` `/users/:id`).
-   **Query Params & Headers:** If you add any, the request must contain them. The `value` field supports regular expressions.
-   **Body Contains:** If filled, the request body must contain this text. This also supports regular expressions.

### Mock Responses
When a request is matched, the server sends this predefined response:
-   **Status:** The HTTP status code (e.g., `200`, `404`).
-   **Headers:** Any custom HTTP headers for the response.
-   **Body:** The response payload. Remember to use valid JSON if that's what your client expects.
-   **Delay:** An optional delay in milliseconds to simulate network latency.

### Importing, Exporting, and Syncing
-   **Export:** Download `mocks-config.json` that you can feed the server.
-   **Import:** Load a `mocks-config.json` back into the UI (overwrites current state).
-   **Sync:** Push current mocks to the running server and persist to its config file.
-   **More options ▾:** Choose "Sync (memory only)" to push without persisting.

---

## 4. Running the Mock Server

Once `server.cjs` is running, it prints a log for every request received and whether it matched a mock.

### Example with `curl`
If you have a mock for `GET /users/1` and your server is running:
```bash
# This command will hit your local mock server
curl -v http://localhost:4000/users/1

# You will see the mock response in your terminal, and a "Matched" log
# will appear in the terminal where server.cjs is running.
```

### Debugging a Mismatched Request
If you send a request and it doesn't match any mock, the server will return a `404 Not Found` response.
-   **Check the server console:** The log will show `[404] ... No Match`.
-   **Check the `curl` response:** The response body from the 404 will be a JSON object detailing the exact request the server received (path, headers, body).
-   Compare this "actual" request data with your mock's matcher configuration in the UI to find the difference.

---

## 5. Advanced Matching Details

### Path Matching
-   **Exact:** `/api/users` matches only `/api/users`.
-   **Parameter (single segment):** `/users/:id` or `/users/*` will match `/users/123` but NOT `/users/123/profile`.
-   **Wildcard (multi-segment):** `/assets/**` matches `/assets/logo.png` and `/assets/img/icons/user.svg`.

### Regular Expressions
The `value` field for **Headers**, **Query Params**, and the **Body Contains** field all support full regular expressions. If the text you enter is not a valid regex, the system will fall back to a simple "contains substring" check.

-   **Example:** To match an `Authorization` header for any JWT Bearer token, you could use the regex: `^Bearer\s[\w.-]+$`

## 6. Admin Endpoints

The server exposes a few admin endpoints to simplify integration with the UI:

-   `GET /__health` → Returns server status and counts.
-   `GET /__mocks` → Returns in-memory mocks.
-   `PUT /__mocks?persist=true|false` → Replace in-memory mocks with the provided array; persist to file if `persist=true`.
-   `POST /__reload` → Reload mocks from the config file on disk (if present).

---

## 7. Response Templating

Mock response headers and body support templating. Placeholders are resolved from the incoming request and runtime values.

### Available placeholders
- **Request**
  - `{{method}}`, `{{path}}`, `{{url}}`, `{{host}}`
- **Headers** (lowercased keys)
  - `{{headers.authorization}}`, `{{headers.content-type}}`, ...
- **Query params**
  - `{{query.page}}`, `{{query.userId}}`, ...
- **Body**
  - `{{body}}` (raw string)
  - `{{bodyJson.userId}}`, `{{bodyJson.profile.name}}` (parsed JSON; blank if parse fails)
- **Time/IDs**
  - `{{isoNow}}`, `{{epochMs}}`, `{{uuid}}`

If a key is missing or cannot be parsed, it renders as an empty string.

### Examples
- Header value: `X-Request-Id: {{uuid}}`
- JSON body (enter as a string in the UI):
```json
{
  "method": "{{method}}",
  "path": "{{path}}",
  "token": "{{headers.authorization}}",
  "page": "{{query.page}}",
  "receivedAt": "{{isoNow}}",
  "echo": {{body}}
}
```

---

## 8. JavaScript Expressions in Templates

You can compute values inline using a sandboxed JavaScript expression.

### Syntax
- `{{= <expression>}}`
- `{{js: <expression>}}`

The expression runs with access to the same context as placeholders plus `helpers`.

### Context available in expressions
- `method`, `path`, `url`, `host`
- `headers` (object with lowercased keys)
- `query` (object of query params)
- `body` (raw string)
- `bodyJson` (parsed JSON object or null)
- `isoNow`, `epochMs`, `uuid`
- `helpers` (see below)

### Helpers
- `helpers.upper(s)` / `helpers.lower(s)`
- `helpers.base64(s)`
- `helpers.json(o)` — JSON stringify
- `helpers.parseJson(s)` — safe JSON parse (returns null on error)
- `helpers.randomInt(min, max)` — inclusive integer

### Examples
- Header: `X-User: {{= (bodyJson && bodyJson.user && bodyJson.user.name) || 'anon' }}`
- JSON body:
```json
{
  "id": "{{uuid}}",
  "echo": {{= helpers.json(bodyJson) }},
  "token": "{{helpers.base64(headers.authorization)}}",
  "amountDoubled": {{= (Number(bodyJson?.amount) || 0) * 2 }},
  "at": "{{isoNow}}"
}
```

### Notes
- Expressions are sandboxed with a short timeout (unsafe globals like `require` are not available).
- Ensure final rendered bodies are valid JSON when your client expects JSON. Prefer `helpers.json(...)` when embedding dynamic objects.
