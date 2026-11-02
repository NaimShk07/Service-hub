# Backend Engineering Q&A Notes

A simple, short-English reference of key backend concepts, interview questions, and real-world system designs learned during ServiceHub development.

---

## Day 6: Security and API Hardening

### 1. Rate Limiting (`@nestjs/throttler`)

**Q: Why do we need tight rate limits on `/auth/login`?**  
**A:**  
1. It stops hackers from brute-forcing passwords with automated bots.  
2. Password checking uses `bcrypt`, which is very slow on the CPU. Many requests at once will freeze the entire server.

**Q: Why do we need tight rate limits on `/payments/orders`?**  
**A:**  
It stops bots from spamming our payment gateway (Razorpay) and creating thousands of fake or orphan pending orders in our database.

**Q: Why MUST we put `@SkipThrottle()` on `/payments/webhook`?**  
**A:**  
Because Razorpay calls this webhook after the user pays. If our server returns `429 Too Many Requests`, Razorpay fails to confirm the payment. The customer loses money, but their booking never gets confirmed.

**Q: How does NestJS Throttler track users, and why does `trust proxy` matter?**  
**A:**  
By default, it tracks by IP address (`req.ip`). In production behind Nginx or Cloudflare, all requests look like they come from the proxy's IP. Setting `app.set('trust proxy', 1)` tells Express to read the real client IP from the `X-Forwarded-For` header.

---

### 2. DTO Validation & Mass Assignment

**Q: What does `whitelist: true` do?**  
**A:**  
It silently removes any extra fields from the incoming JSON that are not defined in the DTO class.

**Q: Why is `whitelist: true` not enough, and why do we need `forbidNonWhitelisted: true`?**  
**A:**  
1. **Security:** If code ever uses `req.body` directly, unwhitelisted fields (like `role: "ADMIN"`) could sneak into the database.  
2. **Bugs:** If the frontend makes a typo (like `fistName` instead of `firstName`), `whitelist: true` drops it silently with no error.  
3. `forbidNonWhitelisted: true` immediately rejects the request with a `400 Bad Request` saying `"property role should not exist"`.

---

### 3. Document Protection & IDOR

**Q: What is the risk of serving the entire `uploads/` folder with `ServeStaticModule`?**  
**A:**  
Static files bypass all authentication and guards. Anyone on the internet with a file URL can download private provider documents (like PAN cards or Aadhaar cards) without logging in.

**Q: What is IDOR (Insecure Direct Object Reference)?**  
**A:**  
When an authenticated user requests a resource using its ID (like `/documents/:id/file`), and the server forgets to check if that user actually owns the file.

**Q: How do we fix IDOR for provider documents?**  
**A:**  
In the service layer, check two things before sending the file:  
1. Is the user an `ADMIN`? (Allowed).  
2. Is the user the provider who owns the document? (`document.provider.userId === req.user.id`).  
If neither, reject with `403 Forbidden`.

---

### 4. Database Error Leaks & Timeouts

**Q: Why shouldn't we show raw database errors in production?**  
**A:**  
They reveal table names, column names, constraint names, and SQL fragments to attackers.

**Q: What is the clean way to handle errors in production?**  
**A:**  
Return a friendly generic message (e.g., `"A duplicate record already exists."`) together with a `requestId`. Log the full SQL error internally under that same `requestId` so developers can inspect it.

**Q: Why do we need a 30-second `TimeoutInterceptor`?**  
**A:**  
If an external API or database hangs, open connections hold onto server memory and socket descriptors. A timeout cuts off stuck requests and frees resources.

**Q: What does `app.enableShutdownHooks()` do?**  
**A:**  
When the app restarts or redeploys, it lets active requests finish, cleanly closes database connections, and disconnects Redis instead of crashing mid-request.

---

## Day 7: CI Pipeline & Release Readiness

### 1. CI Pipeline Architecture

**Q: What are GitHub Actions "Service Containers"?**  
**A:**  
They are real Docker containers (like PostgreSQL and Redis) spun up automatically inside the CI workflow runner. Node.js tests talk directly to them on `localhost:5432` and `localhost:6379` during the test run.

**Q: Why does a clean PostgreSQL database in CI need the `btree_gist` extension?**  
**A:**  
PostgreSQL cannot create GiST exclusion constraints on standard columns (like timestamp ranges and UUIDs) without `btree_gist`. Without it, the booking overlap prevention migration will crash.

**Q: Why MUST database integration tests run with `--runInBand` in CI?**  
**A:**  
By default, Jest runs test files in parallel. If two concurrency tests run at the same millisecond against the same database, they will truncate each other's tables or cause deadlocks. `--runInBand` forces Jest to run test suites sequentially, ensuring 100% reliable, deterministic test passes.

**Q: Why can tests pass locally with Prisma but fail in CI with `invalid input value for enum`?**  
**A:**  
Because new enum values were added to `schema.prisma` and applied locally via `prisma db push` or manual alteration, but no Prisma migration file was created. In CI, `prisma migrate deploy` executes only checked-in migration scripts. If a migration is missing, the clean database never gets the new enum values, causing runtime errors when queries insert them.

---

