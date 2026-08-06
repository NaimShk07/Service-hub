# ServiceHub - Project Notes

## 1. Overview & Tech Stack

**ServiceHub** is a scalable marketplace backend for home & local services built with **NestJS**.

- **Framework**: NestJS v11 (Node.js & Express)
- **Language**: TypeScript
- **ORM & Database**: Prisma ORM v7 with `@prisma/adapter-pg` & PostgreSQL
- **Authentication**: Passport JWT + HTTP-Only Cookies + Bcrypt
- **Validation**: `class-validator` & `class-transformer`
- **Documentation**: Swagger OpenAPI (`/api/docs`)

---

## 2. System Architecture

```
src/
├── common/        # Global Filters, Interceptors, Pipes, Guards, Decorators
├── config/        # Environment configurations (App, DB, JWT, Razorpay, Redis)
├── database/      # Prisma Client Service & Seed Scripts
└── modules/       # Domain Feature Modules
    ├── auth/          # Authentication & Security (Implemented)
    ├── admin/         # Admin Management & Provider Verification
    ├── booking/       # Booking Engine & Slot Management
    ├── catalog/       # Categories & Services Catalog
    ├── notification/  # Email, SMS & Push Notifications
    ├── payment/       # Razorpay Integration & Webhooks
    └── provider/      # Provider Profiles & Availability
```

---

## 3. Database Schema (`prisma/schema.prisma`)

Key entities and relationships:

- **User & Role**: Support for `USER` and `ADMIN` roles, email/phone uniqueness, soft deletion (`deletedAt`).
- **ProviderProfile & ProviderDocument**: Identity & business verification (`PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`).
- **Category & Service & ProviderService**: Catalog hierarchy with dynamic pricing (`INR`), service duration, and buffer time.
- **Availability**: Weekly provider schedule with break time support.
- **Booking & Payment**: Full booking status lifecycle integrated with Razorpay payment tracking.
- **Review & Notification & AuditLog**: Customer reviews, notification queues, and system audit logs.

---

## 4. Authentication Architecture (`AuthModule`)

- **Dual-Token System**:
  - **Access Token**: Short-lived JWT sent in Authorization header (`Bearer <token>`).
  - **Refresh Token**: Long-lived token stored in **HTTP-Only, Secure Cookie** (`/api/v1/auth`).
- **Security Practices**:
  - Passwords hashed with `bcrypt` (10 rounds).
  - Refresh token hashed before persisting to database (`refreshTokenHash`).
  - Dedicated `AuthRepository` abstracts database queries from domain logic.

---

## 5. Global API Standards

- **Global API Route Prefix**: `/api/v1`
- **Standard Response Interceptor**: Enforces `{ statusCode, success: true, data, timestamp }`.
- **Standard Exception Filter**: Catches all errors into `{ statusCode, success: false, message, error, timestamp, path }`.
- **Global Validation Pipe**: `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true`.

---

## 6. Implementation Status

- [x] Prisma ORM v7 Setup & PostgreSQL Driver Adapter
- [x] Modular Config Management
- [x] Global Response Interceptor & Exception Filter
- [x] Auth Module (Register, Login, Refresh Token, Logout)
- [x] Passport JWT Strategy & Guard
- [x] Swagger OpenAPI Setup
- [ ] Provider Module Implementation
- [ ] Catalog & Booking Engine
- [ ] Razorpay Integration
- [ ] Notification System
