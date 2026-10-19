#!/bin/bash
# MacOS / Linux setup script for BluePrint ERP

export LANG=en_US.UTF-8

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     🔵 BluePrint - Engineering Consultancy ERP   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

echo "[Checking prerequisites...]"

if command -v bun >/dev/null 2>&1; then
    RUNNER="bun"
    PKG_MGR="bun"
    EXEC="bunx"
    echo -e "${GREEN}[OK] Bun found${NC}"
elif command -v node >/dev/null 2>&1; then
    RUNNER="node"
    PKG_MGR="npm"
    EXEC="npx"
    echo -e "${GREEN}[OK] Node.js found (Fallback from Bun)${NC}"
else
    echo -e "${RED}[ERROR] Neither Bun nor Node.js found! Please install Node.js.${NC}"
    exit 1
fi

if command -v git >/dev/null 2>&1; then
    echo -e "${GREEN}[OK] Git found${NC}"
else
    echo -e "${RED}[ERROR] Git is not installed!${NC}"
    exit 1
fi

if command -v openssl >/dev/null 2>&1; then
    echo -e "${GREEN}[OK] OpenSSL found${NC}"
else
    echo -e "${YELLOW}[WARN] OpenSSL not found, using Bun crypto${NC}"
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Step 1: Choose Mode — اختار الوضع${NC}"
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "  [1] Demo Mode — وضع العرض التجريبي"
echo -e "      • Auto-filled login credentials"
echo -e "      • Sample projects, invoices, tasks"
echo ""
echo -e "  [2] Production Mode — وضع الإنتاج"
echo -e "      • Requires SMTP for email"
echo -e "      • No demo data"
echo ""
read -p "  Enter choice (1 or 2, default=1): " MODE_CHOICE
MODE_CHOICE=${MODE_CHOICE:-1}

echo ""
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Step 2: Choose Database — اختار قاعدة البيانات${NC}"
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "  [1] PostgreSQL — للإنتاج"
echo -e "  [2] SQLite — للتجربة السريعة"
echo ""
read -p "  Enter choice (1 or 2, default=2): " DB_CHOICE
DB_CHOICE=${DB_CHOICE:-2}

