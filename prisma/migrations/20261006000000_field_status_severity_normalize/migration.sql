-- ============================================================================
-- Migration: Normalize SiteVisit and Defect status and severity to UPPERCASE
-- Date: 2026-10-06
--
-- Problem: Status and severity had mixed casing between legacy and new records:
--   - Defect.severity: 'CRITICAL', 'HIGH', 'NORMAL', 'LOW' vs 'critical', 'high'...
--   - Defect.status: 'OPEN', 'IN_PROGRESS', 'RESOLVED' vs 'open', 'in_progress'...
--   - SiteVisit.status: 'SUBMITTED', 'APPROVED', 'DRAFT' vs 'submitted', 'draft'...
--
-- Fix (single source of truth = UPPERCASE, matching UI configs and filters):
--   1. UPDATE existing rows in Defect and SiteVisit to UPPER(column)
--   2. Update default columns in database to UPPERCASE
--
-- Idempotent: safe to run repeatedly.
-- ============================================================================

-- 1) Normalize Defect status and severity to UPPERCASE
UPDATE "Defect" SET severity = UPPER(severity) WHERE severity IS NOT NULL AND severity <> UPPER(severity);
UPDATE "Defect" SET status = UPPER(status) WHERE status IS NOT NULL AND status <> UPPER(status);

-- 2) Normalize SiteVisit status to UPPERCASE
UPDATE "SiteVisit" SET status = UPPER(status) WHERE status IS NOT NULL AND status <> UPPER(status);
