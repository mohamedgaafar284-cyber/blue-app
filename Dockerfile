# ============================================
# BluePrint SaaS - Production Dockerfile
# ============================================
# Multi-stage build for optimized production image
# Uses Bun for dependency installation, Node.js for runtime

# Stage 1: Dependencies (ALL — including devDependencies for the build stage)
# Pin to Node 20.18 LTS minor (gets security patch updates, but no surprise major bumps)
FROM node:20.18-alpine AS deps
# python3, make, g++ needed for native modules (sharp)
RUN apk add --no-cache libc6-compat openssl python3 make g++
# Install Bun for dependency installation (project uses bun.lock)
# Pin to 1.1.x minor for reproducible builds (avoids major-bump breakage from bun@latest)
RUN npm install -g bun@1.1

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY prisma ./prisma/
COPY scripts ./scripts/

# Install ALL dependencies (including devDependencies for build)
# --ignore-scripts skips prepare:husky (dev-only) and postinstall:prisma-generate
# We run prisma generate manually below
RUN bun install --ignore-scripts

# Prepare PostgreSQL schema and generate Prisma Client for production container
ENV DATABASE_PROVIDER=postgresql
RUN node scripts/prepare-schema.js && npx prisma generate

# ============================================
# Stage 2: Builder
FROM node:20.18-alpine AS builder


WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NOTE: Secrets (DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY) are NOT baked into the image.
# Next.js standalone does NOT execute API routes or middleware at build time,
# so these secrets are never needed during the build phase.
# At runtime, inject secrets via docker-compose env_file, .env, or Docker secrets.
# Prisma generate is handled in the deps stage; no DATABASE_URL needed here.

# Build the application
RUN npm run build

# ============================================
# Stage 3: Production dependencies only
# We install ALL deps then prune devDependencies to avoid the
# "lockfile had changes, but lockfile is frozen" error that occurs
# when running `bun install --production` in Docker (Bun's --production
# flag modifies the lockfile, which conflicts with frozen-lockfile mode).
FROM node:20.18-alpine AS prod-deps
RUN apk add --no-cache libc6-compat openssl
# Install Bun for dependency installation (project uses bun.lock)
RUN npm install -g bun@1.1

WORKDIR /app

# Copy package files and install ALL deps first
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --ignore-scripts

# Remove devDependencies by re-installing with NODE_ENV=production
# This avoids lockfile changes because the full lockfile is already present
ENV NODE_ENV=production
RUN rm -rf node_modules && bun install --ignore-scripts

# Copy the already-generated Prisma Client from the deps stage.
# Prisma CLI is in devDependencies, so it won't be installed in prod-deps.
# Regenerating with `npx prisma generate` would either fail (no prisma binary)
# or download an unversioned binary from npm (wrong version, network-dependent).
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# ============================================
# Stage 4: Runner (Production)
FROM node:20.18-alpine AS runner

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes only needed files)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy production node_modules for Prisma and other server-side deps
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy Prisma schema for migrations at runtime
COPY --from=builder /app/prisma ./prisma

# Copy Prisma CLI binary from deps stage for runtime migrations.
# Prisma CLI is in devDependencies, so it's not in prod node_modules.
# We need it at runtime for `prisma migrate deploy` in the entrypoint.
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# Install postgresql-client for migrations and tini
RUN apk add --no-cache postgresql-client tini

# Copy entrypoint script
COPY --from=builder /app/docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Set proper ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set port
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application via entrypoint
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
