-- ============================================================================
-- Migration: Add Recurring Invoices, Project Templates, Report Templates,
--            Document Versions, and Document Signatures
-- Date: 2026-10-19
-- ============================================================================

-- RecurringInvoice
CREATE TABLE IF NOT EXISTS "RecurringInvoice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "templateItems" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "notesAr" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "customDays" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3),
    "lastRunDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecurringInvoice_clientId_idx" ON "RecurringInvoice"("clientId");
CREATE INDEX IF NOT EXISTS "RecurringInvoice_projectId_idx" ON "RecurringInvoice"("projectId");
CREATE INDEX IF NOT EXISTS "RecurringInvoice_organizationId_idx" ON "RecurringInvoice"("organizationId");
CREATE INDEX IF NOT EXISTS "RecurringInvoice_isActive_idx" ON "RecurringInvoice"("isActive");
CREATE INDEX IF NOT EXISTS "RecurringInvoice_nextRunDate_idx" ON "RecurringInvoice"("nextRunDate");
CREATE INDEX IF NOT EXISTS "RecurringInvoice_deletedAt_idx" ON "RecurringInvoice"("deletedAt");

DO $$ BEGIN
    ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ProjectTemplate
CREATE TABLE IF NOT EXISTS "ProjectTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "category" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "icon" TEXT NOT NULL DEFAULT '📋',
    "defaultBudget" DECIMAL(18,2),
    "defaultDurationDays" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "stages" TEXT NOT NULL DEFAULT '[]',
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectTemplate_category_idx" ON "ProjectTemplate"("category");
CREATE INDEX IF NOT EXISTS "ProjectTemplate_organizationId_idx" ON "ProjectTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "ProjectTemplate_deletedAt_idx" ON "ProjectTemplate"("deletedAt");

DO $$ BEGIN
    ALTER TABLE "ProjectTemplate" ADD CONSTRAINT "ProjectTemplate_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ReportTemplate
CREATE TABLE IF NOT EXISTS "ReportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT,
    "description" TEXT,
    "dataSource" TEXT NOT NULL DEFAULT 'projects',
    "fields" TEXT NOT NULL DEFAULT '[]',
    "filters" TEXT NOT NULL DEFAULT '[]',
    "groupBy" TEXT,
    "sortBy" TEXT,
    "sortOrder" TEXT NOT NULL DEFAULT 'desc',
    "chartType" TEXT NOT NULL DEFAULT 'table',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReportTemplate_dataSource_idx" ON "ReportTemplate"("dataSource");
CREATE INDEX IF NOT EXISTS "ReportTemplate_organizationId_idx" ON "ReportTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "ReportTemplate_deletedAt_idx" ON "ReportTemplate"("deletedAt");

DO $$ BEGIN
    ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DocumentVersion
CREATE TABLE IF NOT EXISTS "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "filePath" TEXT NOT NULL DEFAULT '',
    "fileSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "changeNotes" TEXT NOT NULL DEFAULT '',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentVersion_uploadedById_idx" ON "DocumentVersion"("uploadedById");

DO $$ BEGIN
    ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DocumentSignature
CREATE TABLE IF NOT EXISTS "DocumentSignature" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL DEFAULT '',
    "signerRole" TEXT NOT NULL DEFAULT '',
    "signatureImage" TEXT NOT NULL,
    "signedById" TEXT,
    "ipAddress" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DocumentSignature_documentId_idx" ON "DocumentSignature"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentSignature_signedById_idx" ON "DocumentSignature"("signedById");

DO $$ BEGIN
    ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
