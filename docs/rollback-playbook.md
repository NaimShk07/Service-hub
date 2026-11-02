# Production Rollback Playbook & Disaster Recovery

This playbook defines the exact procedure to safely revert a failed production release in under 60 seconds without data loss.

---

## 1. When to Trigger an Immediate Rollback

Trigger a rollback immediately if any of the following occur within 15 minutes of release:
- **Smoke Test Failure:** The automated post-deployment smoke test (`npm run test:smoke:post-deploy`) fails.
- **Health Check Failure:** `/health/ready` returns 503 or fails to respond for > 60 seconds.
- **5xx Error Rate Spike:** Customer API requests exceed a 1% error rate on core endpoints.
- **Database Lock Contention:** Multiple deadlocks reported on transactions.
- **Worker Hang:** Background queues stop processing jobs.

---

## 2. The 60-Second Rollback Procedure

### Route A: Managed Platform (Render.com)

1. Open the [Render Dashboard](https://dashboard.render.com).
2. Navigate to **`servicehub-api`** ➔ **Deploys** tab.
3. Locate the **previous successful deployment** (marked with a green checkmark).
4. Click the three dots (`...`) next to that deploy and select **"Rollback to this deploy"**.
5. Render immediately starts routing traffic to the previous Docker container image.
6. Navigate to **`servicehub-worker`** and repeat the rollback step so the background worker runs the matching image version.
7. Total time to recover: **< 45 seconds**.

---

### Route B: Container Registry / Docker (GHCR)

If deploying via Docker Compose or a standalone server:

1. Identify the previous known-good commit SHA from your Git history or GHCR packages (e.g., `37fa02e`).
2. Update the image reference in your deployment environment:
   ```bash
   export IMAGE_TAG=37fa02e
   docker compose pull api worker
   docker compose up -d --no-deps api worker
   ```
3. Verify the prior version is healthy:
   ```bash
   curl -s http://localhost:8000/health/ready
   ```

---

## 3. Database Posture During Rollback: CRITICAL RULES

> [!CAUTION]
> **DO NOT ROLLBACK THE DATABASE SCHEMA OR DROP COLUMNS DURING AN EMERGENCY ROLLBACK.**

### Why You MUST NOT Run `prisma migrate down` or Drop Columns:
1. **Permanent Data Loss:** If the new release was live for even 5 minutes, real customers may have signed up or placed orders. Dropping columns or restoring a database snapshot from 2 hours ago permanently erases those real customer records.
2. **Table Locking Outages:** Running destructive `ALTER TABLE DROP COLUMN` queries on production tables acquires exclusive table locks, freezing all customer requests.
3. **The Expand / Contract Safety Net:** Because all ServiceHub migrations follow the **Expand / Contract pattern** (Day 3), new columns are always nullable or have default values. The previous application code version will ignore unknown columns and execute without errors against the expanded schema!

### Correct Action:
- Revert **ONLY** the application Docker image.
- Leave the database schema alone.
- Investigate the bug offline, write a fix, and deploy a forward release.

---

## 4. Post-Rollback Incident Protocol

1. **Verify Stability:** Run the post-deploy smoke test to confirm the restored version is green:
   ```bash
   npm run test:smoke:post-deploy
   ```
2. **Collect Incident Artifacts:** Export application logs from the failed deployment window:
   ```bash
   # Render: Logs tab ➔ Download Logs
   # Docker: docker logs <failed_container_id> > incident_logs.txt
   ```
3. **Post-Mortem & Forward Fix:**
   - Reproduce the failure locally or in staging using the incident logs.
   - Fix the bug in code.
   - Merge to `master` to trigger CI, rebuild the image, and ship a new release.

