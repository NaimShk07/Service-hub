#!/usr/bin/env bash
set -e

echo "═══════════════════════════════════════════════════════════"
echo "🐳 SERVICEHUB DOCKER IMAGE SMOKE TEST"
echo "═══════════════════════════════════════════════════════════"

IMAGE_TAG="${1:-servicehub-app:latest}"

echo "1️⃣  Building Docker image ($IMAGE_TAG)..."
docker build -t "$IMAGE_TAG" .

echo "2️⃣  Verifying devDependencies exclusion..."
docker run --rm "$IMAGE_TAG" node -e "
  try {
    require('typescript');
    console.error('❌ Security failure: devDependency typescript is present in production image');
    process.exit(1);
  } catch (err) {
    console.log('   ✅ Confirmed: devDependencies are excluded from runner image');
  }
"

echo "3️⃣  Checking Prisma Client runtime availability..."
docker run --rm "$IMAGE_TAG" node -e "
  try {
    require('./generated/prisma');
    console.log('   ✅ Confirmed: Prisma client runtime is loaded and accessible');
  } catch (err) {
    console.error('❌ Failed to load Prisma client:', err.message);
    process.exit(1);
  }
"

echo "4️⃣  Checking Worker entrypoint availability..."
docker run --rm "$IMAGE_TAG" node -e "
  const fs = require('fs');
  if (fs.existsSync('./dist/src/worker.js')) {
    console.log('   ✅ Confirmed: Worker entrypoint (dist/src/worker.js) exists');
  } else {
    console.error('❌ Worker entrypoint missing');
    process.exit(1);
  }
"

echo "═══════════════════════════════════════════════════════════"
echo "🎉 SUCCESS: DOCKER IMAGE PASSED LOCAL SMOKE CHECKS!"
echo "═══════════════════════════════════════════════════════════"
