# Mock API Server - User Guide

Welcome to the Mock API Server! This tool allows you to create, configure, and test mock API endpoints directly in your browser. It's perfect for frontend development when the backend isn't ready, or for creating stable test environments.

## Table of Contents
1.  [Interface Overview](#interface-overview)
2.  [Core Concepts](#core-concepts)
    -   [What is a Mock?](#what-is-a-mock)
    -   [Request Matching](#request-matching)
    -   [Mock Responses](#mock-responses)
3.  [How-To Guides](#how-to-guides)
    -   [Create a New Mock](#create-a-new-mock)
    -   [Edit or Delete a Mock](#edit-or-delete-a-mock)
    -   [Persisting Mocks (Import/Export)](#persisting-mocks-importexport)
    -   [Simulate an API Request](#simulate-an-api-request)
    -   [Inspect Logs](#inspect-logs)
    -   [Debug a Mismatched Request](#debug-a-mismatched-request)
4.  [Matching Logic Details](#matching-logic-details)
    -   [Path Matching](#path-matching)
    -   [Regular Expression Matching](#regular-expression-matching-headers-query-params-body)
    -   [Empty Fields](#empty-fields)

---

## 1. Interface Overview

The application is divided into three main panels:

1.  **Configured Mocks (Left):** This panel lists all the mock endpoints you've created. You can add, edit, delete, import, and export mocks from here.
2.  **API Simulator (Middle):** This is your testing ground. Construct and send HTTP requests to see how they match against your configured mocks and what response is returned.
3.  **Request Log (Right):** A real-time log of all requests sent from the API Simulator. It shows which mock was matched (if any) and the resulting status code.

---

## 2. Core Concepts

### What is a Mock?

A "mock" is a single rule that defines how the server should respond to a specific kind of request. It consists of two parts:
-   **Request Matcher:** A set of criteria to identify an incoming request (e.g., `GET /api/users/1`).
-   **Mock Response:** The predefined response to send back if a request meets the criteria (e.g., a `200 OK` status with a JSON body).

### Request Matching

When you send a request from the simulator, it's checked against your list of mocks from top to bottom. The **first mock** that satisfies all of its matcher conditions will be used. A request must match **all** of a mock's defined criteria:

-   **HTTP Method:** The method must be an exact match (e.g., `GET`, `POST`).
-   **Path:** The request path must match the defined pattern. The matcher supports wildcards for powerful matching.
    -   Use `:param` or `*` to match a single URL segment (e.g., `/users/*` matches `/users/123`).
    -   Use `**` to match multiple URL segments (e.g., `/assets/**` matches `/assets/img/logo.png`).
-   **Query Params & Headers:** If defined, the request must contain all of them. The value field supports **regular expressions** for advanced matching. If the value isn't a valid regex, it falls back to a simple substring check.
-   **Body Contains:** If provided, this field also supports **regular expressions** against the entire request body. It falls back to a substring check if the pattern is not a valid regex.

### Mock Responses

When a request is successfully matched, the server generates the defined response:

-   **Status:** The HTTP status code to return (e.g., `200`, `404`, `500`).
-   **Headers:** Any custom response headers you want to include.
-   **Body:** The content of the response body. For JSON, ensure it's valid JSON.
-   **Delay:** An optional delay in milliseconds (ms) to simulate network latency.

---

## 3. How-To Guides

### Create a New Mock

1.  In the **Configured Mocks** panel, click the **"New"** button.
2.  A modal window will appear. Fill in the details:
    -   **Mock Name:** A descriptive name, like "Get User Success" or "Create User Validation Error".
    -   **Request Matcher (Left side):**
        -   Select the **HTTP Method** and enter the **Path**.
        -   Click "Add Query Param" or "Add Header" to add key-value pairs for matching.
        -   Enter text in the **Body Contains** field if you want to match against the request payload.
    -   **Mock Response (Right side):**
        -   Set the **Status** code and optional **Delay**.
        -   Add any **Headers** you want the response to have.
        -   Fill in the **Body** with the content you want to return.
3.  Click **"Save Mock"**. Your new mock will appear at the top of the list.

### Edit or Delete a Mock

-   **To Edit:** Hover over a mock in the list and click the **pencil icon**. The same form will appear, pre-filled with the mock's data. Make your changes and click "Save Mock".
-   **To Delete:** Hover over a mock and click the **trash can icon**.

### Persisting Mocks (Import/Export)

You can save your entire mock configuration to a file or load a configuration from a file.

-   **Export Mocks:**
    1.  In the **Configured Mocks** panel, click the **"Export"** button.
    2.  This will download a `mocks-config.json` file to your computer. This file contains all of your current mocks.

-   **Import Mocks:**
    1.  In the **Configured Mocks** panel, click the **"Import"** button.
    2.  Select a `.json` file that you previously exported.
    3.  A confirmation dialog will appear, warning you that this will overwrite your current setup.
    4.  Click "OK" to proceed. Your mocks will be replaced with the content from the file.

### Simulate an API Request

1.  Go to the **API Simulator** panel.
2.  Select the **HTTP Method** from the dropdown.
3.  Enter the full request **path**, including any query parameters (e.g., `/api/users?page=2`).
4.  Add any **Headers** or a request **Body** as needed.
5.  Click **"Send Request"**.
6.  The response status and body will appear in the "Response" section below.

### Inspect Logs

1.  After sending a request, a new entry will appear at the top of the **Request Log** panel.
2.  Each entry shows the status, method, path, and time.
3.  Click on any log entry to expand it. The detailed view shows:
    -   **Matched Mock:** The name of the mock that was matched.
    -   **Request Body:** The body of the request you sent.
    -   **Response Body:** The body of the response you received.

### Debug a Mismatched Request

If you send a request and it doesn't match any of your configured mocks, you will receive a `404 Not Found` response.

1.  Check the **Request Log**. The entry will have a `404` status.
2.  Expand the log entry and look at the **Response Body**.
3.  The body will contain a detailed JSON object showing the exact request the server received (method, URL, headers, and body).
4.  Compare this "actual" request data with your mock's "expected" matcher configuration to find the discrepancy. Common issues include a misspelled path, a missing header, or incorrect query parameter.

---

## 4. Matching Logic Details

### Path Matching

The path matcher offers several ways to define dynamic paths:

-   **Exact Match:** `/api/users` will only match `/api/users`.
-   **Path Parameters (Single Segment):** Both `/api/users/:id` and `/api/users/*` will match `/api/users/123` and `/api/users/any-string`, but will **not** match `/api/users/123/profile`.
-   **Wildcard (Multiple Segments):** `/assets/**` will match `/assets/logo.png`, `/assets/img/icons/user.svg`, and anything else under the `/assets/` path.

### Regular Expression Matching (Headers, Query Params, Body)

The `value` fields for Headers, Query Params, and the `Body Contains` field all support full regular expressions for powerful matching. The matcher will first try to interpret the input as a regex. If it's not a valid regex, it will fall back to a simple "contains" (substring) check.

-   **Header Example:**
    -   **Matcher Header:** `Authorization` | `^Bearer\s[\w.-]+$`
    -   **Will Match Request Header:** `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
    -   **Will Not Match:** `Authorization: Basic dXNlcjpwYXNz`

-   **Body Example:**
    -   **Matcher Body Contains:** `"userId":\s*\d+`
    -   **Will Match Request Body:** `{ "transactionId": "abc", "userId": 12345 }`
    -   **Will Not Match:** `{ "transactionId": "abc", "user": "guest" }`

-   **Fallback Behavior:** If you enter `[invalid-regex` in a value field, the matcher will simply check if the request value contains the literal string `"[invalid-regex"`.

### Empty Fields

Any empty key-value pairs for headers or query params in a mock's configuration are ignored during matching.