## Week 10 - Day 1: Dockerize the NestJS Application

### 1. Multi-Stage Docker Builds

**Q: What is a Multi-Stage Docker build, and why do we use it?**  
**A:**  
A multi-stage build uses two or more `FROM` statements:
1. **Builder stage:** Installs TypeScript and build tools (`npm ci`), compiles the code (`npm run build`), and generates the Prisma client.
2. **Runner stage:** Starts with a fresh, tiny Linux Alpine image and copies *only* the compiled JavaScript (`dist/`), production `node_modules`, and Prisma client.  
It cuts image size from ~1.2 GB down to under 100 MB and keeps dev tools out of production.

**Q: Why do we run `npm prune --omit=dev` before copying node_modules to the runner?**  
**A:**  
It removes all TypeScript, Jest, ESLint, and CLI development libraries from `node_modules`, ensuring only runtime dependencies are copied into the production container.

---

### 2. Security & Layer Caching

**Q: Why shouldn't a container run as `root` user?**  
**A:**  
If a hacker exploits a vulnerability in an npm package or API endpoint, running as `root` gives them full administrator privileges inside the container. Switching to unprivileged `USER node` restricts what the attacker can execute.

**Q: Why do we copy `package*.json` and `tsconfig*.json` before copying `src/`?**  
**A:**  
Docker caches layers from top to bottom. If you edit a TypeScript file in `src/`, Docker re-uses the cached `npm ci` layer instead of downloading hundreds of megabytes of npm packages again.

**Q: Why must `@prisma/client` be in `dependencies` instead of `devDependencies`?**  
**A:**  
Because the compiled NestJS application calls `@prisma/client` at runtime to query the database. If it is in `devDependencies`, `npm prune --omit=dev` will delete it, causing `Cannot find module '@prisma/client'` crashes when the container boots.

---

## Week 10 - Day 2: Docker Compose Multi-Service Architecture

### 1. Multi-Service Process Separation

**Q: Why run the API and BullMQ worker in separate containers if they share the same Docker image?**  
**A:**  
The API handles user-facing HTTP requests and must stay responsive. The worker processes asynchronous background jobs (emails, reminders, booking expiration). Running them in separate containers ensures CPU or memory spikes in the background worker never starve or crash the API.

**Q: Why do services communicate using Compose service names (`postgres`, `redis`) instead of `localhost`?**  
**A:**  
Each Docker container has its own isolated network namespace and loopback address. `localhost` inside a container points only to itself. Docker Compose creates a private bridge network with internal DNS, so containers resolve each other using their service names (`postgres:5432`, `redis:6379`).

---

### 2. Application Readiness & Health Checks

**Q: Why is `depends_on` alone not enough to guarantee application readiness?**  
**A:**  
By default, `depends_on` only checks if the dependency container has *started*. A PostgreSQL or Redis container takes several seconds to initialize files and listen for connections. Using `depends_on` with `condition: service_healthy` ensures dependent containers only start once the database and Redis pass their healthcheck probes (`pg_isready` and `redis-cli ping`).

**Q: Why run database migrations in a dedicated one-shot container before starting the API and worker?**  
**A:**  
If multiple API or worker containers start simultaneously and attempt to run `prisma migrate deploy`, they risk deadlocking or corrupting schema state. A dedicated `migration` container runs migrations once to completion (`condition: service_completed_successfully`), ensuring schema changes are applied before any application process queries the database.

---

### 3. Volume Persistence & Port Exposure

**Q: What is the difference between `docker compose down` and `docker compose down -v`?**  
**A:**  
`docker compose down` stops and deletes containers and the network, but leaves named volumes (`servicehub_postgres_data`) intact so your database records persist. Adding the `-v` flag deletes the volumes as well, completely wiping all stored database data.

**Q: Why should only necessary ports be exposed to the host machine?**  
**A:**  
Exposing ports on `0.0.0.0` opens attack surfaces and risks port conflicts with local daemons (such as a local PostgreSQL server already running on port 5432). Internal-only services like the BullMQ worker do not listen for incoming connections and should expose zero host ports. Database services can map to alternative host ports (e.g., `5433:5432`) for administrative debugging without colliding with host services.

---

## Week 10 - Day 3: Configuration & Database Migrations

### 1. Environment Validation

**Q: Why must environment variables be validated with a strict schema during bootstrap?**  
**A:**  
Without validation, a missing variable (like `DATABASE_URL` or `JWT_SECRET`) causes obscure runtime crashes minutes or hours after startup when a user hits an endpoint. A strict schema fails fast during bootstrap, printing an explicit list of missing or invalid variables and preventing the app from starting in a broken state.

**Q: Why should security-sensitive secrets never have hardcoded default fallbacks?**  
**A:**  
If secrets fallback to defaults like `?? "defaultSecret"`, a misconfigured production deployment will run with known, public encryption keys. Attackers could forge JWT tokens and gain admin privileges. Secrets must be strictly required from the environment with zero fallback.

---

### 2. Controlled Database Migrations

