# ServiceHub Production Runbook & System Architecture

## Overview
ServiceHub is a multi-tenant service discovery, scheduling, and payment backend built with NestJS, PostgreSQL (Prisma ORM), Redis, and BullMQ. This document serves as the single source of truth for architecture, local setup, operations, background workers, and release readiness.

---

## 1. System Architecture

```mermaid
graph TB
    subgraph ClientLayer["Clients & Third Parties"]
        Client["Web / Mobile Clients"]
        Razorpay["Razorpay Payment Gateway"]
    end

    subgraph SecurityLayer["Security & Gateway Hardening"]
        Helmet["Helmet Headers & CORS"]
        Throttler["Throttler Guard (Per-Route Limits)"]
        Validation["ValidationPipe (forbidNonWhitelisted)"]
        Timeouts["TimeoutInterceptor (30s)"]
    end

    subgraph AppLayer["NestJS Application Core"]
        AuthMod["Auth Module (JWT & Cookie)"]
        BookMod["Booking Module (State Machine)"]
        PayMod["Payment Module (Razorpay & Webhooks)"]
        ProvMod["Provider Module (RBAC & Verification)"]
        QueueMod["Jobs Module (BullMQ Processors)"]
        HealthMod["Health Probes (/live, /ready)"]
    end

    subgraph StorageLayer["Persistence & Infrastructure"]
        Postgres[("PostgreSQL 16 (GiST Constraints)")]
        RedisCache[("Redis 7 (Distributed Cache & BullMQ)")]
        Storage["Storage Service (Local / S3)"]
    end

    Client --> Helmet --> Throttler --> Validation --> Timeouts
    Razorpay -- Webhook --> Throttler
    Timeouts --> AuthMod
    Timeouts --> BookMod
    Timeouts --> PayMod
    Timeouts --> ProvMod
    Timeouts --> HealthMod

    AuthMod --> Postgres
    BookMod --> Postgres
    PayMod --> Postgres
    PayMod --> Razorpay
    ProvMod --> Postgres
    ProvMod --> Storage
    QueueMod --> RedisCache
    BookMod --> QueueMod
    HealthMod --> Postgres
    HealthMod --> RedisCache
```

---

## 2. Booking & Payment Lifecycle Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant API as ServiceHub API
    participant DB as PostgreSQL (GiST)
    participant RP as Razorpay
    participant Queue as BullMQ (Redis)
    participant Worker as Notification Worker

    Customer->>API: POST /bookings (providerServiceId, startsAt)
    API->>DB: Check GiST exclusion & provider availability
    DB-->>API: Slot reserved (PENDING_PAYMENT, 15m expiry)
    API->>Queue: Schedule expiry job (15 min delay)
    API-->>Customer: 201 Created (bookingId, reservationExpiresAt)

    Customer->>API: POST /payments/orders (bookingId)
    API->>RP: Create order (amount, currency, notes)
    RP-->>API: order_id
    API-->>Customer: 201 Created (order_id, razorpayKey)

    alt Webhook Confirmation Path
        RP->>API: POST /payments/webhook (x-razorpay-signature)
        API->>API: Validate HMAC-SHA256 signature
        API->>DB: Atomic Tx: Mark CONFIRMED, record PaymentTransaction
        API->>Queue: Schedule reminder.24h & reminder.2h jobs
        API-->>RP: 200 OK
    else Expiry Before Payment Race
        Queue->>Worker: Process booking.expire
        Worker->>DB: Check status; If PENDING_PAYMENT -> Mark EXPIRED
        Note over DB: Slot is released automatically for other customers
    end
```

---

## 3. Local Development Setup

### Prerequisites
- **Node.js**: `v20.x` or later
- **PostgreSQL**: `v16.x` with `btree_gist` extension enabled
- **Redis**: `v7.x`

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `PORT` | HTTP server port | `8000` |
| `NODE_ENV` | Application environment | `development` / `production` / `test` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/ServiceHub?schema=public` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password (optional) | `""` |
| `JWT_SECRET` | Secret for signing access tokens | `your-secure-jwt-secret-key-32-chars` |
| `JWT_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | `your-secure-jwt-refresh-secret-key` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh cookie lifespan | `7d` |
| `RAZORPAY_KEY_ID` | Razorpay API key ID | `rzp_test_...` |
| `RAZORPAY_SECRET` | Razorpay API secret key | `your_secret` |
| `RAZORPAY_WEBHOOK_SECRET`| Razorpay webhook signing secret | `your_webhook_secret` |
| `CORS_ORIGINS` | Allowed frontend origins | `http://localhost:3000,http://localhost:5173` |
| `CORS_CREDENTIALS` | Enable cookies in CORS | `true` |
| `SWAGGER_ENABLED` | Force enable Swagger in prod | `false` |

