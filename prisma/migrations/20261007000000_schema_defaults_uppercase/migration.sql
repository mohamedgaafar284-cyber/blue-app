-- Set default values for status and severity in SiteVisit and Defect to uppercase
-- SQLite does not support ALTER COLUMN SET DEFAULT directly, but for PostgreSQL/MySQL environments:
-- In SQLite, defaults are managed at the schema/Prisma layer. 
-- In PostgreSQL this would be:
-- ALTER TABLE "SiteVisit" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
-- ALTER TABLE "Defect" ALTER COLUMN "status" SET DEFAULT 'OPEN';
-- ALTER TABLE "Defect" ALTER COLUMN "severity" SET DEFAULT 'NORMAL';

-- Re-enforce existing rows to uppercase standards
UPDATE "SiteVisit"
SET "status" = CASE
  WHEN LOWER("status") = 'draft' THEN 'DRAFT'
  WHEN LOWER("status") = 'submitted' THEN 'SUBMITTED'
  WHEN LOWER("status") = 'approved' THEN 'APPROVED'
  ELSE UPPER("status")
END
WHERE "status" IS NOT NULL;

UPDATE "Defect"
SET "status" = CASE
  WHEN LOWER("status") = 'open' THEN 'OPEN'
  WHEN LOWER("status") = 'in_progress' THEN 'IN_PROGRESS'
  WHEN LOWER("status") = 'resolved' THEN 'RESOLVED'
  WHEN LOWER("status") = 'closed' THEN 'CLOSED'
  ELSE UPPER("status")
END
WHERE "status" IS NOT NULL;

UPDATE "Defect"
SET "severity" = CASE
  WHEN LOWER("severity") = 'critical' THEN 'CRITICAL'
  WHEN LOWER("severity") = 'high' THEN 'HIGH'
  WHEN LOWER("severity") = 'medium' THEN 'HIGH'
  WHEN LOWER("severity") = 'normal' THEN 'NORMAL'
  WHEN LOWER("severity") = 'low' THEN 'LOW'
  ELSE UPPER("severity")
END
WHERE "severity" IS NOT NULL;
