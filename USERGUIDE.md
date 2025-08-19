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
    -   [Simulate an API Request](#simulate-an-api-request)
    -   [Inspect Logs](#inspect-logs)
    -   [Debug a Mismatched Request](#debug-a-mismatched-request)
4.  [Matching Logic Details](#matching-logic-details)

---

## 1. Interface Overview

The application is divided into three main panels:

1.  **Configured Mocks (Left):** This panel lists all the mock endpoints you've created. You can add, edit, or delete mocks from here.
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
-   **Path:** The request path must match. You can use path parameters like `/users/:id` which will match `/users/1`, `/users/abc`, etc.
-   **Query Params:** If you define query parameters in the matcher, the request URL must contain all of them. The value check is a partial match (`.includes()`).
-   **Headers:** If you define headers in the matcher, the request must contain all of them. The value check is also a partial match.
-   **Body Contains:** If you provide text in the "Body Contains" field, the request's body must include that text. This is useful for matching specific keywords or properties in a JSON payload.

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

-   **Path Parameters:** The path matcher supports placeholder parameters. A matcher path of `/api/items/:itemId` will match `/api/items/123` and `/api/items/any-string`.
-   **Partial Matching:** For query parameters, headers, and the request body, the matching logic checks if the actual value *contains* the value specified in the matcher.
    -   *Example:* If a mock header is `Authorization: Bearer`, a request with the header `Authorization: Bearer xyz123` **will match**.
-   **Empty Fields:** Any empty key-value pairs for headers or query params in a mock's configuration are ignored during matching.