echo ""
echo "Step 3: Generating Secrets..."
if command -v openssl >/dev/null 2>&1; then
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    CSRF_SECRET=$(openssl rand -hex 32)
else
    JWT_SECRET=$($RUNNER -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    ENCRYPTION_KEY=$($RUNNER -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    CSRF_SECRET=$($RUNNER -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fi
echo -e "${GREEN}[OK] Secrets generated${NC}"

echo ""
echo "Step 4: Creating .env file..."
if [ -f .env ]; then
    cp .env .env.backup
    echo -e "${GREEN}[OK] Old .env backed up to .env.backup${NC}"
fi

if [ "$MODE_CHOICE" = "1" ]; then
    DEMO_MODE="true"
    NODE_ENV="development"
else
    DEMO_MODE="false"
    NODE_ENV="production"
fi

if [ "$DB_CHOICE" = "1" ]; then
    DATABASE_URL="postgresql://blueprint:blueprint_dev@localhost:5432/blueprint?schema=public"
else
    DATABASE_URL="file:./db/custom.db"
fi

cat > .env << EOL
DATABASE_URL=$DATABASE_URL
JWT_SECRET="$JWT_SECRET"
NEXTAUTH_SECRET="$JWT_SECRET"
CSRF_SECRET="$CSRF_SECRET"
ENCRYPTION_KEY="$ENCRYPTION_KEY"
DEMO_MODE=$DEMO_MODE
COOKIE_SECURE=$([ "$MODE_CHOICE" = "1" ] && echo "false" || echo "true")
NODE_ENV=$NODE_ENV
NEXTAUTH_URL="http://localhost:3000"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
EOL
echo -e "${GREEN}[OK] .env configured${NC}"

echo ""
echo "Step 5: Preparing Prisma schema..."
node scripts/prepare-schema.js
echo -e "${GREEN}[OK] Prisma schema prepared${NC}"

echo ""
echo "Step 6: Cleaning old files..."
rm -rf .next
if [ "$DB_CHOICE" = "2" ]; then
    rm -f db/custom.db
fi
echo -e "${GREEN}[OK] Cleaned${NC}"

echo ""
echo "Step 7: Installing dependencies (${PKG_MGR} install)..."
$PKG_MGR install
echo -e "${GREEN}[OK] Dependencies installed${NC}"

echo ""
echo "Step 8: Creating Database Tables..."
$EXEC prisma db push
echo -e "${GREEN}[OK] Database schema pushed${NC}"

echo ""
echo "Step 9: Seeding data..."
if [ "$MODE_CHOICE" = "1" ]; then
    $EXEC tsx prisma/seed.ts
    echo -e "${GREEN}[OK] Demo data seeded${NC}"
else
    echo -e "${GREEN}[OK] Skipped demo data for Production Mode${NC}"
fi

echo ""
echo "Step 10: Generating Prisma Client..."
$EXEC prisma generate
echo -e "${GREEN}[OK] Prisma Client ready${NC}"

# ─────────────────────────────────────────────────────────────────────────────
# Step 11: Generate one-time setup token (Demo Mode only)
# This replaces the old practice of printing plaintext credentials to the terminal.
# The user opens /setup-complete in the browser and enters this token to view
# the demo credentials ONCE (token is single-use, expires in 24 hours).
# ─────────────────────────────────────────────────────────────────────────────
SETUP_TOKEN=""
if [ "$MODE_CHOICE" = "1" ]; then
    echo ""
    echo "Step 11: Generating one-time setup token..."
    # Generate a secure random token (URL-safe, 32 chars)
    if command -v openssl >/dev/null 2>&1; then
        SETUP_TOKEN=$(openssl rand -hex 24)
    else
        # Fallback: use /dev/urandom
        SETUP_TOKEN=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
    fi

    # Hash the token (SHA-256) before storing — plaintext never persists
    TOKEN_HASH=$(printf '%s' "$SETUP_TOKEN" | sha256sum | awk '{print $1}')
    NOW_MS=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')

    # Write hashed token to .setup-tokens.json (mode 600)
    cat > .setup-tokens.json <<EOF
{
  "version": 1,
  "tokens": [
    {
      "hash": "$TOKEN_HASH",
      "createdAt": $NOW_MS,
      "consumed": false
    }
  ],
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    chmod 600 .setup-tokens.json
    echo -e "${GREEN}[OK] Setup token generated${NC}"
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          ✅ Setup Complete! — تم الإعداد!         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "┌──────────────────────────────────────────────┐"
if [ "$MODE_CHOICE" = "1" ]; then
    echo "│  Mode:     DEMO — عرض تجريبي                 │"
else
    echo "│  Mode:     PRODUCTION — وضع الإنتاج          │"
fi
echo "│  URL:      http://localhost:3000              │"
if [ "$DB_CHOICE" = "1" ]; then
    echo "│  Database: PostgreSQL                         │"
else
    echo "│  Database: SQLite                             │"
fi
echo "└──────────────────────────────────────────────┘"
echo ""

if [ "$MODE_CHOICE" = "1" ]; then
    echo -e "${YELLOW}🔐 لعرض بيانات الدخول التجريبية:${NC}"
    echo ""
    echo "  1. افتح الرابط التالي في المتصفح:"
    echo -e "     ${GREEN}http://localhost:3000/setup-complete${NC}"
    echo ""
    echo "  2. أدخل رمز الإعداد التالي (يُستخدم مرة واحدة فقط):"
    echo ""
    echo -e "     ${GREEN}$SETUP_TOKEN${NC}"
    echo ""
    echo -e "  ${YELLOW}⚠️  احفظ هذا الرمز الآن — لن يظهر مرة أخرى.${NC}"
    echo -e "  ${YELLOW}    الرمز صالح لمدة 24 ساعة من الآن.${NC}"
    echo ""
fi

if [ "$MODE_CHOICE" = "2" ]; then
    echo -e "${YELLOW}⚠️ NOTE FOR PRODUCTION:${NC}"
    echo "Please edit .env to configure your SMTP and Stripe keys before going live."
    echo ""
fi

read -p "  Start dev server now? (y/n, default=y): " START_DEV
START_DEV=${START_DEV:-y}
if [[ "$START_DEV" =~ ^[Yy]$ ]]; then
    $PKG_MGR run dev
fi
