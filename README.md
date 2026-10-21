# ServiceHub Backend API

[![CI Pipeline](https://github.com/NaimShk07/Service-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/NaimShk07/Service-hub/actions/workflows/ci.yml)
[![NestJS](https://img.shields.io/badge/Framework-NestJS%20v11-red.svg)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%20v7-blue.svg)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016%20GiST-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Queue-Redis%207%20%2B%20BullMQ-DC382D.svg)](https://bullmq.io/)

ServiceHub is an enterprise-grade backend REST API designed for service discovery, scheduling, provider verification, double-booking prevention, automated Razorpay payments, and asynchronous BullMQ job workflows.

---

## 🏗️ Architecture & Modules

```
src/
  modules/
    auth/                  # JWT Access & Refresh Cookies, RBAC Guards, Strategies
    catalog/               # Category & Service Catalog Management
    provider/              # Provider Onboarding, KYC Document Verification, IDOR Protection
    admin/                 # Provider Approval/Suspension, User Auditing
    booking/               # Scheduling State Machine, GiST Overlap Constraints, 15m Reservations
    payment/               # Razorpay Order Creation, Signature Verification, Webhooks, Idempotency
    jobs/                  # BullMQ Notification Processors (24h/2h reminders, overdue jobs)
    notification/          # Notification Read Tracking & Persistence
    review/                # Verified Booking Customer Reviews & Ratings
    health/                # Terminus Probes: Liveness (/live) & Readiness (/ready)
  common/                  # Interceptors (Timeout, Transform, Logging), Filters, Storage
  database/                # Prisma PostgreSQL Connection Pooling & Seeding
```

Detailed architecture diagrams and sequence flows are available in [docs/runbook.md](docs/runbook.md).

---

## ✨ Core Highlights & Technical Invariants

- **Zero Overlapping Bookings**: Enforced at the PostgreSQL storage engine level using `EXCLUDE USING gist` on `(providerId WITH =, tsrange(bookingDate + startTime, bookingDate + endTime) WITH &&)`.
- **Payment Integrity & Idempotency**:
  - 15-minute payment reservation window releasing slots automatically on non-payment.
  - Razorpay webhook signature verification with SHA256 HMAC and atomic database transactions.
  - Idempotent processing of duplicate webhook submissions.
- **Asynchronous Reliability (BullMQ)**:
  - Exponential backoff retry policy (3 attempts: 2s, 4s, 8s).
  - Deterministic job IDs preventing duplicate notification dispatches.
  - Dead-letter handling updating database notification records to `FAILED`.
- **Security & Hardening**:
  - Per-route rate limiting via `@nestjs/throttler` (login/register: 5 req/min, orders/bookings: 10 req/min, webhooks: `@SkipThrottle()`).
  - Strict input rejection (`ValidationPipe` with `forbidNonWhitelisted: true`).
  - Private provider identity documents protected against IDOR and isolated from public static serving.
  - 30-second `TimeoutInterceptor` and graceful shutdown hooks (`enableShutdownHooks()`).
  - Production error sanitization hiding SQL internals while retaining correlated `requestId`.
- **Automated CI Quality Gate**: GitHub Actions pipeline spinning up PostgreSQL 16 & Redis 7 containers, running linting, typechecking, 14 E2E suites (223 tests), and verifying production build.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x+`
- **PostgreSQL**: `v16.x+` with `btree_gist` extension
- **Redis**: `v7.x+`

### Installation & Setup

```bash
# 1. Clone repository
git clone https://github.com/NaimShk07/Service-hub.git
cd Service-hub

# 2. Install dependencies
npm ci

# 3. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL, Redis, and Razorpay credentials

# 4. Generate Prisma Client & Run Migrations
npx prisma generate
npx prisma migrate dev

# 5. Seed Catalog Data
npm run seed
```

### Running the Application

```bash
# Development (with hot-reload)
npm run start:dev

# Production build & run
npm run build
npm run start:prod
```

- 🚀 **Base API**: `http://localhost:8000/api/v1`
- 📚 **Swagger OpenAPI Docs**: `http://localhost:8000/api/docs`
- 💓 **Liveness Probe**: `http://localhost:8000/health/live`
- 🛡️ **Readiness Probe**: `http://localhost:8000/health/ready`

---

## 🧪 Testing & CI

```bash
# Run Unit Tests
npm run test

# Run E2E Integration Tests (all 14 suites in-band)
npm run test:e2e -- --runInBand

# Lint & Typecheck
npm run lint
npx tsc -p tsconfig.build.json --noEmit
```

---

## 📖 Further Documentation

- **[docs/runbook.md](docs/runbook.md)**: Full operational runbook, sequence diagrams, environment variables, worker troubleshooting, and release readiness checklist.
- **[docs/security_hardening_checklist.md](docs/security_hardening_checklist.md)**: Security review, threat model, and vulnerability remediation report.
- **[docs/qna.md](docs/qna.md)**: Backend engineering Q&A notes, interview concepts, and technical reasoning explained in simple English.
