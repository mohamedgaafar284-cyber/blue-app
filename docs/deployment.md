# BluePrint ERP - Deployment Guide

## Prerequisites

- Server with Docker and Docker Compose installed
- Domain name with SSL certificate (or Cloudflare proxy)
- PostgreSQL 15+ database
- Redis 7+ (for caching and Socket.IO)
- SMTP server for email delivery

## Quick Start (Docker)

### 1. Clone the Repository

```bash
git clone https://github.com/mohamedblueprintrak-design/blue-app.git
cd blue-app
```

### 2. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with your production values:

```env
# Database (Required)
DATABASE_URL="postgresql://user:password@localhost:5432/blueprint"

# Authentication (Required - min 32 characters)
JWT_SECRET="your-very-long-secret-key-at-least-32-chars"

# Encryption (Required - exactly 64 hex characters)
# SECURITY FIX (P0-4): Generate with `openssl rand -hex 32`. Never reuse the example value.
ENCRYPTION_KEY="generate-with: openssl rand -hex 32"

# Application
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NODE_ENV="production"

# Redis (Recommended for production)
REDIS_URL="redis://:password@localhost:6379"

# File Uploads (Optional - S3-compatible)
S3_ENDPOINT="https://s3.amazonaws.com"
S3_BUCKET="blueprint-uploads"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_REGION="me-south-1"

# Email (Required for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="BluePrint <noreply@your-domain.com>"

# Stripe (Required for billing)
# SECURITY FIX (P0-4): Use sk_test_... keys for staging. Never commit live keys.
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"

# Monitoring (Optional)
SENTRY_DSN="https://xxx@sentry.io/xxx"
```

### 3. Run Database Migrations

Run database migrations using the dedicated migrate container before starting the application:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

### 4. Start Services

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 5. Create Initial Admin User

Open your application in the browser. The first-run setup wizard (`/setup`) will automatically detect a clean installation and allow you to configure the initial administrator account securely.

> SECURITY FIX (P0-4): Previously, default credentials (`admin@blue.com / Admin@123`)
> were hardcoded in this document. They have been removed. Always obtain credentials
> from the setup script output and rotate them immediately.

## Server Setup (Ubuntu/Debian)

### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Install Docker Compose

```bash
sudo apt install docker-compose-plugin
```

### Configure Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### Set Up Reverse Proxy (Caddy)

The project includes a `Caddyfile`. Point your domain:

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

### Set Up SSL with Cloudflare

1. Add your domain to Cloudflare
2. Set DNS A record to your server IP
3. Enable "Full (Strict)" SSL mode
4. Cloudflare will handle HTTPS automatically

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing (min 32 chars) |
| `ENCRYPTION_KEY` | Yes | AES-256 key (64 hex chars) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the application |
| `REDIS_URL` | Recommended | Redis connection for caching |
| `SMTP_HOST` | Yes | SMTP server for emails |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for billing |

## Monitoring

### Health Check

The application exposes a health endpoint:

```bash
curl https://your-domain.com/api/health
```

### Logs

```bash
# Application logs
docker compose logs -f app

# Database logs
docker compose logs -f db

# Redis logs
docker compose logs -f redis
```

## Backup

### Database Backup

```bash
docker compose exec db pg_dump -U postgres blueprint > backup.sql
```

### Restore

```bash
cat backup.sql | docker compose exec -T db psql -U postgres blueprint
```

## Troubleshooting

### Container won't start
```bash
docker compose logs app
```

### Database connection errors
- Check `DATABASE_URL` is correct
- Ensure PostgreSQL is running: `docker compose ps db`
- Check network connectivity

### Permission denied on uploads
```bash
docker compose exec app chown -R nextjs:nodejs /app/uploads
```

## New Developer Onboarding

### 1. Local Development Setup

```bash
# Clone
git clone https://github.com/mohamedblueprintrak-design/blue-app.git
cd blue-app

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Set up local database
cp .env.example .env
# Edit .env with local settings
bunx prisma db push
bunx tsx prisma/seed.ts

# Start development server
bun run dev
```

### 2. Project Structure

```
src/
├── app/              # Next.js pages and API routes
│   ├── api/          # API endpoints
│   └── (dashboard)/  # Protected pages
├── components/       # React components
├── lib/              # Utilities and services
│   ├── auth/         # Authentication & authorization
│   ├── security/     # Security modules
│   └── middleware/    # Rate limiting, security headers
└── __tests__/        # Test files
```

### 3. Key Commands

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run lint         # ESLint check
bun run type-check   # TypeScript check
bun run test         # Run unit tests
bun run test:e2e     # Run E2E tests
```

### 4. Code Style

- TypeScript strict mode
- ESLint + Next.js config
- Husky pre-commit hooks
- Conventional commits
