#!/bin/sh
set -e

# Validation for required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set."
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "ERROR: JWT_SECRET environment variable is not set."
  exit 1
fi

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "ERROR: ENCRYPTION_KEY environment variable is not set."
  exit 1
fi

# Run Prisma migrations if explicitly enabled (default is to run via 'docker compose run --rm migrate')
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Attempting database migrations..."
  if npx prisma migrate deploy 2>&1; then
    echo "Database migrations completed successfully."
  else
    echo "WARNING: Direct 'npx prisma migrate deploy' in runtime container failed or Prisma CLI is omitted."
    echo "If running in production, use 'docker compose run --rm migrate' or run migrations from CI."
  fi
fi

# Start the application
echo "Starting the application..."
exec "$@"
