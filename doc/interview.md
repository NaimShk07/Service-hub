# ServiceHub - Technical Interview Guide

A quick-reference Q&A guide to explain the technical decisions, architecture, and implementation of **ServiceHub** during interviews.

---

### Q1: What is ServiceHub and what is the tech stack?
**Answer:**
ServiceHub is an on-demand local service marketplace backend built with **NestJS (v11)**, **TypeScript**, **Prisma ORM (v7)** with `@prisma/adapter-pg`, and **PostgreSQL**. It features modular domain architecture, JWT authentication with HTTP-Only cookies, Razorpay payments setup, and full OpenAPI documentation.

---

### Q2: Why NestJS over plain Express or Fastify?
**Answer:**
NestJS provides an out-of-the-box structured framework with:
* **Modular Monolith Architecture**: Clean separation of concerns using Modules, Controllers, Services, and Repositories.
* **Dependency Injection (DI)**: Enables loose coupling, high testability, and clean code maintainability.
* **Built-in Ecosystem**: Native support for validation pipes, exception filters, interceptors, and guards.

---

### Q3: How is Prisma ORM configured in this project?
**Answer:**
We use **Prisma v7** with `@prisma/adapter-pg` driver adapter:
* Provides native PostgreSQL connection pool performance.
* `PrismaService` extends `PrismaClient` and implements `OnModuleInit` and `OnModuleDestroy` hooks for lifecycle management (`$connect()` / `$disconnect()`).
* Database logic in `AuthModule` uses a dedicated `AuthRepository` layer to isolate Prisma queries from business logic.

---

### Q4: How is Authentication structured and secured?
**Answer:**
Auth follows security best practices:
1. **Access Token (JWT)**: Passed via Authorization header for stateless request verification (`JwtAuthGuard` + Passport `JwtStrategy`).
2. **Refresh Token**: Stored in an **HTTP-Only, Secure, SameSite=Strict Cookie** to protect against XSS (Cross-Site Scripting).
3. **Database Security**: Refresh tokens are hashed using `bcrypt` before storing in PostgreSQL (`refreshTokenHash`), preventing token misuse even if database records are compromised.
4. **Logout Protocol**: Revokes database refresh token and clears cookie client-side.

---

### Q5: How do you enforce uniform API responses across the app?
**Answer:**
We use global NestJS primitives in `main.ts`:
* **`TransformInterceptor`**: Wraps all successful controller outputs into `{ statusCode, success: true, data, timestamp }`.
* **`HttpExceptionFilter`**: Catches all HTTP and unhandled exceptions into `{ statusCode, success: false, message, error, timestamp, path }`.
* **`ValidationPipe`**: Enforces strict payload shape using `class-validator` (`whitelist: true`, `forbidNonWhitelisted: true`).

---

### Q6: How is the database schema designed for booking & providers?
**Answer:**
* **Provider Verification**: `ProviderProfile` is linked 1-to-1 with `User` and tracks `VerificationStatus` (`PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`) along with `ProviderDocument` (Aadhaar, PAN, GST).
* **Services & Catalog**: Categories contain `Service` definitions, which map to `ProviderService` containing provider-specific pricing, duration, and buffer time.
* **Availability**: Weekly schedule matrix (`Availability` table with weekday, start/end time, break times).
* **Bookings**: Tracks `BookingStatus` (`PENDING_PAYMENT`, `CONFIRMED`, `COMPLETED`, `CANCELLED`) and integrates with Razorpay `Payment` records.

---

### Q7: What are the key architectural principles followed?
**Answer:**
* **Single Responsibility Principle (SRP)**: Controllers handle HTTP routing, Services manage business logic, Repositories handle data access.
* **Security by Design**: Password and refresh token hashing, HTTP-Only cookies, CORS control, input sanitization.
* **Centralized Configuration**: Environment variables managed via `@nestjs/config` namespaces (`app`, `database`, `jwt`, `razorpay`, `redis`).
* **Developer Experience**: Auto-generated Swagger documentation at `/api/docs`.
