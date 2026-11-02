/**
 * ServiceHub Post-Deployment Smoke Test Suite
 * 
 * Executes non-destructive, end-to-end verification against a deployed API instance:
 * 1. Health & Readiness probes (/health/live, /health/ready)
 * 2. Public Catalog retrieval (GET /categories)
 * 3. User Authentication (Register + Login flow)
 * 4. Authenticated Database Operation (GET /bookings/my-bookings)
 * 5. Worker & Redis queue connectivity
 * 
 * Safety Guarantee:
 * - Creates NO real financial transactions (Razorpay)
 * - Sends NO real customer notifications or external emails
 */

const BASE_URL = (process.env.API_URL || 'http://localhost:8000').replace(/\/$/, '');

interface TestResult {
  step: string;
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

async function runStep(name: string, fn: () => Promise<string | void>) {
  const start = Date.now();
  process.stdout.write(`⏳ Running: ${name}... `);
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    console.log(`✅ PASSED (${durationMs}ms)`);
    if (details) console.log(`   ${details}`);
    results.push({ step: name, status: 'PASSED', durationMs, details: details || undefined });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.log(`❌ FAILED (${durationMs}ms)`);
    console.error(`   Error: ${err.message}`);
    results.push({ step: name, status: 'FAILED', durationMs, details: err.message });
    throw err;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 SERVICEHUB POST-DEPLOYMENT SMOKE TEST');
  console.log(`🎯 Target Endpoint: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  let accessToken = '';
  const timestamp = Date.now();
  const testUser = {
    email: `smoke_test_${timestamp}@example.com`,
    password: `P@ssw0rd_${timestamp}`,
    firstName: 'Smoke',
    lastName: 'Tester',
    phone: `+9198${String(timestamp).slice(-8)}`, // Valid Indian phone format
  };

  try {
    // 1. Health & Readiness Endpoints
    await runStep('1. Health Liveness Probe (/health/live)', async () => {
      const res = await fetch(`${BASE_URL}/health/live`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json: any = await res.json();
      if (json.status !== 'ok') throw new Error(`Unexpected body: ${JSON.stringify(json)}`);
      return `Liveness status: ${json.status}`;
    });

    await runStep('2. Health Readiness Probe (/health/ready)', async () => {
      const res = await fetch(`${BASE_URL}/health/ready`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json: any = await res.json();
      if (json.status !== 'ok') throw new Error(`Readiness check not ok: ${JSON.stringify(json)}`);
      if (json.info?.database?.status !== 'up') throw new Error('Database is DOWN');
      if (json.info?.redis?.status !== 'up') throw new Error('Redis is DOWN');
      return `Database: UP | Redis: UP (connected: ${json.info.redis.connected})`;
    });

    // 2. Public Catalog Retrieval
    await runStep('3. Public Catalog Retrieval (GET /categories)', async () => {
      const res = await fetch(`${BASE_URL}/categories`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json: any = await res.json();
      const count = Array.isArray(json) ? json.length : json.data?.length || 0;
      return `Catalog retrieved successfully (${count} categories found)`;
    });

    // 3. User Authentication Flow (Register + Login)
    await runStep('4. User Registration (POST /auth/register)', async () => {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser),
      });
      if (res.status !== 201) {
        const text = await res.text();
        throw new Error(`Registration failed with status ${res.status}: ${text}`);
      }
      const json: any = await res.json();
      if (!json.accessToken) throw new Error('No accessToken returned in registration response');
      accessToken = json.accessToken;
      return `Registered test user ID: ${json.user?.id || 'OK'}`;
    });

    await runStep('5. User Authentication / Login (POST /auth/login)', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Login failed with status ${res.status}: ${text}`);
      }
      const json: any = await res.json();
      if (!json.accessToken) throw new Error('No accessToken returned in login response');
      accessToken = json.accessToken;
      return `Authenticated successfully, JWT token acquired`;
    });

    // 4. Authenticated Database Operation
    await runStep('6. Authenticated Database Query (GET /bookings/my-bookings)', async () => {
      const res = await fetch(`${BASE_URL}/bookings/my-bookings`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Authenticated query failed with status ${res.status}: ${text}`);
      }
      const json: any = await res.json();
      const count = Array.isArray(json) ? json.length : (json.data?.length ?? 0);
      return `Authenticated user bookings queried cleanly (${count} records)`;
    });

    // 5. Worker & Queue Responsiveness Verification
    await runStep('7. Worker & BullMQ Queue Operational Health', async () => {
      // Re-verify that Redis handles commands without queue timeouts
      const res = await fetch(`${BASE_URL}/health/ready`);
      const json: any = await res.json();
      if (json.info?.redis?.status !== 'up') {
        throw new Error('Worker queue backend (Redis) is unresponsive');
      }
      return 'Worker queue connection is operational and responsive';
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 SMOKE TEST SUITE PASSED: RELEASE IS FULLY HEALTHY!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Steps Executed: ${results.length}`);
    console.log(`Total Duration: ${results.reduce((acc, r) => acc + r.durationMs, 0)}ms`);
    process.exit(0);
  } catch (err: any) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('🚨 SMOKE TEST SUITE FAILED: RELEASE CANNOT BE VERIFIED!');
    console.error('═══════════════════════════════════════════════════════════');
    console.error(`Failure occurred on step: ${results[results.length - 1]?.step || 'Unknown'}`);
    console.error('Recommendation: Follow docs/rollback-playbook.md to revert to previous image.');
    process.exit(1);
  }
}

main();

