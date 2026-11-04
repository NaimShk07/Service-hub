# PostgreSQL Backup, Restoration & Disaster Recovery Runbook

This runbook defines the official backup policies, verification routines, and disaster recovery procedures for ServiceHub's PostgreSQL database.

---

## 1. Recovery Objectives (RPO & RTO)

| Metric | Target | Definition |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 1 hour** (Managed PITR) / **< 24 hours** (Daily snapshots) | Maximum acceptable data loss period in a catastrophic disaster. |
| **RTO (Recovery Time Objective)** | **< 30 minutes** | Maximum acceptable downtime to restore and verify a healthy database. |

---

## 2. Managed PostgreSQL Backups (Render.com / Cloud Provider)

When deploying on managed platforms (Render, AWS RDS, DigitalOcean):
- **Automated Daily Backups:** Managed PostgreSQL takes daily full logical and snapshot backups automatically.
- **Point-in-Time Recovery (PITR):** On production plans, Write-Ahead Logs (WAL) are streamed continuously, enabling restoration to any specific minute within the retention window (e.g., *“Restore to 10:14 AM right before an errant script ran”*).
- **Retention Schedule:**
  - Starter / Staging: 7-day retention.
  - Production: 30-day retention with off-site replication.

---

## 3. Manual Backup Procedure (`pg_dump`)

To take an immediate pre-maintenance or pre-migration snapshot:

```bash
# Export compressed custom-format binary dump
pg_dump -h <DB_HOST> -p 5432 -U <DB_USER> -d servicehub \
  -F c -b -v -f "servicehub_backup_$(date +%Y%m%d_%H%M%S).dump"

# Or as encrypted plain SQL:
pg_dump -h <DB_HOST> -p 5432 -U <DB_USER> -d servicehub \
  --clean --if-exists > "servicehub_backup_$(date +%Y%m%d_%H%M%S).sql"
```

---

## 4. Disaster Recovery & Restoration Procedure (`pg_restore`)

If a database must be restored from a `.dump` snapshot to a fresh database:

### Step 1: Create a Clean Target Database
```bash
createdb -h <DB_HOST> -p 5432 -U <DB_USER> servicehub_restored
```

### Step 2: Ensure Required Extensions Exist
```sql
-- Connect to the target database and enable required extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

### Step 3: Execute `pg_restore`
```bash
pg_restore -h <DB_HOST> -p 5432 -U <DB_USER> -d servicehub_restored \
  --verbose --clean --if-exists --no-owner --no-acl "servicehub_backup_<timestamp>.dump"
```

### Step 4: Verify Data Integrity Post-Restoration
Run quick sanity queries to ensure critical tables and rows were restored:
```sql
SELECT 'users' AS tbl, count(*) FROM users
UNION ALL
SELECT 'bookings', count(*) FROM bookings
UNION ALL
SELECT 'payments', count(*) FROM payments;
```

---

## 5. BullMQ & Redis Persistence Policy

> [!IMPORTANT]
> **Redis Cache vs. Queue Data:**
> ServiceHub uses Redis for two distinct purposes:
> 1. Cache (ephemeral query results)
> 2. BullMQ Queues (business-critical notifications, booking expiry, reminders)

### Redis Configuration Rules for BullMQ:
1. **Persistence:** Enable **AOF (Append-Only File)** with `appendfsync everysec` so job writes are flushed to disk every second.
2. **Eviction Policy:** Configure `maxmemory-policy: noeviction`. If memory fills up, Redis returns an error rather than silently deleting pending jobs or timers.

