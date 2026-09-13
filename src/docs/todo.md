# 📋 ServiceHub — Master Production Roadmap & TODO

Comprehensive technical review, completed milestones, and actionable roadmap to elevate ServiceHub from prototype to a resilient, high-performance, enterprise production-grade application.

---

## 🚦 Milestone Status Overview

```text
src/modules/
├── auth          🟢 Fully Functional (JWT + Refresh Cookie, Throttler rate limiting)
├── catalog       🟢 Functional (Categories & Services with validation & DTOs)
├── provider      🟡 Functional (Profiles, Services, Availability, Documents — Slot filter pending)
├── booking       🟢 Fully Functional (PostgreSQL exclusion locks, state machine, concurrency safe)
├── payment       🟢 Fully Functional (Razorpay orders, client verification, HMAC webhook idempotency)
├── notification  🟡 In Progress (BullMQ queue workers complete — Notification Center APIs next)
├── review        🟢 Days 1–4 Complete (Lifecycle invariants, atomic rating recalculation, sorting)
└── admin         🟢 Functional (Provider verification, rejection, suspension, audit logs)
```

---

## 🚨 1. Critical Business Logic & Runtime Reliability

- [ ] **Dynamic Slot Availability Conflict Filtering**
  - **File:** `src/modules/provider/services/provider-availability.service.ts`
  - **Current Gap:** `generateSlot()` currently hardcodes `const isAvailable = true;`. Booked appointment slots appear available to end users.
  - **Action:** Query existing `Booking` records for the target provider and date (status `CONFIRMED`, `PENDING_PAYMENT`). Mark any slot whose `[startsAt, endsAt]` window overlaps with an active booking as `available: false`.

- [ ] **Graceful Shutdown Hooks for Containerized Deployments**
  - **File:** `src/main.ts`
  - **Current Gap:** Missing `app.enableShutdownHooks()`.
  - **Action:** Call `app.enableShutdownHooks()` so SIGTERM/SIGINT signals trigger `PrismaService.onModuleDestroy()` (`$disconnect()`, `pool.end()`) and Redis connection teardown without abruptly killing transactions or leaking connections.

- [ ] **Fail-Fast Environment Configuration Validation**
  - **File:** `src/config/validation.ts`
  - **Current Gap:** File is currently empty (0 bytes). Missing environment variables cause runtime crashes instead of boot-time assertion.
  - **Action:** Define strict schema validation (`Joi` or `class-validator`) for `DATABASE_URL`, `JWT_SECRET`, `REDIS_HOST`, `REDIS_PORT`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and bind it to `ConfigModule.forRoot({ validationSchema })`.

---

## ⚠️ 2. ESLint & Static Code Quality (`npm run lint`)

Fix all **12 ESLint errors** to achieve 100% green CI/CD checks:

- [ ] **`src/app.module.ts:39`**: Remove unused `'config'` variable in `ThrottlerModule` async options.
- [ ] **`src/common/filters/prisma-client-exception.filter.ts:42`**: Fix template literal type error on `exception.meta?.field_name`. Cast or safely stringify.
- [ ] **`src/common/interceptors/logging.interceptor.ts:27`**: Use or log the `'error'` object instead of leaving it unused.
- [ ] **`src/modules/auth/services/auth.service.ts:140`**: Handle or log `'error'` parameter in catch block.
- [ ] **`src/modules/auth/services/auth.service.ts:188`**: Fix unused `passwordHash` and `refreshTokenHash` destructuring (use prefix `_` or a dedicated sanitization helper).
- [ ] **`src/modules/payment/gateway/razor.gateway.ts`**: Remove redundant `async` keyword or implement async logic on `createOrder` and `createRefund`.
- [ ] **`src/shared/mailer/providers/dev-email.provider.ts`**: Remove redundant `async` keyword or properly await mock dispatch.
- [ ] **`src/modules/provider/services/provider-availability.service.ts:70`**: Consume `existingBookings` parameter inside slot generation logic.
- [ ] **`test/provider-search.e2e-spec.ts`**: Remove unused `prismaService` and `redisService` test variables.

---

## 🧱 3. Architecture & Clean Code Alignment

- [ ] **Fix Repository Naming Typo**
  - **Current:** `src/modules/provider/repositories/provider-availability.repositor.ts`
  - **Target:** `src/modules/provider/repositories/provider-availability.repository.ts`
  - **Action:** Rename file and update imports in `provider.module.ts` and `provider-availability.service.ts`.

- [ ] **Standardize TypeScript Path Aliases**
  - **File:** `src/database/prisma/prisma.service.ts`
  - **Action:** Replace deep relative import `import { PrismaClient } from "../../../generated/prisma/client"` with the configured alias `@prisma-client/client`.

- [ ] **Harmonize Exception Response Envelopes**
  - **Files:** `src/common/filters/http-exception.filter.ts` & `src/common/filters/prisma-client-exception.filter.ts`
  - **Current Gap:** `PrismaClientExceptionFilter` omits the `success: false` boolean field present in `HttpExceptionFilter`.
  - **Action:** Standardize the error envelope format so client frontends receive a consistent error payload contract across all error types.

- [ ] **Domain-Driven Boundary Isolation (Review -> Provider)**
  - **Files:** `src/modules/review/repositories/review.repository.ts` & `src/modules/provider/repositories/provider.repository.ts`
  - **Action:** Move `updateProviderRatingStats` from `ReviewRepository` into `ProviderRepository`. `ReviewService` should orchestrate via `ProviderRepository` to respect clean module boundaries.

---

## 🚀 4. Week 7 Remaining Milestones

- [ ] **Day 5 — Notification Center Domain & APIs**
  - [ ] `GET /api/v1/notifications/unread-count`: Fast unread notification badge count for customer.
  - [ ] `GET /api/v1/notifications`: Paginated customer notification history with read/unread filters.
  - [ ] `PATCH /api/v1/notifications/:id/read`: Mark individual notification as read.
  - [ ] `PATCH /api/v1/notifications/mark-all-read`: Bulk mark all unread notifications as read.
- [ ] **Day 6 — Connect Reviews to Marketplace Search**
  - [ ] Verify `QueryProviderSearchDto` incorporates recalculated rating & review counts.
  - [ ] Invalidate Redis search cache upon review creation (`redisService.incrementSearchVersion()`).
- [ ] **Day 7 — E2E & Edge-Case Test Suite Verification**
  - [ ] End-to-end integration tests for complete Booking -> Review -> Rating aggregation -> Notification cycle.

---

## 🛡️ 5. Production Hardening & Observability (Long-Term)

- [ ] **Structured JSON Logging**:
  - Replace default string logging in `logging.interceptor.ts` with structured JSON format and `x-request-id` correlation IDs for log collectors (Datadog, Loki, CloudWatch).
- [ ] **Health Checks Expansion**:
  - Expand `@nestjs/terminus` checks in `health.controller.ts` to include memory thresholds (`MemoryHealthIndicator`) and Redis connectivity ping.
- [ ] **Swagger Documentation Hardening**:
  - Disable `/api/docs` or protect with basic auth in production environments (`NODE_ENV === 'production'`).
- [ ] **Docker Multi-Stage Build**:
  - Add optimized production `Dockerfile` (builder stage -> runner stage) with non-root user.
