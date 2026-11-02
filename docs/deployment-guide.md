# Public Deployment Guide (Render.com / Managed Platform)

This guide documents the end-to-end procedure for deploying ServiceHub to a production environment using the `render.yaml` Infrastructure-as-Code Blueprint.

---

## 1. Production Architecture Overview

| Component | Platform Service | Scaling / Network Scope |
| :--- | :--- | :--- |
| **NestJS API** | Web Service (`servicehub-api`) | Public HTTPS (`*.onrender.com`), TLS 1.3, auto-healthchecked on `/health/ready` |
| **BullMQ Worker** | Background Worker (`servicehub-worker`) | Private compute (no open ports), runs `node dist/src/worker.js` |
| **PostgreSQL** | Managed PostgreSQL 16 (`servicehub-postgres`) | Private VPC, `ipAllowList: []` (zero public access) |
| **Redis** | Managed Redis 7 (`servicehub-redis`) | Private VPC, `ipAllowList: []` (zero public access) |

---

## 2. One-Click Blueprint Deployment Procedure

### Step 1: Create an Account on Render
1. Go to [https://render.com](https://render.com) and sign in using your **GitHub account (`NaimShk07`)**.

### Step 2: Deploy the Blueprint
1. In the Render Dashboard, click **New +** in the top-right corner.
2. Select **Blueprint**.
3. Select your repository: **`NaimShk07/Service-hub`** (grant Render repository access if prompted).
4. Branch: **`master`**.
5. Render will detect [`render.yaml`](../render.yaml) and show you a preview of the 4 services:
   - `servicehub-postgres` (Database)
   - `servicehub-redis` (Redis)
   - `servicehub-api` (Web API)
   - `servicehub-worker` (Background Worker)
6. Click **Apply**.

---

## 3. What Happens Automatically During Deployment

1. **Database & Redis Creation:**
   - Render provisions PostgreSQL 16 and Redis 7 within a private virtual network.
   - Credentials and connection strings are securely and automatically wired between services.

2. **Automated Secret Generation:**
   - `JWT_SECRET` and `JWT_REFRESH_SECRET` are automatically generated as cryptographically secure 256-bit random tokens.
   - They are shared automatically between `servicehub-api` and `servicehub-worker`.

3. **Pre-Deploy Migration Phase:**
   - Render runs `preDeployCommand: npx prisma migrate deploy`.
   - All 10 migrations are applied to `servicehub-postgres` before any user traffic begins.

4. **Health Probe & Zero-Downtime Traffic Routing:**
   - Render boots the API container and polls `http://localhost:8000/health/ready`.
   - Once both `database: up` and `redis: up` return HTTP 200, Render provisions the free SSL certificate and routes public HTTPS traffic to `https://servicehub-api.onrender.com`.

---

## 4. Setting Third-Party Secrets (Razorpay & Email)

In the Render Dashboard:
1. Navigate to **servicehub-api** ➔ **Environment**.
2. Add your production third-party keys:
   - `RAZORPAY_KEY_ID`: `rzp_live_...`
   - `RAZORPAY_SECRET`: `...`
   - `RAZORPAY_WEBHOOK_SECRET`: `...`
3. Click **Save Changes** (Render will trigger a zero-downtime rolling restart).

---

## 5. Verification Checklist

Once deployed, verify public reachability and service health:

```bash
# 1. Test live probe
curl -I https://servicehub-api.onrender.com/health/live
# Expected: HTTP/2 200 OK

# 2. Test full readiness probe (Postgres + Redis)
curl -s https://servicehub-api.onrender.com/health/ready
# Expected: {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up","connected":true}}}

# 3. Test Swagger API documentation (if enabled)
https://servicehub-api.onrender.com/api/docs
```