### Installation & Database Setup
```bash
# 1. Install dependencies
npm ci

# 2. Generate Prisma Client
npx prisma generate

# 3. Apply database migrations (including GiST extension)
npx prisma migrate dev

# 4. Seed initial catalog & categories
npm run seed
```

### Running Locally
```bash
# Start in watch mode
npm run start:dev

# Start in production mode
npm run build
npm run start:prod
```

- **API Base URL**: `http://localhost:8000/api/v1`
- **Swagger Documentation**: `http://localhost:8000/api/docs`
- **Liveness Probe**: `http://localhost:8000/health/live`
- **Readiness Probe**: `http://localhost:8000/health/ready`

---

## 4. Background Workers & Queue Operations

ServiceHub uses **BullMQ** on top of Redis for resilient asynchronous jobs.

### Registered Job Types
1. `reminder.24h`: Sent 24 hours prior to booking start time.
2. `reminder.2h`: Sent 2 hours prior to booking start time.
3. `booking.overdue`: Dispatched when a booking is confirmed but incomplete past its end window.

### Retry & Failure Policy
- **Attempts**: 3 attempts per job.
- **Backoff**: Exponential backoff (`delay: 2000ms`, doubling on each failure: 2s, 4s, 8s).
- **Idempotency**: Jobs use deterministic IDs (e.g. `reminder-24h_${bookingId}`) to guarantee duplicate submissions never duplicate work.
- **Dead-Letter Handling**: When all 3 retries are exhausted, the worker logs `🚨 PERMANENT FAILURE` with the job ID, reason, and updates the database `Notification` record to `FAILED`.

### Troubleshooting Failed Jobs
If background jobs are failing:
1. **Check Redis Connectivity**:
   ```bash
   redis-cli ping
   ```
2. **Verify Worker Logs**:
   Look for `[NotificationProcessor]` structured log entries containing `jobId` and `requestId`.
3. **Inspect Database Notification Records**:
   ```sql
   SELECT id, "bookingId", type, status, "failureReason", "createdAt"
   FROM notifications
   WHERE status = 'FAILED'
   ORDER BY "createdAt" DESC;
   ```
4. **Restart Stalled Jobs**:
   Stalled BullMQ jobs are automatically reclaimed by BullMQ's stalled job checker (`lockDuration: 30000ms`).

---

## 5. Automated CI Quality Gate

The repository includes a GitHub Actions pipeline (`.github/workflows/ci.yml`) enforcing quality checks on every push and pull request:

```
[ Push / PR ]
     ↓
Setup Node.js 20 & Cache
     ↓
Spin up PostgreSQL 16 & Redis 7 Service Containers
     ↓
Prisma Migration Deploy (btree_gist + Schema)
     ↓
Lint (`npm run lint`) & Typecheck (`tsc -p tsconfig.build.json --noEmit`)
     ↓
Unit Tests (`npm run test`)
     ↓
Integration & E2E Tests (`npm run test:e2e -- --runInBand`)
     ↓
Production Build (`npm run build`)
```

---

## 6. Week 9 Definition of Done Checklist

| Criteria | Status | Evidence / Verification |
| :--- | :---: | :--- |
| **Critical workflows pass from clean environment** | ✅ Done | Automated CI pipeline executes migrations and tests on fresh PostgreSQL/Redis containers. |
| **Booking concurrency & payment idempotency** | ✅ Done | Tested in `test/booking-concurrency.e2e-spec.ts` & `test/payment-webhook-concurrency.e2e-spec.ts`. |
| **Background job retries and failure states** | ✅ Done | Tested in `test/bullmq-jobs.e2e-spec.ts` (3 retries, exponential backoff, dead-letter state). |
| **Protected endpoints have authorization coverage** | ✅ Done | RBAC tested across `admin.e2e-spec.ts`, `auth.e2e-spec.ts`, and `security-hardening.e2e-spec.ts`. |
| **Logs trace a request through operations** | ✅ Done | Request ID correlation (`X-Request-ID`) verified in `test/observability-health.e2e-spec.ts`. |
| **Health checks distinguish live from ready** | ✅ Done | Verified in `test/observability-health.e2e-spec.ts` (`/health/live` vs `/health/ready`). |
| **CI runs linting, typechecking, tests, build** | ✅ Done | Automated in `.github/workflows/ci.yml`. |
| **Setup and deployment prerequisites documented** | ✅ Done | Documented in `README.md` and `docs/runbook.md`. |
