import { Client } from "pg";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import { URL } from "url";

dotenv.config();

const BASE_URL = process.env.DATABASE_URL;
if (!BASE_URL) {
  console.error("❌ DATABASE_URL is not defined in environment.");
  process.exit(1);
}

const TEST_DB_NAME = "servicehub_lifecycle_test";

function getDatabaseUrl(dbName: string): string {
  const parsed = new URL(BASE_URL!);
  parsed.pathname = `/${dbName}`;
  parsed.searchParams.set("schema", "public");
  return parsed.toString();
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🛠️  WEEK 10 DAY 3: DATABASE MIGRATION & UPGRADE LIFECYCLE");
  console.log("═══════════════════════════════════════════════════════════\n");

  const maintenanceUrl = getDatabaseUrl("postgres");
  const maintenanceClient = new Client({ connectionString: maintenanceUrl });

  try {
    await maintenanceClient.connect();
    console.log("1️⃣  Preparing fresh test database...");

    // Terminate existing connections and drop if exists
    await maintenanceClient.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid();
    `);
    await maintenanceClient.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);
    await maintenanceClient.query(`CREATE DATABASE ${TEST_DB_NAME};`);
    console.log(`   ✅ Fresh database "${TEST_DB_NAME}" created successfully.`);

    // Enable btree_gist extension (required for booking exclusion constraints)
    const testDbUrl = getDatabaseUrl(TEST_DB_NAME);
    const testDbClient = new Client({ connectionString: testDbUrl });
    await testDbClient.connect();
    await testDbClient.query(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
    console.log("   ✅ Extension 'btree_gist' enabled.\n");

    // 2. Test Prisma migrations against fresh database
    console.log("2️⃣  Applying Prisma migrations to fresh database (Task 4)...");
    execSync(`DATABASE_URL="${testDbUrl}" npx prisma migrate deploy`, {
      stdio: "inherit",
    });

    const statusOutput = execSync(
      `DATABASE_URL="${testDbUrl}" npx prisma migrate status`,
      { encoding: "utf-8" },
    );
    console.log("   📊 Migration Status Output:");
    console.log(
      statusOutput
        .split("\n")
        .map((l) => `      ${l}`)
        .join("\n"),
    );

    const tablesRes = await testDbClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tableNames = tablesRes.rows.map((r) => r.table_name);
    console.log(`   ✅ Created ${tableNames.length} tables in fresh database:`, tableNames.join(", "));
    if (!tableNames.includes("users") || !tableNames.includes("bookings")) {
      throw new Error("Core tables missing after fresh migration.");
    }

    // 3. Populate existing data
    console.log("\n3️⃣  Populating existing production-like data...");
    const userInsert = await testDbClient.query(`
      INSERT INTO "users" (id, email, "passwordHash", "firstName", "lastName", phone, role, status, "createdAt", "updatedAt")
      VALUES 
        ('00000000-0000-0000-0000-000000000001', 'existing_customer@test.com', 'hashed_pw', 'Alice', 'Smith', '+10000000001', 'USER', 'ACTIVE', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000002', 'existing_provider@test.com', 'hashed_pw', 'Bob', 'Jones', '+10000000002', 'USER', 'ACTIVE', NOW(), NOW())
      RETURNING id, email;
    `);
    console.log(`   ✅ Inserted ${userInsert.rowCount} existing users.`);

    // 4. Test upgrading database containing existing data
    console.log("\n4️⃣  Testing schema upgrade on database containing existing data (Task 5)...");
    console.log("   Applying backward-compatible schema upgrade (Expand pattern)...");
    await testDbClient.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "preferences" JSONB DEFAULT '{"theme":"light","notifications":true}' NOT NULL;
    `);

    // Verify migrations remain repeatable and idempotent
    execSync(`DATABASE_URL="${testDbUrl}" npx prisma migrate deploy`, {
      stdio: "inherit",
    });

    // 5. Verify existing data integrity
    console.log("\n5️⃣  Verifying data integrity after upgrade...");
    const usersAfterUpgrade = await testDbClient.query(`
      SELECT id, email, "firstName", preferences
      FROM "users"
      ORDER BY id;
    `);

    console.log(`   ✅ Found ${usersAfterUpgrade.rowCount} existing records intact:`);
    for (const user of usersAfterUpgrade.rows) {
      console.log(`      - ${user.email} (${user.firstName}): preferences = ${JSON.stringify(user.preferences)}`);
    }

    if (usersAfterUpgrade.rowCount !== 2) {
      throw new Error("Data loss detected after migration/upgrade!");
    }

    await testDbClient.end();
    console.log("\n6️⃣  Cleaning up test database...");
    await maintenanceClient.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid();
    `);
    await maintenanceClient.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);
    console.log("   ✅ Temporary database dropped.\n");

    console.log("═══════════════════════════════════════════════════════════");
    console.log("🎉 SUCCESS: DATABASE MIGRATION & UPGRADE LIFECYCLE VERIFIED!");
    console.log("═══════════════════════════════════════════════════════════");
  } catch (err: any) {
    console.error("❌ Migration lifecycle verification failed:", err.message);
    try {
      await maintenanceClient.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);
    } catch {}
    process.exit(1);
  } finally {
    await maintenanceClient.end();
  }
}

main();
