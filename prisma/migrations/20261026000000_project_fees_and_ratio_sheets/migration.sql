-- ============================================================
-- Project Fees & Collections + Official Ratio Sheets
-- Phase 3: أتعاب المشروع وتحصيلاتها (احتجاز بنكي + ضريبة)
-- Phase 4: جدول النسب الرسمية (شيت + بنود)
-- ============================================================

-- CreateTable: ProjectFee (الأتعاب حسب الاتفاق)
CREATE TABLE "ProjectFee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'DESIGN',
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FeeCollection (تحصيلات الأتعاب)
CREATE TABLE "FeeCollection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "feeId" TEXT,
    "voucherNumber" TEXT NOT NULL DEFAULT '',
    "grossAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "retentionRate" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "retentionAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 5,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT 'transfer',
    "referenceNumber" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT NOT NULL DEFAULT '',
    "retentionReleasedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RatioSheet (جدول النسب الرسمية — شيت واحد لكل مشروع)
CREATE TABLE "RatioSheet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "programName" TEXT NOT NULL DEFAULT '',
    "fileNumber" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "contractValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maintenancePct" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatioSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProjectRatio (بنود النسب الرسمية)
CREATE TABLE "ProjectRatio" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "itemName" TEXT NOT NULL DEFAULT '',
    "itemNameEn" TEXT NOT NULL DEFAULT '',
    "officialPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "executedPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRatio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RatioSheet_projectId_key" ON "RatioSheet"("projectId");

-- CreateIndex
CREATE INDEX "ProjectFee_projectId_idx" ON "ProjectFee"("projectId");

-- CreateIndex
CREATE INDEX "ProjectFee_organizationId_idx" ON "ProjectFee"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectFee_deletedAt_idx" ON "ProjectFee"("deletedAt");

-- CreateIndex
CREATE INDEX "FeeCollection_projectId_idx" ON "FeeCollection"("projectId");

-- CreateIndex
CREATE INDEX "FeeCollection_feeId_idx" ON "FeeCollection"("feeId");

-- CreateIndex
CREATE INDEX "FeeCollection_organizationId_idx" ON "FeeCollection"("organizationId");

-- CreateIndex
CREATE INDEX "FeeCollection_deletedAt_idx" ON "FeeCollection"("deletedAt");

-- CreateIndex
CREATE INDEX "RatioSheet_organizationId_idx" ON "RatioSheet"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectRatio_projectId_idx" ON "ProjectRatio"("projectId");

-- CreateIndex
CREATE INDEX "ProjectRatio_organizationId_idx" ON "ProjectRatio"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectRatio_deletedAt_idx" ON "ProjectRatio"("deletedAt");

-- AddForeignKey
ALTER TABLE "ProjectFee" ADD CONSTRAINT "ProjectFee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFee" ADD CONSTRAINT "ProjectFee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFee" ADD CONSTRAINT "ProjectFee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "ProjectFee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatioSheet" ADD CONSTRAINT "RatioSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatioSheet" ADD CONSTRAINT "RatioSheet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatioSheet" ADD CONSTRAINT "RatioSheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRatio" ADD CONSTRAINT "ProjectRatio_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRatio" ADD CONSTRAINT "ProjectRatio_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
