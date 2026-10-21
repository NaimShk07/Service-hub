# Day 5 — Structured Logging, Request IDs, and Health Checks

## 1. Overview & Architectural Blueprint

This document details the production-grade observability and health check architecture implemented for **ServiceHub** during Week 9 (Day 5). It covers structured JSON logging, distributed request ID correlation across HTTP requests and BullMQ background workers, PII/secret redaction, and liveness/readiness probes.

```
Incoming Request
      │
      ▼
┌──────────────────────────────┐
│     RequestIdMiddleware      │ ───► Validates or generates X-Request-ID (req_<uuid>)
└──────────────┬───────────────┘ ───► Stores in AsyncLocalStorage (requestContext)
               │                 ───► Sets response header 'X-Request-ID'
               ▼
┌──────────────────────────────┐
│      NestJS Controllers      │
└──────────────┬───────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌──────────────┐ ┌─────────────────────────┐
│ ServiceHub   │ │ BullMQ Job Dispatch     │
│   Services   │ │ (propagates requestId)  │
└───────┬──────┘ └────────────┬────────────┘
        │                     │
        ▼                     ▼
┌──────────────────────────────────────────┐
│      Structured Logging & AppLogger      │ ───► JSON format with level, message,
│        (with Sensitive Redaction)        │      requestId, context, and metadata
└──────────────────────────────────────────┘
```

---

## 2. Machine-Readable Structured Logs

### Schema & Format
All logs emit formatted JSON matching the production specification:

```json
{
  "level": "info",
  "message": "Booking confirmed",
  "requestId": "req_64fe258c-46d2-4e6e-9841-dd313f22e793",
  "bookingId": "cly1234567890",
  "context": "BookingService",
  "userId": "usr_99887766",
  "timestamp": "2026-10-18T06:51:02.000Z"
}
```

### Sensitive Data Redaction Policy
Log payloads are filtered through `sanitizeLogData` ([`sanitizer.util.ts`](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/common/logging/sanitizer.util.ts)):
- **Never Logged / Redacted (`[REDACTED]`):**
  - Passwords: `password`, `newPassword`, `currentPassword`, `passwordHash`
  - Tokens: `refreshToken`, `refreshTokenHash`, `accessToken`, `token`, `bearer`
  - Headers: `authorization`, `cookie`, `set-cookie`
  - Payment Secrets: `secret`, `webhookSecret`, `keySecret`, `razorpay_signature`
  - Financial & Personal Identifiers: `cardNumber`, `cvv`, `cvc`, `pan`, `ssn`, `aadhaar`
- **Bearer Token Stripping:** Raw strings containing `Bearer <token>` are matched with regex and sanitized to `Bearer [REDACTED]`.

---

## 3. Request Correlation (`X-Request-ID`)

1. **Generation & Inbound Validation:**
   - Implemented in [`RequestIdMiddleware`](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/common/middleware/request-id.middleware.ts).
   - Validates incoming `X-Request-ID` against `/^[a-zA-Z0-9_-]{1,64}$/`. If absent or malformed/oversized, generates `req_${randomUUID()}`.
2. **Context Propagation via `AsyncLocalStorage`:**
   - Managed via [`requestContext`](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/common/logging/request-context.ts).
   - Any service or interceptor can retrieve the current request ID via `getRequestId()` without passing `req` down through service parameters.
3. **HTTP Response Integration:**
   - The response header `X-Request-ID` is returned on every HTTP response (success, redirect, or error).
   - In [`HttpExceptionFilter`](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/common/filters/http-exception.filter.ts), error payloads also include `requestId` at root:
   ```json
   {
     "statusCode": 404,
     "success": false,
     "message": "Cannot GET /api/v1/invalid",
     "timestamp": "2026-10-18T06:51:02.000Z",
     "path": "/api/v1/invalid",
     "requestId": "req_64fe258c-46d2-4e6e-9841-dd313f22e793"
   }
   ```
4. **BullMQ Background Job Correlation:**
   - Job payloads in `BookingQueueService` and `NotificationQueueService` carry `requestId: getRequestId()`.
   - `BookingProcessor` and `NotificationProcessor` wrap execution in `requestContext.run({ requestId: job.data.requestId || 'job_' + job.id }, ...)` so all asynchronous background processing logs share the exact same correlation ID.

---

## 4. Health Checks Probes (`/health/live` & `/health/ready`)

Implemented in [`HealthController`](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/modules/health/health.controller.ts) using `@nestjs/terminus`:

### Liveness Probe (`GET /health/live`)
- **Purpose:** Verifies that the Node.js process is active and running.
- **Payload:**
  ```json
  {
    "status": "ok",
    "uptime": 142.35,
    "timestamp": "2026-10-18T06:51:02.000Z"
  }
  ```
- **HTTP Code:** `200 OK`.

### Readiness Probe (`GET /health/ready`)
- **Purpose:** Verifies that the system can serve live traffic, testing both PostgreSQL and Redis.
- **PostgreSQL Check (Hard Dependency):** Executes `SELECT 1`. If PostgreSQL is unreachable, throws `HealthCheckError` and responds with `503 Service Unavailable`:
  ```json
  {
    "status": "error",
    "info": { "redis": { "status": "up", "connected": true } },
    "error": { "database": { "status": "down", "error": "Connection terminated unexpectedly" } },
    "details": { ... }
  }
  ```
- **Redis Check (Auxiliary Dependency):** Pings Redis via `redisService.ping()`. If Redis is offline, the endpoint **does not crash or mark the process dead**; instead, it reports `status: "up"` with `degraded: true` and continues serving HTTP traffic with `200 OK`.

### Multi-Route Compatibility
Health probes are accessible both at root paths (`/health/live`, `/health/ready`) for cloud/Kubernetes orchestrators and under `/api/v1/health/*` for API clients.

---

## 5. Verification Matrix

The test suite [`test/observability-health.e2e-spec.ts`](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/test/observability-health.e2e-spec.ts) confirms 12 targeted scenarios:

| Category | Test Scenario | Status |
| :--- | :--- | :---: |
| **Health** | `GET /health/live` returns 200 with uptime | PASS |
| **Health** | `GET /api/v1/health/live` returns 200 via prefix | PASS |
| **Health** | `GET /health/ready` returns 200 when DB is responsive | PASS |
| **Health** | `GET /health/ready` returns 503 when DB fails | PASS |
| **Health** | `GET /health/ready` remains 200 degraded when Redis is down | PASS |
| **Request Correlation** | Auto-generates `req_<uuid>` if header missing | PASS |
| **Request Correlation** | Validates & preserves client-supplied `X-Request-ID` | PASS |
| **Request Correlation** | Rejects malicious/oversized incoming ID with fallback | PASS |
| **Request Correlation** | Includes `requestId` in error response headers and body | PASS |
| **Structured Logging** | Redacts sensitive fields (passwords, tokens, cards, secrets) | PASS |
| **Structured Logging** | Strips Bearer tokens in raw log strings | PASS |
| **Structured Logging** | AppLogger formats machine-readable JSON with correlation | PASS |

**Full Project Verification:** 13/13 test suites passed, 208/208 tests passing.