**Q: Why must migrations NOT run independently from every API and worker replica on startup?**  
**A:**  
In production, you often run 3 or 10 replicas of the API and worker. If all replicas attempt to run `prisma migrate deploy` simultaneously on boot, they will race, deadlock on database locks, or corrupt the `_prisma_migrations` table. Migrations must run as a single, isolated pre-deployment step (a one-shot release phase or migration container) before new application replicas start.

---

### 3. Zero-Downtime & Backward-Compatible Migrations

**Q: What is the Expand/Contract pattern for zero-downtime database migrations?**  
**A:**  
It is a 3-step strategy to change database schemas without taking down the application:
1. **Expand (Add first):** Add the new column/table as nullable or with a default value. Old application replicas continue working without interruption.
2. **Deploy Code:** Deploy the new application code that writes to the new structure.
3. **Contract (Remove later):** Once all old code versions are gone and all records are backfilled, apply a final migration to drop old columns or add `NOT NULL` constraints.

**Q: How do you safely test database migrations and upgrades before releasing to production?**  
**A:**  
1. **Fresh Database Test:** Apply all migrations to an empty database to confirm clean table creation, index generation, and extension setup (`btree_gist`).
2. **Existing Data Upgrade Test:** Seed existing production-like rows, apply schema updates, and assert that 100% of existing rows remain intact and queries return expected data.

---

## Week 10 - Day 4: Production Build & Image Publishing

### 1. Registries & Image Versioning

**Q: What is a Container Registry (e.g. GitHub Container Registry / GHCR)?**  
**A:**  
A container registry is a centralized, secure storage service for built Docker images (just as GitHub stores source code and npm stores packages). It allows servers in any environment (staging, production, cloud) to pull and run exact application images without needing source code, compilers, or local dependencies.

**Q: Why is tagging images with `latest` alone a dangerous production anti-pattern?**  
**A:**  
`latest` is mutable (it gets overwritten on every new build). If a bad build breaks production, you cannot easily identify what code is running or rollback to the previous version because the previous `latest` image was replaced.

**Q: How do immutable version tags (commit SHAs) solve the rollback problem?**  
**A:**  
Tagging images with the git commit SHA (e.g., `servicehub:241a15e`) creates a permanent, immutable snapshot tied to the exact source code. If a release fails in production, you can instantly rollback by pointing your deployment back to the previous known-good commit SHA tag.

---

### 2. Container Verification & Security

**Q: What is a "Container Smoke Test" in a CI pipeline, and why is `docker build` alone not enough?**  
**A:**  
`docker build` only verifies that files were copied and compilation succeeded; it does NOT verify that the app can actually boot and run. A smoke test starts the built container in CI and curls its health endpoint (`/health/ready`). It proves that:
1. Node.js starts without missing runtime dependencies.
2. The database connection (Prisma) works.
3. The cache/queue connection (Redis) works.
4. The background worker process can boot.

**Q: Why should Pull Requests build and smoke test images, but never publish them to the registry?**  
**A:**  
Pull requests represent unmerged, potentially unapproved, or untested code changes. CI should build and smoke-test the image on PRs to verify the build will succeed, but only official merges into `master`/`main` should publish images to the production container registry.

---

## Week 10 - Day 5: Deploy to a Public Environment

### 1. Networking & Private Cloud Security

**Q: Why must production backend containers use an Internal Database URL instead of an External Database URL?**  
**A:**  
An external URL routes traffic across the public internet, adding network latency, risking connection dropouts, incurring bandwidth egress charges, and exposing the database port to automated internet scanners. An internal URL connects over the provider's private virtual network (VPC) with sub-millisecond latency, zero egress cost, and total isolation from public internet attacks.

**Q: Where should database migrations run in a managed container platform like Render?**  
**A:**  
They must run in a dedicated `preDeployCommand` (release phase). This spins up a single temporary container to run `npx prisma migrate deploy` before any new API or worker container starts. If the migration succeeds, new containers roll out; if it fails, the release aborts immediately without taking down the existing production system.

---

## Week 10 - Day 6: CI/CD, Deployment Safety & Rollbacks

### 1. Post-Deployment Smoke Testing

**Q: Why are post-deploy smoke tests necessary if tests already passed in CI?**  
**A:**  
CI tests run inside isolated runner containers against localhost mocks and test secrets. A post-deploy smoke test executes against the actual production environment, verifying that real DNS resolution, SSL/TLS certificates, CORS headers, platform environment variables, and VPC database network paths are functioning correctly from an external user's perspective.

**Q: What safety rules must post-deployment smoke tests follow?**  
**A:**  
1. Never trigger real financial transactions (e.g. Razorpay capture).
2. Never send actual notifications or emails to real customer contact addresses.
3. Clean up any temporary smoke test data (e.g. test accounts) to avoid polluting production analytics.

---

### 2. Zero-Downtime Rollbacks

**Q: Why should you almost never rollback database migrations during an emergency application rollback?**  
**A:**  
Rolling back a database migration (e.g., dropping columns or restoring a snapshot from hours ago) causes permanent data loss for any users who signed up or transacted since the deployment, locks active database tables, and causes immediate downtime. If migrations follow the backward-compatible Expand/Contract pattern, the previous application version will run safely with the expanded schema without altering the database.





