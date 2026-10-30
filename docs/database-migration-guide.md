# Database Setup, Migration & Upgrade Guide

This guide establishes the standardized, repeatable procedure for setting up, migrating, and upgrading ServiceHub's PostgreSQL database in local development, CI/CD, and production environments.

---

## 1. Architecture Rules

1. **Separation of Startup and Migrations:**
   - Application containers (`api`, `worker`) **MUST NEVER** execute database migrations at startup.
   - Migrations are run once as a dedicated, controlled pre-deployment step (e.g., Docker Compose `migration` service or CI/CD release phase).
2. **Strict Environment Validation:**
   - All environments must pass strict schema validation (`src/config/env.validation.ts`).
   - If `DATABASE_URL` or `JWT_SECRET` is missing, the application fails immediately during bootstrap with an explicit error list.
3. **Backward-Compatible Schema Changes:**
   - Production migrations follow the **Expand / Contract** pattern to guarantee zero-downtime deployments.

---

## 2. Standardized NPM Commands

| Command | Purpose |
| :--- | :--- |
| `npm run prisma:generate` | Generates the strongly-typed Prisma Client into `generated/prisma`. |
| `npm run db:migrate:deploy` | Applies all pending migrations to the target database without prompting. |
| `npm run db:migrate:status` | Inspects migration state, checking for pending or unapplied migrations. |
| `npm run db:migrate:dev` | Local development only: creates and applies a new migration from `schema.prisma`. |
| `npm run db:seed` | Seeds initial reference data (admin accounts, service categories). |
| `npm run test:db:lifecycle` | Automated test verifying fresh DB deployment and backward-compatible data upgrade. |

---

## 3. Fresh Database Setup Procedure

Follow these steps when provisioning a new environment (e.g., staging, new developer machine):

1. **Prepare Environment File:**
   ```bash
   cp .env.example .env
   # Edit .env with target database credentials and secure random JWT secrets
   ```

2. **Verify PostgreSQL Extensions:**
   The `btree_gist` extension is mandatory for booking GiST exclusion constraints:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```

3. **Deploy Migrations:**
   ```bash
   npm run db:migrate:deploy
   ```

4. **Verify Schema Status:**
   ```bash
   npm run db:migrate:status
   ```
   *Expected output:* `Database schema is up to date!`

5. **Seed Reference Data:**
   ```bash
   npm run db:seed
   ```

---

## 4. Production Database Upgrade Procedure (Zero-Downtime)

To upgrade a database containing existing production data without downtime, follow the 3-phase **Expand / Contract** workflow:

```
  Phase 1 (Expand)        Phase 2 (Deploy)          Phase 3 (Contract)
┌──────────────────┐    ┌──────────────────┐      ┌──────────────────┐
│ Add new nullable │ ──>│ Deploy new code  │ ────>│ Drop old column/ │
│ columns/tables   │    │ reading/writing  │      │ backfill data    │
│ (Old code works) │    │ to new structure │      │ (Clean state)    │
└──────────────────┘    └──────────────────┘      └──────────────────┘
```

### Phase 1: Expand (Backward-Compatible Schema Change)
- Never rename a column directly or add a `NOT NULL` column without a default value.
- Add new columns as **nullable** or provide a safe **`DEFAULT`** value.
- Run `npm run db:migrate:deploy`.
- *Result:* Existing running application replicas continue to execute without errors.

### Phase 2: Deploy Compatible Application Code
- Deploy updated API and worker code that reads and writes using the new column/schema.
- Old and new code replicas can run concurrently during rolling deployment.

### Phase 3: Contract (Cleanup)
- Once 100% of traffic is on the new application version and data has been backfilled:
- Create a subsequent migration to remove obsolete columns or enforce strict `NOT NULL` constraints.
- Run `npm run db:migrate:deploy`.

---

## 5. Automated Verification Test

ServiceHub includes an automated lifecycle test that simulates both a fresh database setup and a schema upgrade over existing rows:

```bash
npm run test:db:lifecycle
```

This script:
1. Spins up an isolated test database `servicehub_lifecycle_test`.
2. Enables `btree_gist` and executes all migrations from scratch.
3. Inserts production-like records (`users`).
4. Executes a schema upgrade (`ALTER TABLE ... ADD COLUMN ... DEFAULT`).
5. Verifies data integrity (zero data loss across existing rows).
6. Cleans up and drops the test database.

