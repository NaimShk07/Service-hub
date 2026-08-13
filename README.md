# ServiceHub Backend API

[![NestJS](https://img.shields.io/badge/Framework-NestJS%20v11-red.svg)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%20v7-blue.svg)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-UNLICENSED-brightgreen.svg)]()

ServiceHub is a enterprise-grade, scalable backend REST API designed for multi-tenant service discovery, provider onboarding, catalog management, booking scheduling, and role-based access control (RBAC).

---

## 🏗️ Architecture & Directory Layout

Following clean architecture and modular NestJS conventions, the codebase is organized as follows:

```
src/
  modules/
    auth/                  # Authentication, JWT Strategies, Cookie Auth, Roles
      controllers/
      dto/
      guards/
      repositories/
      services/
      strategies/
    catalog/               # Service & Category Management
      controllers/
      dto/
      repositories/
      services/
    provider/              # Provider Onboarding, Document Uploads, Profile Management
      controllers/
      dto/
      repositories/
      services/
    admin/                 # Admin Provider Verification, Suspension & Auditing
      controllers/
      dto/
      repositories/
      services/
  common/                  # Shared Interceptors, Exception Filters, Decorators, Storage
    decorators/
    filters/
    interceptors/
    storage/
    utils/
  database/                # Prisma ORM Connection Service & Database Seeding
    prisma/
    seed/
```

---

## ✨ Features (Week 1 Onboarding & Catalog Module)

- **Authentication & Authorization**:
  - JWT Bearer Authentication & HTTP-Only Refresh Cookie strategy.
  - Role-Based Access Control (`@Roles(Role.ADMIN)`, `@Roles(Role.USER)`).
- **Catalog Management**:
  - Category creation, pagination, slug generation, soft safety checks.
  - Service creation, category linkage, service delivery mode (`ONLINE`, `AT_CUSTOMER_LOCATION`, `AT_PROVIDER_LOCATION`).
- **Provider Onboarding**:
  - Provider profile creation (`POST /api/v1/me/provider`) with duplicate business name protection.
  - Multipart document upload (`POST /api/v1/me/provider/documents`) supporting `LICENSE`, `PAN`, `GST`, `AADHAAR` with file type/size validation.
- **Admin Verification Portal**:
  - Paginated provider discovery with status filter (`PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`).
  - Provider verification, rejection (with reason), and suspension workflows.
- **API Documentation & Compliance**:
  - 100% complete OpenAPI (Swagger) documentation available at `/api/docs`.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20+`
- **npm**: `v10+`
- **PostgreSQL**: `v15+` (or Prisma Postgres database connection string)

### Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/servicehub?sslmode=disable"
NODE_ENV="development"
PORT=3000
JWT_SECRET="your_jwt_access_secret_key"
JWT_EXPIRATION="15m"
JWT_REFRESH_SECRET="your_jwt_refresh_secret_key"
JWT_REFRESH_EXPIRATION="7d"
```

### Installation

```bash
npm install
```

### Database Migration & Seeding

```bash
# Generate Prisma Client
npx prisma generate

# Apply Database Migrations
npx prisma migrate dev

# Seed Database with Default Categories & Services
npm run seed
```

---

## 🏃 Running the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production build
npm run build
npm run start:prod
```

Once started:
- 🚀 **REST API Base URL**: `http://localhost:3000/api/v1`
- 📚 **Swagger Documentation**: `http://localhost:3000/api/docs`

---

## 🧪 Testing

```bash
# Run Unit Tests
npm run test

# Run E2E Integration Tests (includes provider onboarding & admin verification)
npm run test:e2e

# Test Coverage
npm run test:cov
```

---

## 📝 License

UNLICENSED — ServiceHub Enterprise Application.
