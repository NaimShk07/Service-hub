# ==============================================================================
# Stage 1: Build Environment (Builder)
# ==============================================================================
FROM node:20-alpine AS builder

# Install system dependencies required for native modules and Prisma
RUN apk add --no-cache libc6-compat openssl

WORKDIR /usr/src/app

# Leverage Docker layer caching: copy package manifests first
COPY package*.json ./

# Install all dependencies (including devDependencies required for build)
RUN npm ci

# Copy project configuration, Prisma schema, and Prisma config
COPY tsconfig*.json nest-cli.json prisma.config.ts* ./
COPY prisma ./prisma
RUN npx prisma generate

# Copy application source
COPY src ./src

# Compile TypeScript to production JavaScript
RUN npm run build

# Remove development dependencies to keep production footprint minimal
RUN npm prune --omit=dev

# ==============================================================================
# Stage 2: Production Runtime (Runner)
# ==============================================================================
FROM node:20-alpine AS runner

# Install OpenSSL runtime required by Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8000

# Create uploads directory and grant ownership to unprivileged 'node' user
RUN mkdir -p uploads/public uploads/private && chown -R node:node /usr/src/app

# Copy production node_modules from builder
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules

# Copy compiled application
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

# Copy Prisma schema and generated client
COPY --chown=node:node --from=builder /usr/src/app/prisma ./prisma
COPY --chown=node:node --from=builder /usr/src/app/generated ./generated
COPY --chown=node:node prisma.config.ts* ./

# Copy package.json for metadata and runtime scripts
COPY --chown=node:node package.json ./

# Switch to unprivileged user for security
USER node

# Expose default HTTP port
EXPOSE 8000

# Start compiled NestJS application
CMD ["node", "dist/src/main.js"]
