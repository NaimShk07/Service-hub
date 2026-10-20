# Security & API Hardening Audit & Checklist

## Overview
As part of **Week 9 — Production Hardening & Reliability (Day 6)**, a comprehensive security and API hardening audit was performed across ServiceHub's backend architecture. The objective was to eliminate vulnerabilities, enforce defense-in-depth, and verify all protections with automated regression tests without introducing unnecessary complexity.

---

## 1. Security Hardening Checklist

| Area | Status | Vulnerability / Risk Identified | Hardening Fix Applied | Automated Verification Test |
| :--- | :---: | :--- | :--- | :--- |
| **Rate Limiting** | ✅ PASS | Brute-force attacks on `/auth/login`, bot registration spam on `/auth/register`, payment order spamming, and document upload exhaustion. | Configured route-level `@Throttle({ default: { limit, ttl } })` on abuse-prone endpoints (login: 5/min, register: 5/min, booking: 10/min, orders: 10/min, verify: 10/min, upload: 10/min). Added `@SkipThrottle()` on Razorpay webhooks to prevent dropping payment confirmation webhooks. | `test/security-hardening.e2e-spec.ts` (`1. Rate Limiting Protection`) |
| **DTO Validation** | ✅ PASS | Mass-assignment attacks (e.g. injecting `isAdmin: true` or `role: ADMIN` into registration payload) and unvalidated route params. | Configured global `ValidationPipe` with `forbidNonWhitelisted: true`, `whitelist: true`, and added `ParseUUIDPipe` on routes like `/notifications/:id/read` and `/bookings/:id`. | `test/security-hardening.e2e-spec.ts` (`2. DTO Validation`) |
| **Pagination Limits** | ✅ PASS | DoS via unbounded database queries (e.g., `?limit=999999` or `?page=0` exhausting memory/connections). | Enforced `@Max(50)` / `@Max(100)` and `@Min(1)` with `@IsInt()` across all list endpoints (`PaginationDto`, `BookingQueryDto`, `ProviderQueryDto`). | `test/security-hardening.e2e-spec.ts` (`3. Pagination Limits`) |
| **CORS Configuration** | ✅ PASS | Overly permissive CORS policies allowing untrusted browser origins to interact with APIs. | Configured explicit HTTP methods (`GET, POST, PUT, PATCH, DELETE, OPTIONS`), restricted allowed headers, origin whitelisting via config, and exposed `X-Request-ID` for frontend correlation. | `src/main.ts` |
| **Security Headers** | ✅ PASS | Clickjacking, MIME confusion, missing transport security. | Integrated `helmet()` configuring `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, and Strict Transport Security (`HSTS`). | `test/security-hardening.e2e-spec.ts` (`4. Security Headers`) |
| **Production Information Disclosure** | ✅ PASS | Leaking SQL query fragments, database table/column names (`users_email_key`), or stack traces in API error responses. | Hardened `PrismaClientExceptionFilter` and `HttpExceptionFilter` to sanitize internal errors in production (`NODE_ENV === "production"`), returning generic messages ("A duplicate record already exists", "Invalid reference") while logging details internally with `requestId`. | `test/security-hardening.e2e-spec.ts` (`5. Information Disclosure & Production Error Sanitization`) |
| **Provider Document Access & IDOR** | ✅ PASS | **High Severity**: `ServeStaticModule` previously served the entire `uploads/` directory at `/uploads`, allowing unauthenticated static downloads of confidential documents (e.g., tax IDs, Aadhaar, PAN). Furthermore, absence of user authorization on document retrieval allowed IDOR attacks. | 1. Restricted `ServeStaticModule` exclusively to `uploads/public`.<br>2. Created authenticated `GET /api/v1/provider/documents/:id/file` enforcing that only the owner provider or an `ADMIN` can retrieve private documents.<br>3. Implemented path traversal prevention in `LocalStorageService` to prevent `../` attacks. | `test/security-hardening.e2e-spec.ts` (`6. Safe Handling of Uploaded Provider Documents & IDOR Protection`) |
| **Request Timeouts** | ✅ PASS | Hanging HTTP connections consuming socket and memory descriptors indefinitely. | Created and applied global `TimeoutInterceptor` with a default 30-second cancellation threshold that throws `408 Request Timeout`. | `test/security-hardening.e2e-spec.ts` (`7. Request Timeouts`) |
| **Graceful Shutdown** | ✅ PASS | In-flight requests or background worker tasks severed abruptly on SIGTERM / deployment rollouts. | Enabled NestJS lifecycle hooks via `app.enableShutdownHooks()` in `main.ts` ensuring clean database pool drain, Redis disconnect, and BullMQ worker queue pause. | `src/main.ts` |
| **Environment & Debug Gating** | ✅ PASS | Swagger API documentation exposed publicly in production environments without authorization. | Added conditional Swagger gating: Swagger UI is disabled in production unless explicitly opted in via `SWAGGER_ENABLED=true`. | `src/main.ts` |

---

## 2. Vulnerabilities Found & Fixes Applied

### Vulnerability 1: Insecure Direct Object Reference (IDOR) & Public Static File Disclosure
- **Finding:** `ServeStaticModule` was mounted to root `uploads/` path, making uploaded provider identity documents (business licenses, Aadhaar, PAN) accessible directly via static URL without any authentication token or permission checks.
- **Fix:**
  1. Updated `ServeStaticModule` in `src/app.module.ts` to only serve the isolated subfolder `uploads/public`.
  2. Routed all confidential provider documents through `GET /api/v1/provider/documents/:id/file`.
  3. Added access control logic in `ProviderService.getDocumentFileForUser(documentId, userId, role)` ensuring that only the owning provider or an Admin can download the file. Non-owner customers receive `403 Forbidden`. Unauthenticated requests receive `401 Unauthorized`.
  4. Added path traversal guards (`path.resolve`, `path.basename`, and substring validation) in `LocalStorageService` to reject `../` traversal attempts.

### Vulnerability 2: Mass Assignment & Privilege Escalation in Registration
- **Finding:** Registration request payloads could potentially include undeclared fields if validation pipes allowed loose input.
- **Fix:** Verified and tested that `forbidNonWhitelisted: true` is enabled in `ValidationPipe` globally in `src/main.ts`, rejecting any attempts to submit extra fields (e.g. `isAdmin: true` or `role: ADMIN`) with `400 Bad Request`.

### Vulnerability 3: Abuse & Brute-Force on Financial and Booking Endpoints
- **Finding:** While authentication had baseline throttling, critical endpoints such as booking creation (`POST /bookings`), Razorpay order initialization (`POST /payments/orders`), and document uploads (`POST /me/provider/documents`) lacked rate limits, leaving them vulnerable to spam and resource exhaustion.
- **Fix:**
  - Added `@Throttle({ default: { limit: 10, ttl: 60000 } })` to booking creation, payment order creation, and document upload endpoints.
  - Added `@SkipThrottle()` to `POST /payments/webhook` to ensure webhook retries from Razorpay are never blocked.

### Vulnerability 4: Production Error Leakage
- **Finding:** Raw Prisma constraint errors (e.g. `Unique constraint failed on the fields: (email)`) could expose schema internals to API clients.
- **Fix:** Updated `PrismaClientExceptionFilter` to detect `NODE_ENV === 'production'` and sanitize P2002 (duplicate), P2025 (not found), and P2003 (foreign key) errors into clean, opaque error messages while retaining internal structured logging with correlated `requestId`.

### Vulnerability 5: Swagger Access Gating
- **Finding:** Swagger documentation was configured to start unconditionally on any environment where the app was booted.
- **Fix:** Added production gate in `src/main.ts`:
  ```ts
  const isProduction = configService.get<string>("app.nodeEnv") === "production";
  const swaggerEnabled = configService.get<string>("SWAGGER_ENABLED") === "true";
  if (!isProduction || swaggerEnabled) {
    SwaggerModule.setup("api/docs", app, document);
  }
  ```

---

## 3. Test Verification Results

### Automated Regression Suite (`test/security-hardening.e2e-spec.ts`):
- **Rate Limiting:**
  - `✓ should throttle excessive failed login attempts (limit: 5 req/min)`
  - `✓ should throttle excessive registration attempts (limit: 5 req/min)`
- **DTO Validation & Rejection:**
  - `✓ should reject requests containing non-whitelisted/unexpected properties (forbidNonWhitelisted)`
  - `✓ should reject malformed UUID route parameters with 400 Bad Request`
- **Pagination Limits:**
  - `✓ should reject excessively large limit values (> 50/100) with 400 Bad Request`
  - `✓ should reject negative or zero page query parameter`
- **Security Headers:**
  - `✓ should return standard security headers on all responses`
- **Production Error Sanitization:**
  - `✓ should not expose database column names or internal SQL errors in production`
- **Safe Document Handling & IDOR:**
  - `✓ should prevent direct unauthenticated static access to /uploads/documents (404)`
  - `✓ should reject unauthenticated access to document file endpoint (401 Unauthorized)`
  - `✓ should reject non-owner customer or unauthorized user from viewing provider document (403 Forbidden)`
  - `✓ should allow the document owner provider to download their document (200 OK)`
  - `✓ should allow Admin to view and download any provider document (200 OK)`
  - `✓ should prevent path traversal attacks in LocalStorageService`
- **Request Timeouts:**
  - `✓ TimeoutInterceptor should throw 408 Request Timeout when processing exceeds limit`

### Full Suite Regression:
```bash
Test Suites: 14 passed, 14 total
Tests:       223 passed, 223 total
Snapshots:   0 total
Time:        10.428 s
```
All 14 test suites and 223 end-to-end tests pass cleanly. TypeScript compilation (`nest build`) compiles with zero errors.
