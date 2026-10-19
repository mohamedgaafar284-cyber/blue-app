import { PrismaClient } from '@prisma/client';

// Create a fresh PrismaClient for the seed script
// (avoids singleton issues when running outside Next.js context via npx tsx)
const db = new PrismaClient();
import bcrypt from 'bcryptjs';
import { DEMO_CREDENTIALS } from '../src/lib/demo-credentials';
import { defaultAccounts } from '../src/lib/services/accounting.service';

/**
 * BluePrint Comprehensive Seed Script
 * Single source of truth for ALL seed data
 *
 * Strategy: Destructive (delete all → seed fresh)
 * Idempotent: Can run multiple times safely
 *
 * Demo passwords are defined in src/lib/demo-credentials.ts
 * وثائق كلمات المرور التجريبية في src/lib/demo-credentials.ts
 */

import fs from 'fs';
import path from 'path';

// Ensure .env is parsed if tsx was run directly without dotenv preload
if (fs.existsSync(path.join(__dirname, '../.env'))) {
  const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

async function main() {
  // Production safety guard: this seed creates accounts with publicly-known demo
  // passwords (see src/lib/demo-credentials.ts). Never run it against production
  // unless you explicitly acknowledge the risk via ALLOW_SEED_IN_PRODUCTION=true.
  const isProductionEnv = process.env.NODE_ENV === 'production' || process.env.DEMO_MODE === 'false';
  if (isProductionEnv && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    console.error('❌ Refusing to seed a production database (NODE_ENV=production or DEMO_MODE=false).');
    console.error('   This script creates demo accounts with publicly-known passwords.');
    console.error('   For clean production init, use: npx tsx prisma/clean-init.ts');
    console.error('   If you truly intend to seed production, set ALLOW_SEED_IN_PRODUCTION=true.');
    process.exit(1);
  }

  console.info('🌱 Seeding BluePrint database...');
  console.info('📧 Demo passwords are defined in src/lib/demo-credentials.ts');
  console.info('⚠️  These are for development/demo only — never use in production!\n');

  // ========== Date Helpers (dynamic — relative to today) ==========
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();
  const currentYearStr = String(year);

  // Helper: create a date relative to today
  function daysFromNow(days: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  }

  // Helper: create a date N months ago
  function monthsAgo(months: number, dayOfMonth?: number): Date {
    const d = new Date(year, month - months, dayOfMonth || day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Helper: create a date N months from now
  function monthsFromNow(months: number, dayOfMonth?: number): Date {
    const d = new Date(year, month + months, dayOfMonth || day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ========== 0. Clean existing data (idempotent seeding) ==========
  console.info('🧹 Cleaning existing data...');
  // Disable FK checks for clean seeding (SQLite-specific)
  // Disable FK checks for clean seeding (SQLite-specific)
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    await db.$executeRaw`PRAGMA foreign_keys = OFF`
  };
  await db.$transaction([
    // Child tables first (foreign key dependencies)
    // Newer models — added to ensure complete cleanup
    db.sLABreach.deleteMany(),
    db.journalLine.deleteMany(),
    db.journalEntry.deleteMany(),
    db.account.deleteMany(),
    db.whatsAppMessage.deleteMany(),
    db.lead.deleteMany(),
    db.aIChatConversation.deleteMany(),
    db.aIChatMessage.deleteMany(),
    db.refreshToken.deleteMany(),
    db.emailVerificationToken.deleteMany(),
    db.passwordResetToken.deleteMany(),
    db.twoFactorSecret.deleteMany(),
    db.twoFactorChallenge.deleteMany(),
    db.pushSubscription.deleteMany(),
    db.featureFlag.deleteMany(),
    db.securityAuditLog.deleteMany(),
    db.automation.deleteMany(),
    db.progressClaim.deleteMany(),
    db.timesheet.deleteMany(),
    db.timesheetEntry.deleteMany(),
    db.contractorEvaluation.deleteMany(),
    db.marketingCampaign.deleteMany(),
    db.referral.deleteMany(),
    db.checklistItem.deleteMany(),
    db.projectWorkflow.deleteMany(),
    db.workflowStage.deleteMany(),
    db.workflowStep.deleteMany(),
    db.municipalityCorrespondence.deleteMany(),
    db.projectComment.deleteMany(),
    db.inspectionFinding.deleteMany(),
    db.inspectionPhoto.deleteMany(),
    db.buildingInspection.deleteMany(),
    db.quoteRequest.deleteMany(),
    db.transmittalItem.deleteMany(),
    db.purchaseOrderItem.deleteMany(),
    db.proposalItem.deleteMany(),
    db.invoiceItem.deleteMany(),
    db.invoicePayment.deleteMany(),
    db.plan.deleteMany(),
    db.subscription.deleteMany(),
    db.subscriptionPayment.deleteMany(),
    db.contractAmendment.deleteMany(),
    db.designPhase.deleteMany(),
    db.designDrawing.deleteMany(),
    db.designRevision.deleteMany(),
    db.notificationSettings.deleteMany(),
    db.taskComment.deleteMany(),
    db.approval.deleteMany(),
    db.notification.deleteMany(),
    db.knowledgeArticle.deleteMany(),
    db.bid.deleteMany(),
    db.proposal.deleteMany(),
    db.siteDiary.deleteMany(),
    db.meeting.deleteMany(),
    db.siteVisit.deleteMany(),
    db.govApproval.deleteMany(),
    db.supplier.deleteMany(),
    db.contract.deleteMany(),
    db.invoice.deleteMany(),
    db.task.deleteMany(),
    db.projectAssignment.deleteMany(),
    db.projectStage.deleteMany(),
    db.schedulePhase.deleteMany(),
    db.bOQItem.deleteMany(),
    db.clientInteraction.deleteMany(),
    db.defect.deleteMany(),
    db.rFI.deleteMany(),
    db.leave.deleteMany(),
    db.document.deleteMany(),
    db.payment.deleteMany(),
    db.budget.deleteMany(),
    db.risk.deleteMany(),
    db.submittal.deleteMany(),
    db.changeOrder.deleteMany(),
    db.transmittal.deleteMany(),
    db.violation.deleteMany(),
    db.guaranteeLetter.deleteMany(),
    db.retainage.deleteMany(),
    db.commission.deleteMany(),
    db.supervisionChecklist.deleteMany(),
    db.purchaseOrder.deleteMany(),
    db.inventoryItem.deleteMany(),
    db.workflowTemplate.deleteMany(),
    db.project.deleteMany(),
    db.contractor.deleteMany(),
    db.client.deleteMany(),
    db.employee.deleteMany(),
    db.companySettings.deleteMany(),
    db.user.deleteMany(),
    // New models (Phase 2)
    db.bankAccount.deleteMany(),
    db.bankTransaction.deleteMany(),
    db.whatsAppTemplate.deleteMany(),
    db.opportunity.deleteMany(),
    db.cRMActivity.deleteMany(),
    db.organization.deleteMany(),
  ]);
  // Re-enable FK checks
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    await db.$executeRaw`PRAGMA foreign_keys = ON`
  };
  console.info('✅ Existing data cleaned\n');

  // ========== 0.5. Create Organizations (Multi-Tenant) ==========
  const org1 = await db.organization.create({
    data: {
      id: 'org-blueprint-rak',
      name: 'بلوبرنت للاستشارات الهندسية - رأس الخيمة',
      slug: 'blueprint-rak',
      description: 'مكتب الاستشارات الهندسية BluePrint في رأس الخيمة',
      email: 'info.blueprintrak@gmail.com',
      phone: '+971-7-234-5678',
      address: 'رأس الخيمة، الإمارات العربية المتحدة',
      taxNumber: '100000000000000',
      currency: 'AED',
      timezone: 'Asia/Dubai',
      locale: 'ar',
      isActive: true,
    },
  });
  const org2 = await db.organization.create({
    data: {
      id: 'org-blueprint-dxb',
      name: 'بلوبرنت للاستشارات الهندسية - دبي',
      slug: 'blueprint-dxb',
      description: 'مكتب الاستشارات الهندسية BluePrint في دبي',
      email: 'info@blueprintdxb.ae',
      phone: '+971-4-345-6789',
      address: 'دبي، الإمارات العربية المتحدة',
      taxNumber: '100000000000001',
      currency: 'AED',
      timezone: 'Asia/Dubai',
      locale: 'ar',
      isActive: true,
    },
  });
  
  // Seed Chart of Accounts for the organizations
  console.info('🌱 Seeding Chart of Accounts for all organizations...');
  const seedAccountsForOrg = async (orgId: string) => {
    await db.account.createMany({
      data: defaultAccounts.map(acc => ({
        code: acc.code,
        nameAr: acc.nameAr,
        nameEn: acc.nameEn,
        type: acc.type,
        organizationId: orgId,
        isActive: true,
      })),
    });
  };
  await seedAccountsForOrg(org1.id);
  await seedAccountsForOrg(org2.id);

  console.info('✅ 2 organizations created (RAK + DXB)');

  // ========== 1. Create All Demo Users from Shared Credentials ==========
  const userMap: Record<string, { id: string }> = {};

  // Assign orgs: Most users to org1 (RAK), some to org2 (DXB)
  const orgAssignments: Record<string, string> = {
    'admin@blueprint.ae': org1.id,
    'pm@blueprint.ae': org1.id,
    'eng@blueprint.ae': org1.id,
    'struct@blueprint.ae': org1.id,
    'elec@blueprint.ae': org1.id,
    'site@blueprint.ae': org1.id,
    'mep@blueprint.ae': org1.id,
    'draft@blueprint.ae': org1.id,
    'acc@blueprint.ae': org2.id,
    'sec@blueprint.ae': org2.id,
    'hr@blueprint.ae': org2.id,
    'viewer@blueprint.ae': org2.id,
  };

  for (const cred of DEMO_CREDENTIALS) {
    const hash = await bcrypt.hash(cred.password, 10);
    const user = await db.user.create({
      data: {
        email: cred.email,
        password: hash,
        name: cred.nameAr,
        phone: '',
        role: cred.role,
        department: '',
        position: '',
        isActive: true,
        organizationId: orgAssignments[cred.email] || org1.id,
        preferences: JSON.stringify({ onboardingCompleted: true }),
      },
    });
    userMap[cred.email] = user;
  }

  // Map user variables for seed data
  const adminUser = userMap['admin@blueprint.ae'];
  const pmUser = userMap['pm@blueprint.ae'];
  const engineerUser = userMap['eng@blueprint.ae'];
  const structuralUser = userMap['struct@blueprint.ae'];
  const _elecUser = userMap['elec@blueprint.ae'];
  const siteUser = userMap['site@blueprint.ae'];
  const mepUser = userMap['mep@blueprint.ae'];
  const _draftUser = userMap['draft@blueprint.ae'];
  const accUser = userMap['acc@blueprint.ae'];
  const secUser = userMap['sec@blueprint.ae'];
  const _hrUser = userMap['hr@blueprint.ae'];
  const _viewerUser = userMap['viewer@blueprint.ae'];

  console.info(`✅ ${DEMO_CREDENTIALS.length} demo users created`);
  // Print demo credentials for developer convenience
  console.info('\n📧 Demo Credentials (development only):');
  for (const cred of DEMO_CREDENTIALS) {
    console.info(`   ${cred.labelAr} (${cred.email}): ${cred.password}`);
  }
  console.info('');

  // ========== 2. Company Settings ==========
  await db.companySettings.create({
    data: {
      id: 'default-company',
      name: 'بلوبرنت للاستشارات الهندسية',
      nameEn: 'BluePrint Engineering Consultancy',
      logo: '',
      email: 'info.blueprintrak@gmail.com',
      phone: '+971-7-234-5678',
      address: 'رأس الخيمة، الإمارات العربية المتحدة',
      taxNumber: '100000000000000',
      currency: 'AED',
      timezone: 'Asia/Dubai',
      workingDays: 'sat,sun,mon,tue,wed,thu',
      workingHours: '08:00-17:00',
      organizationId: org1.id,
    },
  });
  console.info('✅ Company settings created');

  // ========== 3. Employees ==========
  const empData = [
    { id: 'emp-admin', userId: adminUser.id, department: 'الإدارة', position: 'مدير عام', salary: 35000, hireDate: new Date('2020-01-15') },
    { id: 'emp-eng', userId: engineerUser.id, department: 'القسم المعماري', position: 'مهندس معماري أول', salary: 22000, hireDate: new Date('2021-03-01') },
    { id: 'emp-struct', userId: structuralUser.id, department: 'القسم الإنشائي', position: 'مهندسة إنشائية', salary: 20000, hireDate: new Date('2022-06-15') },
    { id: 'emp-mep', userId: mepUser.id, department: 'القسم الكهروميكانيكي', position: 'مهندس كهربائي', salary: 20000, hireDate: new Date('2021-09-01') },
    { id: 'emp-pm', userId: pmUser.id, department: 'إدارة المشاريع', position: 'مدير مشاريع', salary: 28000, hireDate: new Date('2020-06-01') },
    { id: 'emp-site', userId: siteUser.id, department: 'الهندسة والتنفيذ', position: 'مهندس موقع', salary: 18000, hireDate: new Date('2021-11-10') },
    { id: 'emp-acc', userId: accUser.id, department: 'المالية', position: 'محاسب', salary: 15000, hireDate: new Date('2022-01-05') },
    { id: 'emp-sec', userId: secUser.id, department: 'الإدارة', position: 'سكرتيرة', salary: 12000, hireDate: new Date('2023-04-20') },
    { id: 'emp-draft', userId: _draftUser.id, department: 'القسم المعماري', position: 'رسام هندسي', salary: 10000, hireDate: new Date('2023-08-15') },
    { id: 'emp-elec', userId: _elecUser.id, department: 'القسم الكهروميكانيكي', position: 'مهندس كهربائي مساعد', salary: 16000, hireDate: new Date('2022-11-01') },
  ];
  for (const e of empData) {
    await db.employee.create({ data: { ...e, employmentStatus: 'ACTIVE', organizationId: org1.id } });
  }
  console.info('✅ 10 employees created');

  // ========== 4. Clients (4 basic + 6 diverse) ==========
  const client1 = await db.client.create({
    data: {
      name: 'محمد بن راشد', nameEn: 'Mohammed Bin Rashid',
      company: 'شركة الإعمار العقارية', companyEn: 'Al Emaar Properties',
      email: 'mbinrashid@almouj.ae', phone: '+971-50-111-2233',
      idNumber: 'CR-10001',
      address: 'دبي، الإمارات العربية المتحدة',
      taxNumber: '200000000000000', creditLimit: 500000, paymentTerms: '30 days after invoice',
      organizationId: org1.id,
    },
  });
  const client2 = await db.client.create({
    data: {
      name: 'أحمد الشامسي', nameEn: 'Ahmed Al Shamsi',
      company: 'مجموعة الشامسي القابضة', companyEn: 'Al Shamsi Holding Group',
      email: 'info@shamsigroup.ae', phone: '+971-50-444-5566',
      idNumber: 'CR-10002',
      address: 'أبو ظبي، الإمارات العربية المتحدة',
      taxNumber: '300000000000000', creditLimit: 1000000, paymentTerms: '45 days after invoice',
      organizationId: org1.id,
    },
  });
  const client3 = await db.client.create({
    data: {
      name: 'سعاد الكتبي', nameEn: 'Suad Al Katbi',
      company: 'تطوير المشاريع المتقدمة', companyEn: 'Advanced Projects Development',
      email: 'projects@advanced-dev.ae', phone: '+971-50-777-8899',
      idNumber: 'CR-10003',
      address: 'رأس الخيمة، الإمارات العربية المتحدة',
      taxNumber: '400000000000000', creditLimit: 300000, paymentTerms: 'Net 30',
      organizationId: org1.id,
    },
  });
  const client4 = await db.client.create({
    data: {
      name: 'ناصر العتيبي', nameEn: 'Nasser Al Otaibi',
      company: 'شركة النخبة للاستثمار', companyEn: 'Nukhba Investment Co.',
      email: 'nasser@nukhba.ae', phone: '+971-50-222-3344',
      idNumber: 'CR-10004',
      address: 'الشارقة، الإمارات العربية المتحدة',
      taxNumber: '500000000000000', creditLimit: 750000, paymentTerms: '60 days after invoice',
      organizationId: org1.id,
    },
  });

  // 6 diverse clients (government, corporate, individual)
  const client5 = await db.client.create({
    data: {
      clientType: 'GOVERNMENT', name: 'بلدية رأس الخيمة', nameEn: 'Ras Al Khaimah Municipality',
      company: 'بلدية رأس الخيمة', companyEn: 'RAK Municipality',
      email: 'info@rakmunicipality.ae', phone: '+971-7-233-1111', whatsapp: '+971-7-233-1111',
      address: 'رأس الخيمة', taxNumber: '600000000000000', creditLimit: 2000000, paymentTerms: '60 days',
      nationality: 'UAE', idNumber: 'GOV-RAK-001', referralSource: 'WEBSITE',
      organizationId: org1.id,
    },
  });
  const client6 = await db.client.create({
    data: {
      clientType: 'COMPANY', name: 'مؤسسة الإمارات للتنمية', nameEn: 'Emirates Development Foundation',
      company: 'مؤسسة الإمارات للتنمية', companyEn: 'Emirates Development Foundation',
      email: 'projects@edf.ae', phone: '+971-2-666-7788', whatsapp: '+971-2-666-7788',
      address: 'أبو ظبي', taxNumber: '700000000000000', creditLimit: 1500000, paymentTerms: '45 days',
      nationality: 'UAE', idNumber: 'CR-40293', referralSource: 'REFERRAL',
      referralDetail: 'عن طريق المهندس أحمد محمد',
      organizationId: org1.id,
    },
  });
  const client7 = await db.client.create({
    data: {
      clientType: 'INDIVIDUAL', name: 'عبدالله المنصوري', nameEn: 'Abdullah Al Mansoori',
      email: 'a.almansoori@gmail.com', phone: '+971-50-999-0011', whatsapp: '+971-50-999-0011',
      extraPhone: '+971-55-888-2233', address: 'عجمان',
      creditLimit: 200000, paymentTerms: '30 days',
      nationality: 'UAE', idNumber: '784-1990-1234567', referralSource: 'WALK_IN',
      servicesWanted: '["consultation","design","license"]', projectType: 'VILLA',
      organizationId: org1.id,
    },
  });
  const client8 = await db.client.create({
    data: {
      clientType: 'INDIVIDUAL', name: 'raj Kumar Sharma', nameEn: 'Raj Kumar Sharma',
      email: 'raj.sharma@outlook.com', phone: '+971-55-344-5566', whatsapp: '+971-55-344-5566',
      address: 'دبي', creditLimit: 150000, paymentTerms: 'Net 30',
      nationality: 'Indian', idNumber: '784-1985-9876543', referralSource: 'SOCIAL_MEDIA',
      referralDetail: 'Instagram', servicesWanted: '["consultation","design"]', projectType: 'APARTMENT',
      organizationId: org2.id,
    },
  });
  const client9 = await db.client.create({
    data: {
      clientType: 'COMPANY', name: 'شركة الفجيرة العقارية', nameEn: 'Fujairah Real Estate Co.',
      company: 'شركة الفجيرة العقارية', companyEn: 'Fujairah Real Estate Co.',
      email: 'info@fujre.ae', phone: '+971-9-222-3344', address: 'الفجيرة',
      taxNumber: '800000000000000', creditLimit: 800000, paymentTerms: '45 days',
      nationality: 'UAE', idNumber: 'CR-50182', referralSource: 'ADVERTISEMENT',
      organizationId: org2.id,
    },
  });
  const client10 = await db.client.create({
    data: {
      clientType: 'GOVERNMENT', name: 'دائرة الأشغال العامة', nameEn: 'Department of Public Works',
      company: 'دائرة الأشغال العامة', companyEn: 'Department of Public Works',
      email: 'tenders@dpw.ae', phone: '+971-7-244-5566', address: 'رأس الخيمة',
      taxNumber: '900000000000000', creditLimit: 3000000, paymentTerms: '90 days',
      nationality: 'UAE', idNumber: 'GOV-DPW-001', referralSource: 'WEBSITE',
      servicesWanted: '["consultation","supervision"]',
      organizationId: org2.id,
    },
  });
  console.info('✅ 10 clients created (4 basic + 6 diverse)');

  // ========== 5. Contractors (5 detailed from route.ts) ==========
  const contractor1 = await db.contractor.create({
    data: {
      name: 'شركة البناء الحديث', nameEn: 'Modern Construction Co.',
      companyName: 'شركة البناء الحديث ذ.م.م', companyEn: 'Modern Construction LLC',
      contactPerson: 'محمود عبدالرحمن', phone: '+971-7-255-6677', email: 'info@modernconst.ae',
      address: 'رأس الخيمة', crNumber: 'CR-30155', licenseNumber: `LN-${currentYearStr}-0888`,
      licenseExpiry: monthsFromNow(12), classification: 'الدرجة الثالثة',
      establishmentDate: new Date('2015-06-01'), workerCount: 85, engineerCount: 12,
      tradeLicense: `TL-30155-${currentYearStr}`, tradeLicenseExpiry: monthsFromNow(6),
      vatNumber: 'AE-30155-VAT', category: 'CIVIL', rating: 4,
      specialties: 'أعمال خرسانية,تشطيبات,أعمال ترابية', experience: '9 سنوات في المقاولات العامة',
      bankName: 'بنك رأس الخيمة الوطني', bankAccount: 'AE1234567890',
      iban: 'AE07-RAKB-0000-1234-5678-90', isActive: true,
      notes: 'مقاول معتمد لدى بلدية رأس الخيمة',
      organizationId: org1.id,
    },
  });
  const contractor2 = await db.contractor.create({
    data: {
      name: 'شركة الطاقة الكهربائية', nameEn: 'Electrical Power Co.',
      companyName: 'شركة الطاقة الكهربائية ذ.م.م', companyEn: 'Electrical Power LLC',
      contactPerson: 'رامي خطاب', phone: '+971-4-355-7788', email: 'projects@elecpower.ae',
      address: 'دبي', crNumber: 'CR-40277', licenseNumber: `LN-${currentYearStr}-0999`,
      licenseExpiry: monthsFromNow(10), classification: 'الدرجة الثانية',
      establishmentDate: new Date('2010-03-15'), workerCount: 45, engineerCount: 8,
      tradeLicense: `TL-40277-${currentYearStr}`, tradeLicenseExpiry: monthsFromNow(4),
      vatNumber: 'AE-40277-VAT', category: 'ELECTRICAL', rating: 5,
      specialties: 'تمديدات كهربائية,لوحات تحكم,إنارة خارجية,أنظمة إنذار',
      experience: '14 سنة في الأعمال الكهربائية', bankName: 'بنك دبي التجاري',
      bankAccount: 'AE9876543210', iban: 'AE59-DCB-0000-9876-5432-10', isActive: true,
      organizationId: org1.id,
    },
  });
  const contractor3 = await db.contractor.create({
    data: {
      name: 'شركة الأنظمة الميكانيكية', nameEn: 'Mechanical Systems Co.',
      companyName: 'شركة الأنظمة الميكانيكية ذ.م.م', companyEn: 'Mechanical Systems LLC',
      contactPerson: 'حسن الهاشمي', phone: '+971-2-544-3322', email: 'info@mechsys.ae',
      address: 'أبو ظبي', crNumber: 'CR-50312', licenseNumber: `LN-${currentYearStr}-1100`,
      licenseExpiry: monthsFromNow(14), classification: 'الدرجة الثانية',
      establishmentDate: new Date('2012-08-20'), workerCount: 60, engineerCount: 10,
      tradeLicense: `TL-50312-${currentYearStr}`, tradeLicenseExpiry: monthsFromNow(9),
      vatNumber: 'AE-50312-VAT', category: 'MEP', rating: 4,
      specialties: 'تكييف مركزي,أنظمة تهوية,سباكة,حماية من الحريق',
      experience: '12 سنة في أعمال MEP', bankName: 'بنك أبو ظبي الوطني',
      bankAccount: 'AE5555666677', iban: 'AE35-NBAD-0000-5555-6666-77', isActive: true,
      organizationId: org1.id,
    },
  });
  const contractor4 = await db.contractor.create({
    data: {
      name: 'مؤسسة التشطيبات الفاخرة', nameEn: 'Luxury Finishing Est.',
      companyName: 'مؤسسة التشطيبات الفاخرة', companyEn: 'Luxury Finishing Est.',
      contactPerson: 'وليد الدسوقي', phone: '+971-6-533-2211', email: 'info@luxfinish.ae',
      address: 'الشارقة', crNumber: 'CR-60420', licenseNumber: `LN-${currentYearStr}-1200`,
      licenseExpiry: monthsFromNow(8), classification: 'الدرجة الرابعة',
      establishmentDate: new Date('2018-01-10'), workerCount: 35, engineerCount: 4,
      tradeLicense: `TL-60420-${currentYearStr}`, tradeLicenseExpiry: monthsFromNow(2),
      category: 'FINISHING', rating: 3,
      specialties: 'تشطيبات داخلية,ديكور,أعمال جبس,أرضيات',
      experience: '6 سنوات في التشطيبات', bankName: 'بنك الشارقة',
      bankAccount: 'AE1122334455', iban: 'AE22-SIB-0000-1122-3344-55', isActive: true,
      organizationId: org1.id,
    },
  });
  const _contractor5 = await db.contractor.create({
    data: {
      name: 'شركة السباكة والصيانة المتقدمة', nameEn: 'Advanced Plumbing & Maintenance',
      companyName: 'شركة السباكة والصيانة المتقدمة ذ.م.م', companyEn: 'Advanced Plumbing & Maintenance LLC',
      contactPerson: 'طارق النعيمي', phone: '+971-7-266-8899', email: 'info@advplumb.ae',
      address: 'رأس الخيمة', crNumber: 'CR-70580', licenseNumber: `LN-${currentYearStr}-1300`,
      licenseExpiry: monthsFromNow(7), classification: 'الدرجة الرابعة',
      establishmentDate: new Date('2016-05-15'), workerCount: 25, engineerCount: 3,
      category: 'PLUMBING', rating: 4,
      specialties: 'سباكة,صيانة,أنظمة مياه,معالجة صرف',
      experience: '8 سنوات في أعمال السباكة والصيانة', bankName: 'بنك رأس الخيمة الوطني',
      bankAccount: 'AE6677889900', iban: 'AE07-RAKB-0000-6677-8899-00', isActive: true,
      organizationId: org1.id,
    },
  });
  console.info('✅ 5 contractors created');

  // ========== 6. Projects (5 core + 5 additional with plotNumber from seed.ts) ==========
  // Projects 1-7 belong to org1 (RAK), Projects 8-10 belong to org2 (DXB)
  const project1 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-001`, name: 'فيلا فاخرة - المنطقة الأولى', nameEn: 'Luxury Villa - Zone 1',
      clientId: client1.id, contractorId: contractor1.id, location: 'دبي، المنطقة الأولى',
      plotNumber: 'DXB-LOT-1203', type: 'VILLA', status: 'ACTIVE', progress: 65, budget: 250000,
      startDate: monthsAgo(14), endDate: monthsFromNow(2),
      description: 'تصميم وبناء فيلا فاخرة مكونة من طابقين مع حمام سباحة وحديقة',
      createdById: adminUser.id, organizationId: org1.id,
    },
  });
  const project2 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-002`, name: 'مبنى سكني متعدد الطوابق', nameEn: 'Multi-Story Residential Building',
      clientId: client2.id, contractorId: contractor3.id, location: 'أبو ظبي، شاطئ الراحة',
      plotNumber: 'ADH-LOT-7892', type: 'BUILDING', status: 'ACTIVE', progress: 40, budget: 850000,
      startDate: monthsAgo(12), endDate: monthsFromNow(6),
      description: 'مبنى سكني من 12 طابق مع مواقف سيارات تحت الأرض ومرافق مشتركة',
      createdById: pmUser.id, organizationId: org1.id,
    },
  });
  const project3 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-003`, name: 'مجمع تجاري - المنطقة الحرة', nameEn: 'Commercial Complex - Free Zone',
      clientId: client3.id, contractorId: contractor2.id, location: 'رأس الخيمة، المنطقة الحرة',
      plotNumber: 'RKN-LOT-4521', type: 'COMMERCIAL', status: 'ACTIVE', progress: 20, budget: 1200000,
      startDate: monthsAgo(8), endDate: monthsFromNow(12),
      description: 'مجمع تجاري متعدد الاستخدامات يشمل محلات ومكاتب ومنطقة ترفيهية',
      createdById: pmUser.id, organizationId: org1.id,
    },
  });
  const project4 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-004`, name: 'فيلا عائلية - المنطقة السكنية', nameEn: 'Family Villa - Residential Area',
      clientId: client4.id, contractorId: contractor4.id, location: 'الشارقة، المنطقة السكنية الجديدة',
      plotNumber: 'SHJ-LOT-0567', type: 'VILLA', status: 'COMPLETED', progress: 100, budget: 180000,
      startDate: monthsAgo(20), endDate: monthsAgo(10),
      description: 'فيلا عائلية من طابق واحد مع حديقة ومرآب',
      createdById: adminUser.id, organizationId: org1.id,
    },
  });
  const project5 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-005`, name: 'منشأة صناعية - منطقة الصناعات', nameEn: 'Industrial Facility - Industrial Zone',
      clientId: client2.id, location: 'رأس الخيمة، منطقة الصناعات',
      plotNumber: 'RAK-LOT-3311', type: 'INDUSTRIAL', status: 'DELAYED', progress: 35, budget: 600000,
      startDate: monthsAgo(12), endDate: monthsAgo(0),
      description: 'مصنع متعدد الأغراض مع مستودعات ومنطقة تحميل',
      createdById: adminUser.id, organizationId: org1.id,
    },
  });
  // Additional 5 projects
  const project6 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-006`, name: 'مبنى حكومي - بلدية رأس الخيمة', nameEn: 'Government Building - RAK Municipality',
      clientId: client5.id, location: 'رأس الخيمة', plotNumber: 'RAK-GOV-0098',
      type: 'COMMERCIAL', status: 'ON_HOLD', progress: 15, budget: 950000,
      startDate: monthsAgo(9), endDate: monthsFromNow(8),
      description: 'مبنى إداري حكومي - بلدية رأس الخيمة',
      createdById: adminUser.id, organizationId: org1.id, managerId: pmUser.id, expectedDuration: 540,
    },
  });
  const project7 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-007`, name: 'مجمع سكني - مؤسسة الإمارات', nameEn: 'Residential Complex - Emirates Foundation',
      clientId: client6.id, location: 'أبو ظبي', plotNumber: 'ADH-RES-2345',
      type: 'BUILDING', status: 'ACTIVE', progress: 82, budget: 1400000,
      startDate: monthsAgo(15), endDate: monthsAgo(1),
      description: 'مجمع سكني متعدد المباني - 3 مباني 8 طوابق',
      createdById: pmUser.id, organizationId: org1.id, managerId: engineerUser.id, expectedDuration: 390,
      contractorId: contractor1.id,
    },
  });
  const project8 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-008`, name: 'فيلا عبدالله المنصوري', nameEn: 'Al Mansoori Villa',
      clientId: client7.id, location: 'عجمان', plotNumber: 'AJM-VIL-0678',
      type: 'VILLA', status: 'ACTIVE', progress: 45, budget: 320000,
      startDate: monthsAgo(11), endDate: monthsFromNow(1),
      description: 'فيلا فاخرة من طابقين مع حديقة ومسبح',
      createdById: adminUser.id, organizationId: org2.id, managerId: pmUser.id, expectedDuration: 365,
      contractorId: contractor1.id,
    },
  });
  const project9 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-009`, name: 'مشروع الفجيرة التجاري', nameEn: 'Fujairah Commercial Project',
      clientId: client9.id, location: 'الفجيرة', plotNumber: 'FUJ-COM-0334',
      type: 'COMMERCIAL', status: 'ACTIVE', progress: 5, budget: 750000,
      startDate: monthsAgo(3), endDate: monthsFromNow(15),
      description: 'مشروع تجاري جديد - مرحلة التخطيط',
      createdById: adminUser.id, organizationId: org2.id, managerId: pmUser.id, expectedDuration: 540,
    },
  });
  const project10 = await db.project.create({
    data: {
      number: `PRJ-${currentYearStr}-010`, name: 'مشروع الأشغال العامة', nameEn: 'Public Works Project',
      clientId: client10.id, location: 'رأس الخيمة', plotNumber: 'RAK-PUB-0567',
      type: 'INDUSTRIAL', status: 'ACTIVE', progress: 30, budget: 2100000,
      startDate: monthsAgo(10), endDate: monthsFromNow(14),
      description: 'مشروع إنشائي حكومي - مرفق عام',
      createdById: adminUser.id, organizationId: org2.id, managerId: pmUser.id, expectedDuration: 730,
      contractorId: contractor3.id,
    },
  });
  console.info('✅ 10 projects created');

  // ========== 7. Project Assignments (13 from prisma/seed.ts) ==========
  const assignments = [
    { projectId: project1.id, userId: pmUser.id, role: 'MANAGER' as const , organizationId: org1.id },
    { projectId: project1.id, userId: engineerUser.id, role: 'TEAM_MEMBER' as const , organizationId: org1.id },
    { projectId: project1.id, userId: structuralUser.id, role: 'TEAM_MEMBER' as const , organizationId: org1.id },
    { projectId: project1.id, userId: mepUser.id, role: 'TEAM_MEMBER' as const , organizationId: org1.id },
    { projectId: project2.id, userId: pmUser.id, role: 'MANAGER' as const , organizationId: org1.id },
    { projectId: project2.id, userId: engineerUser.id, role: 'TEAM_MEMBER' as const , organizationId: org1.id },
    { projectId: project2.id, userId: structuralUser.id, role: 'TEAM_MEMBER' as const , organizationId: org1.id },
    { projectId: project3.id, userId: pmUser.id, role: 'MANAGER' as const , organizationId: org1.id },
    { projectId: project3.id, userId: engineerUser.id, role: 'TEAM_MEMBER' as const , organizationId: org1.id },
    { projectId: project3.id, userId: mepUser.id, role: 'TEAM_MEMBER' as const , organizationId: org1.id },
    { projectId: project4.id, userId: adminUser.id, role: 'MANAGER' as const , organizationId: org1.id },
    { projectId: project5.id, userId: pmUser.id, role: 'MANAGER' as const , organizationId: org1.id },
    { projectId: project5.id, userId: structuralUser.id, role: 'TEAM_MEMBER' as const , organizationId: org1.id },
  ];
  for (const assignment of assignments) {
    await db.projectAssignment.create({ data: assignment });
  }
  console.info('✅ 13 project assignments created');

  // ========== 8. Tasks (9 base + 12 additional = 21+) ==========
  await db.task.createMany({
    data: [
      // Base tasks — in_progress
      { projectId: project1.id, title: 'إعداد المخططات المعمارية النهائية', description: 'مراجعة وإكمال جميع المخططات المعمارية للفيلا', assigneeId: engineerUser.id, priority: 'HIGH', status: 'IN_PROGRESS', startDate: monthsAgo(2), dueDate: daysFromNow(15), progress: 70 , organizationId: org1.id },
      { projectId: project1.id, title: 'تصميم مخططات الأساسات', description: 'تصميم مخططات الأساسات بناءً على تقرير التربة', assigneeId: structuralUser.id, priority: 'HIGH', status: 'IN_PROGRESS', startDate: monthsAgo(3), dueDate: daysFromNow(10), progress: 50 , organizationId: org1.id },
      // todo tasks
      { projectId: project1.id, title: 'تصميم نظام التكييف المركزي', description: 'إعداد مخططات ونظام التكييف المركزي للفيلا', assigneeId: mepUser.id, priority: 'MEDIUM', status: 'TODO', startDate: daysFromNow(3), dueDate: daysFromNow(30), progress: 0 , organizationId: org1.id },
      { projectId: project1.id, title: 'تقديم المستندات للبلدية', description: 'تجهيز وتقديم جميع المستندات المطلوبة للبلدية', assigneeId: pmUser.id, priority: 'URGENT', status: 'TODO', startDate: daysFromNow(5), dueDate: daysFromNow(20), progress: 0, taskType: 'GOVERNMENTAL' , organizationId: org1.id },
      // in_progress tasks
      { projectId: project2.id, title: 'إعداد المخططات الأولية', description: 'إعداد المخططات المعمارية الأولية للمبنى السكني', assigneeId: engineerUser.id, priority: 'HIGH', status: 'IN_PROGRESS', startDate: monthsAgo(1), dueDate: daysFromNow(20), progress: 60 , organizationId: org1.id },
      { projectId: project2.id, title: 'دراسة التربة والأساسات', description: 'إجراء دراسة التربة وتصميم نظام الأساسات', assigneeId: structuralUser.id, priority: 'HIGH', status: 'IN_PROGRESS', startDate: monthsAgo(2), dueDate: daysFromNow(30), progress: 30 , organizationId: org1.id },
      // todo task
      { projectId: project2.id, title: 'تصميم الأنظمة الكهربائية', description: 'تصميم جميع الأنظمة الكهربائية للمبنى', assigneeId: mepUser.id, priority: 'MEDIUM', status: 'TODO', startDate: daysFromNow(7), dueDate: daysFromNow(25), progress: 0 , organizationId: org1.id },
      // in_progress task
      { projectId: project3.id, title: 'مفهوم التصميم التجاري', description: 'إعداد مفهوم التصميم للمجمع التجاري', assigneeId: engineerUser.id, priority: 'HIGH', status: 'IN_PROGRESS', startDate: monthsAgo(1), dueDate: daysFromNow(5), progress: 40 , organizationId: org1.id },
      { projectId: project5.id, title: 'مراجعة التصميم الإنشائي', description: 'مراجعة وتحديث التصميم الإنشائي للمنشأة', assigneeId: structuralUser.id, priority: 'URGENT', status: 'IN_PROGRESS', startDate: monthsAgo(3), dueDate: daysFromNow(7), progress: 25 , organizationId: org1.id },

      // GOVERNMENTAL tasks
      { projectId: project5.id, title: 'تجديد رخصة البناء البلدية', titleAr: 'تجديد رخصة البناء البلدية', description: 'تقديم طلب تجديد رخصة البناء لدى بلدية رأس الخيمة مع المستندات المطلوبة', assigneeId: secUser.id, priority: 'URGENT', status: 'IN_PROGRESS', startDate: monthsAgo(1), dueDate: daysFromNow(10), progress: 40, taskType: 'GOVERNMENTAL', slaDays: 15, estimatedHours: 20 , organizationId: org1.id },
      { projectId: project6.id, title: 'تقديم المخططات للجهات الحكومية', titleAr: 'تقديم المخططات للجهات الحكومية', description: 'تقديم المخططات المعتمدة لبلدية رأس الخيمة والدفاع المدني', assigneeId: pmUser.id, priority: 'HIGH', status: 'TODO', startDate: daysFromNow(2), dueDate: daysFromNow(20), progress: 0, taskType: 'GOVERNMENTAL', slaDays: 20, estimatedHours: 30 , organizationId: org1.id },

      // MANDATORY tasks
      { projectId: project2.id, title: 'الحصول على شهادة الدفاع المدني', titleAr: 'الحصول على شهادة الدفاع المدني', description: 'إكمال متطلبات الدفاع المدني الإلزامية للحصول على شهادة المطابقة', assigneeId: siteUser.id, priority: 'HIGH', status: 'IN_PROGRESS', startDate: monthsAgo(1), dueDate: daysFromNow(15), progress: 60, taskType: 'MANDATORY', slaDays: 30, estimatedHours: 40 , organizationId: org1.id },
      { projectId: project1.id, title: 'فحص الأساسات الإلزامي', titleAr: 'فحص الأساسات الإلزامي', description: 'الفحص الإلزامي للأساسات قبل صب الخرسانة', assigneeId: structuralUser.id, priority: 'URGENT', status: 'TODO', startDate: daysFromNow(1), dueDate: daysFromNow(7), progress: 0, taskType: 'MANDATORY', estimatedHours: 8 , organizationId: org1.id },

      // CLIENT approval tasks
      { projectId: project3.id, title: 'موافقة العميل على التصميم النهائي', titleAr: 'موافقة العميل على التصميم النهائي', description: 'إرسال التصميم النهائي للعميل للموافقة قبل تقديمه للبلدية', assigneeId: engineerUser.id, priority: 'HIGH', status: 'IN_PROGRESS', startDate: monthsAgo(1), dueDate: daysFromNow(3), progress: 50, taskType: 'CLIENT', estimatedHours: 4 , organizationId: org1.id },

      // STANDARD tasks
      { projectId: project7.id, title: 'إعداد كمية الحصر (BOQ)', titleAr: 'إعداد كمية الحصر', description: 'إعداد جدول كميات الحصر للمشروع السكني', assigneeId: accUser.id, priority: 'MEDIUM', status: 'IN_PROGRESS', startDate: monthsAgo(1), dueDate: daysFromNow(10), progress: 35, taskType: 'STANDARD', estimatedHours: 60 , organizationId: org1.id },
      // review task
      { projectId: project8.id, title: 'مراجعة مخططات MEP', titleAr: 'مراجعة مخططات MEP', description: 'مراجعة شاملة لمخططات الكهرباء والميكانيكا والسباكة', assigneeId: mepUser.id, priority: 'HIGH', status: 'REVIEW', startDate: monthsAgo(1), dueDate: daysFromNow(3), progress: 85, taskType: 'STANDARD', estimatedHours: 25 , organizationId: org1.id },
      // todo task
      { projectId: project9.id, title: 'دراسة جدوى المشروع', titleAr: 'دراسة جدوى المشروع', description: 'إعداد دراسة جدوى تفصيلية للمشروع التجاري الجديد', assigneeId: pmUser.id, priority: 'MEDIUM', status: 'TODO', startDate: daysFromNow(0), dueDate: daysFromNow(30), progress: 0, taskType: 'STANDARD', estimatedHours: 80 , organizationId: org1.id },

      // INTERNAL task
      { projectId: project1.id, title: 'تحديث نظام إدارة الجودة', titleAr: 'تحديث نظام إدارة الجودة', description: 'مراجعة وتحديث إجراءات إدارة الجودة الداخلية', assigneeId: adminUser.id, priority: 'NORMAL', status: 'TODO', startDate: daysFromNow(5), dueDate: daysFromNow(25), progress: 0, taskType: 'INTERNAL', estimatedHours: 15 , organizationId: org1.id },

      // Done task
      { projectId: project4.id, title: 'أرشفة مستندات المشروع المكتمل', titleAr: 'أرشفة مستندات المشروع المكتمل', description: 'أرشفة جميع المستندات والمخططات للمشروع المكتمل', assigneeId: secUser.id, priority: 'NORMAL', status: 'DONE', startDate: monthsAgo(3), dueDate: monthsAgo(2), endDate: monthsAgo(2), progress: 100, taskType: 'STANDARD', estimatedHours: 10, actualHours: 12 , organizationId: org1.id },

      // Milestone task
      { projectId: project7.id, title: 'تسليم المرحلة الأولى - الهيكل الخرساني', titleAr: 'تسليم المرحلة الأولى', description: 'تسليم المرحلة الأولى من المشروع - اكتمال الهيكل الخرساني', assigneeId: structuralUser.id, priority: 'HIGH', status: 'IN_PROGRESS', startDate: monthsAgo(6), dueDate: daysFromNow(30), progress: 75, taskType: 'STANDARD', isMilestone: true, estimatedHours: 200 , organizationId: org1.id },
    ],
  });
  console.info('✅ 21 tasks created');

  // ========== 9. Project Stages (10 from src/lib/seed.ts) ==========
  const stages = [
    { projectId: project1.id, department: 'ARCHITECTURAL' as const, stageName: 'مفهوم التصميم', stageOrder: 1, status: 'APPROVED' as const , organizationId: org1.id },
    { projectId: project1.id, department: 'ARCHITECTURAL' as const, stageName: 'تطوير المخططات', stageOrder: 2, status: 'IN_PROGRESS' as const , organizationId: org1.id },
    { projectId: project1.id, department: 'ARCHITECTURAL' as const, stageName: 'المستندات الأولية', stageOrder: 3, status: 'NOT_STARTED' as const , organizationId: org1.id },
    { projectId: project1.id, department: 'ARCHITECTURAL' as const, stageName: 'التصيير ثلاثي الأبعاد', stageOrder: 4, status: 'NOT_STARTED' as const , organizationId: org1.id },
    { projectId: project1.id, department: 'STRUCTURAL' as const, stageName: 'تقرير التربة', stageOrder: 1, status: 'APPROVED' as const , organizationId: org1.id },
    { projectId: project1.id, department: 'STRUCTURAL' as const, stageName: 'مخطط الأساسات', stageOrder: 2, status: 'IN_PROGRESS' as const , organizationId: org1.id },
    { projectId: project1.id, department: 'STRUCTURAL' as const, stageName: 'العتلات والأعمدة', stageOrder: 3, status: 'NOT_STARTED' as const , organizationId: org1.id },
    { projectId: project2.id, department: 'ARCHITECTURAL' as const, stageName: 'مفهوم التصميم', stageOrder: 1, status: 'APPROVED' as const , organizationId: org1.id },
    { projectId: project2.id, department: 'ARCHITECTURAL' as const, stageName: 'تطوير المخططات', stageOrder: 2, status: 'IN_PROGRESS' as const , organizationId: org1.id },
    { projectId: project2.id, department: 'STRUCTURAL' as const, stageName: 'تقرير التربة', stageOrder: 1, status: 'IN_PROGRESS' as const , organizationId: org1.id },
  ];
  for (const stage of stages) {
    await db.projectStage.create({ data: stage });
  }
  console.info('✅ 10 project stages created');

  // ========== 10. Schedule Phases (9 from src/lib/seed.ts) ==========
  const schedulePhases = [
    { projectId: project1.id, section: 'architectural', phaseOrder: 1, phaseName: 'المخطط المبدئي', duration: 14, maxDuration: 21, status: 'COMPLETED' as const, startDate: monthsAgo(14), endDate: monthsAgo(13, 15) , organizationId: org1.id },
    { projectId: project1.id, section: 'architectural', phaseOrder: 2, phaseName: 'تطوير التصميم', duration: 30, maxDuration: 50, status: 'IN_PROGRESS' as const, startDate: monthsAgo(13, 15), endDate: monthsAgo(11) , organizationId: org1.id },
    { projectId: project1.id, section: 'architectural', phaseOrder: 3, phaseName: 'المخططات النهائية', duration: 25, maxDuration: 40, status: 'NOT_STARTED' as const , organizationId: org1.id },
    { projectId: project1.id, section: 'architectural', phaseOrder: 4, phaseName: 'الموافقة البلدية', duration: 30, maxDuration: 50, status: 'NOT_STARTED' as const , organizationId: org1.id },
    { projectId: project1.id, section: 'structural', phaseOrder: 1, phaseName: 'دراسة التربة', duration: 10, maxDuration: 21, status: 'COMPLETED' as const, startDate: monthsAgo(14), endDate: monthsAgo(13, 25) , organizationId: org1.id },
    { projectId: project1.id, section: 'structural', phaseOrder: 2, phaseName: 'تصميم الأساسات', duration: 20, maxDuration: 35, status: 'IN_PROGRESS' as const, startDate: monthsAgo(13, 26), endDate: monthsAgo(12, 14) , organizationId: org1.id },
    { projectId: project1.id, section: 'structural', phaseOrder: 3, phaseName: 'تصميم الهيكل', duration: 25, maxDuration: 40, status: 'NOT_STARTED' as const , organizationId: org1.id },
    { projectId: project1.id, section: 'governmental', phaseOrder: 1, phaseName: 'تقديم البلدية', duration: 5, maxDuration: 7, status: 'COMPLETED' as const, startDate: monthsAgo(12, 15), endDate: monthsAgo(12, 20) , organizationId: org1.id },
    { projectId: project1.id, section: 'governmental', phaseOrder: 2, phaseName: 'مراجعة البلدية', duration: 30, maxDuration: 50, status: 'IN_PROGRESS' as const, startDate: monthsAgo(12, 21), endDate: monthsAgo(11, 22) , organizationId: org1.id },
  ];
  for (const phase of schedulePhases) {
    await db.schedulePhase.create({ data: phase });
  }
  console.info('✅ 9 schedule phases created');

  // ========== 11. BOQ Items (5 from src/lib/seed.ts) ==========
  await db.bOQItem.createMany({
    data: [
      { projectId: project1.id, code: 'CIV-001', description: 'حفر أساسات', unit: 'م³', quantity: 250, unitPrice: 45, total: 11250, category: 'CIVIL' , organizationId: org1.id },
      { projectId: project1.id, code: 'CIV-002', description: 'صب خرسانة للأساسات', unit: 'م³', quantity: 180, unitPrice: 280, total: 50400, category: 'CIVIL' , organizationId: org1.id },
      { projectId: project1.id, code: 'STL-001', description: 'حديد تسليح #12-32', unit: 'طن', quantity: 35, unitPrice: 3500, total: 122500, category: 'STRUCTURAL' , organizationId: org1.id },
      { projectId: project1.id, code: 'FIN-001', description: 'بلاط أرضيات رخام', unit: 'م²', quantity: 450, unitPrice: 180, total: 81000, category: 'FINISHING' , organizationId: org1.id },
      { projectId: project1.id, code: 'ELC-001', description: 'لوحة توزيع رئيسية', unit: 'لوحة', quantity: 1, unitPrice: 8500, total: 8500, category: 'ELECTRICAL' , organizationId: org1.id },
    ],
  });
  console.info('✅ 5 BOQ items created');

  // ========== 12. Invoices (15) ==========
  await db.invoice.createMany({
    data: [
      // INV-001 (paid) — WITHIN last 6 months so revenue shows!
      { number: `INV-${currentYearStr}-001`, clientId: client1.id, projectId: project1.id, issueDate: monthsAgo(4), dueDate: monthsAgo(3), subtotal: 62500, tax: 3750, total: 66250, paidAmount: 66250, remaining: 0, status: 'PAID' , organizationId: org1.id },
      // INV-002 (partially_paid) — WITHIN last 6 months
      { number: `INV-${currentYearStr}-002`, clientId: client1.id, projectId: project1.id, issueDate: monthsAgo(2), dueDate: monthsAgo(1), subtotal: 62500, tax: 3750, total: 66250, paidAmount: 33250, remaining: 33000, status: 'PARTIALLY_PAID' , organizationId: org1.id },
      // INV-003 (overdue)
      { number: `INV-${currentYearStr}-003`, clientId: client2.id, projectId: project2.id, issueDate: monthsAgo(3), dueDate: monthsAgo(2), subtotal: 170000, tax: 10200, total: 180200, paidAmount: 0, remaining: 180200, status: 'OVERDUE' , organizationId: org1.id },
      // INV-004 (sent)
      { number: `INV-${currentYearStr}-004`, clientId: client2.id, projectId: project5.id, issueDate: monthsAgo(1), dueDate: daysFromNow(15), subtotal: 100000, tax: 6000, total: 106000, paidAmount: 0, remaining: 106000, status: 'SENT' , organizationId: org1.id },
      // INV-005 (draft)
      { number: `INV-${currentYearStr}-005`, clientId: client3.id, projectId: project3.id, issueDate: daysFromNow(0), dueDate: daysFromNow(30), subtotal: 150000, tax: 9000, total: 159000, paidAmount: 0, remaining: 159000, status: 'DRAFT' , organizationId: org1.id },
      // INV-006 (paid) — WITHIN last 6 months!
      { number: `INV-${currentYearStr}-006`, clientId: client4.id, projectId: project4.id, issueDate: monthsAgo(5), dueDate: monthsAgo(4), subtotal: 180000, tax: 10800, total: 190800, paidAmount: 190800, remaining: 0, status: 'PAID' , organizationId: org1.id },
      
      // New Invoices for Demo
      { number: `INV-${currentYearStr}-007`, clientId: client4.id, projectId: project4.id, issueDate: monthsAgo(1), dueDate: daysFromNow(10), subtotal: 45000, tax: 2250, total: 47250, paidAmount: 0, remaining: 47250, status: 'SENT' , organizationId: org1.id },
      { number: `INV-${currentYearStr}-008`, clientId: client5.id, projectId: project5.id, issueDate: monthsAgo(3), dueDate: monthsAgo(2), subtotal: 120000, tax: 6000, total: 126000, paidAmount: 126000, remaining: 0, status: 'PAID' , organizationId: org1.id },
      { number: `INV-${currentYearStr}-009`, clientId: client6.id, projectId: project6.id, issueDate: monthsAgo(6), dueDate: monthsAgo(5), subtotal: 250000, tax: 12500, total: 262500, paidAmount: 262500, remaining: 0, status: 'PAID' , organizationId: org1.id },
      { number: `INV-${currentYearStr}-010`, clientId: client7.id, projectId: project7.id, issueDate: monthsAgo(2), dueDate: monthsAgo(1), subtotal: 80000, tax: 4000, total: 84000, paidAmount: 40000, remaining: 44000, status: 'PARTIALLY_PAID' , organizationId: org1.id },
      { number: `INV-${currentYearStr}-011`, clientId: client8.id, projectId: project8.id, issueDate: monthsAgo(4), dueDate: monthsAgo(3), subtotal: 95000, tax: 4750, total: 99750, paidAmount: 0, remaining: 99750, status: 'OVERDUE' , organizationId: org1.id },
      { number: `INV-${currentYearStr}-012`, clientId: client9.id, projectId: project9.id, issueDate: daysFromNow(-5), dueDate: daysFromNow(25), subtotal: 35000, tax: 1750, total: 36750, paidAmount: 0, remaining: 36750, status: 'SENT' , organizationId: org1.id },
      { number: `INV-${currentYearStr}-013`, clientId: client10.id, projectId: project10.id, issueDate: daysFromNow(2), dueDate: daysFromNow(32), subtotal: 200000, tax: 10000, total: 210000, paidAmount: 0, remaining: 210000, status: 'DRAFT' , organizationId: org1.id },
      { number: `INV-${currentYearStr}-014`, clientId: client1.id, projectId: project1.id, issueDate: monthsAgo(1), dueDate: daysFromNow(15), subtotal: 15000, tax: 750, total: 15750, paidAmount: 15750, remaining: 0, status: 'PAID' , organizationId: org1.id },
      { number: `INV-${currentYearStr}-015`, clientId: client2.id, projectId: project2.id, issueDate: monthsAgo(2), dueDate: monthsAgo(1), subtotal: 55000, tax: 2750, total: 57750, paidAmount: 0, remaining: 57750, status: 'OVERDUE' , organizationId: org1.id },
    ],
  });
  console.info('✅ 15 invoices created');

  // ========== 13. Contracts (3) ==========
  await db.contract.createMany({
    data: [
      { number: `CTR-${currentYearStr}-001`, title: 'عقد تصميم فيلا المنطقة الأولى', clientId: client1.id, projectId: project1.id, value: 250000, type: 'ENGINEERING_SERVICES', status: 'ACTIVE', signedByName: 'محمد بن راشد', signedByTitle: 'المدير التنفيذي', startDate: monthsAgo(14), endDate: monthsFromNow(2) , organizationId: org1.id },
      { number: `CTR-${currentYearStr}-002`, title: 'عقد تصميم المبنى السكني', clientId: client2.id, projectId: project2.id, value: 850000, type: 'ENGINEERING_SERVICES', status: 'ACTIVE', signedByName: 'أحمد الشامسي', signedByTitle: 'رئيس مجلس الإدارة', startDate: monthsAgo(12), endDate: monthsFromNow(6) , organizationId: org1.id },
      { number: `CTR-${currentYearStr}-003`, title: 'عقد الاستشارات الهندسية - المجمع التجاري', clientId: client3.id, projectId: project3.id, value: 1200000, type: 'CONSULTING', status: 'PENDING_SIGNATURE', signedByName: 'سعاد الكتبي', signedByTitle: 'مديرة التطوير', startDate: monthsAgo(8), endDate: monthsFromNow(12) , organizationId: org1.id },
    ],
  });
  console.info('✅ 3 contracts created');

  // ========== 14. Site Visits (3 - most detailed with gateDescription, neighborDesc) ==========
  await db.siteVisit.createMany({
    data: [
      { projectId: project1.id, date: monthsAgo(2), plotNumber: 'RKN-LOT-4521', municipality: 'DUBAI', gateDescription: 'بوابة رئيسية من الشارع مع باب جانبي', neighborDesc: 'فيلا مجاورة من الجهة الشرقية وأرض فارغة غرباً', buildingDesc: 'أرض فضاء 800م² مع أساسات خرسانية قديمة', status: 'APPROVED' , organizationId: org1.id },
      { projectId: project2.id, date: monthsAgo(1), plotNumber: 'ADH-LOT-7892', municipality: 'ABU_DHABI', gateDescription: 'مدخل رئيسي من شارعين', neighborDesc: 'مبنى سكني شمالاً ومحل تجاري جنوباً', buildingDesc: 'أرض 2500م² مسطحة مع خدمات أساسية', status: 'SUBMITTED' , organizationId: org1.id },
      { projectId: project5.id, date: monthsAgo(3), plotNumber: 'RAK-LOT-3311', municipality: 'RAS_AL_KHAIMAH', gateDescription: 'بوابة صناعية مع منطقة تحميل', neighborDesc: 'مصنعان مجاوران من الجهة الشرقية والغربية', buildingDesc: 'أرض صناعية 5000م² مع مباني مخازن قديمة', status: 'APPROVED' , organizationId: org1.id },
    ],
  });
  console.info('✅ 3 site visits created');

  // ========== 15. Site Diaries (2 - most detailed) ==========
  await db.siteDiary.createMany({
    data: [
      { projectId: project1.id, date: monthsAgo(1), weather: 'HOT', workerCount: 12, workDescription: 'صب الخرسانة للأساسات - المرحلة الثانية', issues: 'تأخر وصول الحديد ساعة واحدة', safetyNotes: 'تم التأكد من معدات السلامة لجميع العمال', equipment: 'خلاطة خرسانة، رافعة برجية', materials: '50 طن حديد تسليح، 120 م³ خرسانة' , organizationId: org1.id },
      { projectId: project2.id, date: monthsAgo(1, 12), weather: 'PARTLY_CLOUDY', workerCount: 8, workDescription: 'الحفر وتجهيز موقع الأساسات', issues: 'تم اكتشاف صخور صلبة في المنطقة الشرقية', safetyNotes: 'تم إيقاف العمل مؤقتاً بسبب هطول أمطار خفيفة', equipment: 'حفارة، شاحنة نقل', materials: 'لا يوجد' , organizationId: org1.id },
    ],
  });
  console.info('✅ 2 site diaries created');

  // ========== 16. Meetings (3 - with notes) ==========
  await db.meeting.createMany({
    data: [
      { projectId: project1.id, title: 'اجتماع مراجعة التصميم المعماري', date: daysFromNow(2), time: '10:00', duration: 90, location: 'مكتب بلوبرنت - غرفة الاجتماعات', type: 'ONSITE', notes: 'مراجعة المخططات المعمارية مع العميل' , organizationId: org1.id },
      { projectId: project2.id, title: 'اجتماع متابعة المشروع', date: daysFromNow(5), time: '14:00', duration: 60, location: 'أونلاين - Zoom', type: 'ONLINE', notes: 'متابعة تقدم المشروع ومناقشة التحديات' , organizationId: org1.id },
      { title: 'اجتماع الفريق الأسبوعي', date: daysFromNow(1), time: '09:00', duration: 45, location: 'مكتب بلوبرنت', type: 'ONSITE', notes: 'مراجعة أحمال العمل والمهام الأسبوعية', organizationId: org1.id },
    ],
  });
  console.info('✅ 3 meetings created');

  // ========== 17. Suppliers (3) ==========
  await db.supplier.createMany({
    data: [
      { name: 'شركة الخليج للمواد الإنشائية', category: 'MATERIALS', email: 'sales@gulf-concrete.ae', phone: '+971-7-222-3344', address: 'رأس الخيمة', rating: 4, creditLimit: 200000 , organizationId: org1.id },
      { name: 'الأفق لأنظمة التكييف', category: 'EQUIPMENT', email: 'info@alofaq-ac.ae', phone: '+971-4-333-4455', address: 'دبي', rating: 5, creditLimit: 350000 , organizationId: org1.id },
      { name: 'النور للأنظمة الكهربائية', category: 'MATERIALS', email: 'orders@alnoor-electric.ae', phone: '+971-2-444-5566', address: 'أبو ظبي', rating: 4, creditLimit: 150000 , organizationId: org1.id },
    ],
  });
  console.info('✅ 3 suppliers created');

  // ========== 18. Government Approvals (3) ==========
  await db.govApproval.createMany({
    data: [
      { projectId: project1.id, authority: 'MUN', status: 'SUBMITTED', submissionDate: monthsAgo(1) , organizationId: org1.id },
      { projectId: project2.id, authority: 'MUN', status: 'PENDING' , organizationId: org1.id },
      { projectId: project1.id, authority: 'FEWA', status: 'PENDING' , organizationId: org1.id },
    ],
  });
  console.info('✅ 3 government approvals created');

  // ========== 19. Knowledge Articles (3) ==========
  await db.knowledgeArticle.createMany({
    data: [
      { title: 'دليل إعداد مستندات البلدية', content: 'خطوات إعداد وتقديم المستندات المطلوبة للموافقة البلدية في الإمارات...', category: 'guide', tags: 'بلدية,موافقات,مستندات', views: 45, authorId: adminUser.id , organizationId: org1.id },
      { title: 'معايير تصميم الفلل في دبي', content: 'المتطلبات والمعايير الخاصة بتصميم الفلل وفقاً لأنظمة بلدية دبي...', category: 'guide', tags: 'فلل,تصميم,دبي,معايير', views: 32, authorId: engineerUser.id , organizationId: org1.id },
      { title: 'الأسئلة الشائعة حول أنظمة الدفاع المدني', content: 'إجابات على الأسئلة الأكثر شيوعاً حول متطلبات الدفاع المدني...', category: 'faq', tags: 'دفاع_مدني,سلامة,أسئلة', views: 28, authorId: mepUser.id , organizationId: org1.id },
    ],
  });
  console.info('✅ 3 knowledge articles created');

  // ========== 20. Proposals (1 - with notes) ==========
  await db.proposal.createMany({
    data: [
      { number: `PRP-${currentYearStr}-001`, clientId: client3.id, projectId: project3.id, subtotal: 1200000, tax: 72000, total: 1272000, status: 'SENT', notes: 'عرض أسعار شامل التصميم والإشراف' , organizationId: org1.id },
    ],
  });
  console.info('✅ 1 proposal created');

  // ========== 21. Notifications (5) ==========
  await db.notification.createMany({
    data: [
      { userId: adminUser.id, type: 'INVOICE_OVERDUE', title: 'فاتورة متأخرة', message: `فاتورة INV-${currentYearStr}-003 تجاوزت تاريخ الاستحقاق - 180,200 درهم`, isRead: false, relatedEntityType: 'invoice', createdAt: new Date(Date.now() - 2 * 86400000), organizationId: org1.id },
      { userId: adminUser.id, type: 'APPROVAL_NEEDED', title: 'موافقة مطلوبة', message: 'طلب إجازة من سارة علي بانتظار موافقتك', isRead: false, relatedEntityType: 'leave', createdAt: new Date(Date.now() - 86400000) , organizationId: org1.id },
      { userId: adminUser.id, type: 'TASK_DUE', title: 'مهمة متأخرة', message: 'مهمة مراجعة التصميم الإنشائي تجاوزت الموعد النهائي', isRead: false, relatedEntityType: 'task', createdAt: new Date(Date.now() - 6 * 3600000) , organizationId: org1.id },
      { userId: adminUser.id, type: 'PROJECT_UPDATE', title: 'تحديث المشروع', message: 'تم تحديث تقدم مشروع فيلا فاخرة إلى 65%', isRead: true, relatedEntityType: 'project', relatedEntityId: project1.id, createdAt: new Date(Date.now() - 5 * 86400000), organizationId: org1.id },
      { userId: adminUser.id, type: 'PAYMENT_RECEIVED', title: 'دفعة مستلمة', message: 'تم استلام دفعة 33,250 درهم من شركة الإعمار', isRead: true, relatedEntityType: 'invoice', createdAt: new Date(Date.now() - 7 * 86400000), organizationId: org1.id },
    ],
  });
  console.info('✅ 5 notifications created');

  // ========== 22. Bids (6 from prisma/seed.ts) ==========
  await db.bid.createMany({
    data: [
      { projectId: project1.id, contractorId: contractor1.id, contractorName: contractor1.companyName, amount: 220000, technicalScore: 85, financialScore: 90, totalScore: 87.5, status: 'ACCEPTED', deadline: monthsAgo(14) , organizationId: org1.id },
      { projectId: project1.id, contractorId: contractor4.id, contractorName: contractor4.companyName, amount: 245000, technicalScore: 90, financialScore: 75, totalScore: 82.5, status: 'REJECTED', deadline: monthsAgo(14) , organizationId: org1.id },
      { projectId: project2.id, contractorId: contractor3.id, contractorName: contractor3.companyName, amount: 780000, technicalScore: 88, financialScore: 85, totalScore: 86.5, status: 'ACCEPTED', deadline: monthsAgo(12) , organizationId: org1.id },
      { projectId: project3.id, contractorId: contractor2.id, contractorName: contractor2.companyName, amount: 1100000, technicalScore: 82, financialScore: 88, totalScore: 85, status: 'ACCEPTED', deadline: monthsAgo(8) , organizationId: org1.id },
      { projectId: project5.id, contractorId: contractor1.id, contractorName: contractor1.companyName, amount: 550000, technicalScore: 80, financialScore: 82, totalScore: 81, status: 'SUBMITTED', deadline: monthsAgo(12) , organizationId: org1.id },
      { projectId: project5.id, contractorId: contractor3.id, contractorName: contractor3.companyName, amount: 580000, technicalScore: 85, financialScore: 78, totalScore: 81.5, status: 'SUBMITTED', deadline: monthsAgo(12) , organizationId: org1.id },
    ],
  });
  console.info('✅ 6 bids created');

  // ========== 23. Approvals (5 from prisma/seed.ts) ==========
  await db.approval.createMany({
    data: [
      { projectId: project1.id, entityType: 'invoice', entityId: 'seed-inv-001', title: `موافقة فاتورة INV-${currentYearStr}-007`, description: 'فاتورة خدمات هندسية', status: 'PENDING', requestedBy: 'أحمد المنصوري', assignedTo: 'سعيد الحوسني', step: 1, totalSteps: 2, amount: 45000, createdAt: new Date(now.getTime() - 2 * 3600000) , organizationId: org1.id },
      { projectId: project2.id, entityType: 'purchase_order', entityId: 'seed-po-002', title: `موافقة أمر شراء PO-${currentYearStr}-003`, description: 'مواد بناء', status: 'PENDING', requestedBy: 'خالد الرميثي', assignedTo: 'سعيد الحوسني', step: 2, totalSteps: 3, amount: 128000, createdAt: new Date(now.getTime() - 5 * 3600000) , organizationId: org1.id },
      { entityType: 'leave', entityId: 'seed-leave-003', title: 'موافقة إجازة سنوية', description: 'إجازة 5 أيام', status: 'APPROVED', requestedBy: 'محمد الشامسي', assignedTo: 'أحمد المنصوري', step: 1, totalSteps: 1, amount: 0, notes: 'تمت الموافقة', createdAt: new Date(now.getTime() - 2 * 86400000) , organizationId: org1.id },
      { projectId: project3.id, entityType: 'change_order', entityId: 'seed-co-004', title: `موافقة أمر تغيير CO-${currentYearStr}-001`, description: 'تغيير في التصميم المعماري', status: 'REJECTED', requestedBy: 'فاطمة الكعبي', assignedTo: 'سعيد الحوسني', step: 1, totalSteps: 2, amount: 75000, notes: 'التكلفة مرتفعة', createdAt: new Date(now.getTime() - 4 * 86400000) , organizationId: org1.id },
      { projectId: project1.id, entityType: 'payment', entityId: 'seed-pay-005', title: 'موافقة دفعة مقدمة', description: 'دفعة مقدمة 30%', status: 'PENDING', requestedBy: 'خالد الرميثي', assignedTo: 'أحمد المنصوري', step: 1, totalSteps: 1, amount: 90000, createdAt: new Date(now.getTime() - 12 * 3600000) , organizationId: org1.id },
    ],
  });
  console.info('✅ 5 approvals created');

  // ========== 24. Task Comments (8 from prisma/seed.ts) ==========
  const tasks = await db.task.findMany({ select: { id: true }, take: 10 });
  if (tasks.length >= 4) {
    await db.taskComment.createMany({
      data: [
        { taskId: tasks[0].id, userId: engineerUser.id, content: 'تم مراجعة المخططات الأولية ويحتاج بعض التعديلات على الواجهات', createdAt: new Date(now.getTime() - 3 * 3600000) , organizationId: org1.id },
        { taskId: tasks[0].id, userId: structuralUser.id, content: 'أوافق على التعديلات المطلوبة @أحمد يرجى التحديث', createdAt: new Date(now.getTime() - 2 * 3600000) , organizationId: org1.id },
        { taskId: tasks[0].id, userId: engineerUser.id, content: 'تم تحديث المخططات حسب الملاحظات', createdAt: new Date(now.getTime() - 1 * 3600000) , organizationId: org1.id },
        { taskId: tasks[1].id, userId: structuralUser.id, content: 'التصميم الإنشائي جاهز للمراجعة @سارة', createdAt: new Date(now.getTime() - 8 * 3600000) , organizationId: org1.id },
        { taskId: tasks[1].id, userId: mepUser.id, content: 'تم اعتماد الحسابات من قبل البلدية', createdAt: new Date(now.getTime() - 5 * 3600000) , organizationId: org1.id },
        { taskId: tasks[2].id, userId: engineerUser.id, content: 'تم تقديم الأوراق إلى البلدية بالأمس', createdAt: new Date(now.getTime() - 24 * 3600000) , organizationId: org1.id },
        { taskId: tasks[2].id, userId: pmUser.id, content: 'متى الموعد المتوقع للرد من البلدية؟', createdAt: new Date(now.getTime() - 18 * 3600000) , organizationId: org1.id },
        { taskId: tasks[3].id, userId: structuralUser.id, content: 'تصميم كهرباء المبنى في المراحل النهائية', createdAt: new Date(now.getTime() - 6 * 3600000) , organizationId: org1.id },
      ],
    });
    console.info('✅ 8 task comments created');
  }

  // ========== 25. NEW: Payments (4 linked to invoices) ==========
  await db.payment.createMany({
    data: [
      { projectId: project1.id, voucherNumber: `PAY-${currentYearStr}-001`, amount: 66250, payMethod: 'TRANSFER', beneficiary: 'بلوبرنت للاستشارات الهندسية', referenceNumber: `TRF-${currentYearStr}-001`, status: 'COMPLETED', approvedById: adminUser.id, description: `دفعة فاتورة INV-${currentYearStr}-001 - كامل المبلغ` , organizationId: org1.id },
      { projectId: project1.id, voucherNumber: `PAY-${currentYearStr}-002`, amount: 33250, payMethod: 'CHEQUE', beneficiary: 'بلوبرنت للاستشارات الهندسية', referenceNumber: `CHQ-${currentYearStr}-045`, status: 'COMPLETED', approvedById: adminUser.id, description: `دفعة جزئية فاتورة INV-${currentYearStr}-002` , organizationId: org1.id },
      { projectId: project4.id, voucherNumber: `PAY-${currentYearStr}-003`, amount: 190800, payMethod: 'TRANSFER', beneficiary: 'بلوبرنت للاستشارات الهندسية', referenceNumber: `TRF-${currentYearStr}-003`, status: 'COMPLETED', approvedById: adminUser.id, description: `دفعة فاتورة INV-${currentYearStr}-006 - كامل المبلغ` , organizationId: org1.id },
      { projectId: project2.id, voucherNumber: `PAY-${currentYearStr}-004`, amount: 50000, payMethod: 'TRANSFER', beneficiary: 'شركة الأنظمة الميكانيكية', referenceNumber: `TRF-${currentYearStr}-004`, status: 'PENDING', description: 'دفعة مقدمة للمقاول - أعمال MEP' , organizationId: org1.id },
    ],
  });
  console.info('✅ 4 payments created');

  // ========== 26. NEW: Budgets (2-3 per project) ==========
  await db.budget.createMany({
    data: [
      // Project 1 budgets
      { projectId: project1.id, name: 'الميزانية الإجمالية', category: 'overall', planned: 250000, actual: 162500, committed: 200000, remaining: 50000, deviation: -12500 , organizationId: org1.id },
      { projectId: project1.id, name: 'الأعمال المعمارية', category: 'architectural', planned: 100000, actual: 65000, committed: 80000, remaining: 20000, deviation: -5000 , organizationId: org1.id },
      { projectId: project1.id, name: 'الأعمال الإنشائية', category: 'structural', planned: 90000, actual: 55000, committed: 70000, remaining: 20000, deviation: -5000 , organizationId: org1.id },
      { projectId: project1.id, name: 'الأعمال الكهربائية', category: 'electrical', planned: 60000, actual: 42500, committed: 50000, remaining: 10000, deviation: -2500 , organizationId: org1.id },
      // Project 2 budgets
      { projectId: project2.id, name: 'الميزانية الإجمالية', category: 'overall', planned: 850000, actual: 340000, committed: 500000, remaining: 350000, deviation: 10000 , organizationId: org1.id },
      { projectId: project2.id, name: 'الأعمال المعمارية', category: 'architectural', planned: 350000, actual: 140000, committed: 200000, remaining: 150000, deviation: 5000 , organizationId: org1.id },
      { projectId: project2.id, name: 'الأعمال الإنشائية', category: 'structural', planned: 300000, actual: 120000, committed: 180000, remaining: 120000, deviation: 0 , organizationId: org1.id },
      // Project 3 budgets
      { projectId: project3.id, name: 'الميزانية الإجمالية', category: 'overall', planned: 1200000, actual: 240000, committed: 400000, remaining: 800000, deviation: 0 , organizationId: org1.id },
      { projectId: project3.id, name: 'الأعمال المعمارية', category: 'architectural', planned: 500000, actual: 100000, committed: 150000, remaining: 350000, deviation: 0 , organizationId: org1.id },
      // Project 5 budgets
      { projectId: project5.id, name: 'الميزانية الإجمالية', category: 'overall', planned: 600000, actual: 210000, committed: 350000, remaining: 250000, deviation: -15000 , organizationId: org1.id },
      { projectId: project5.id, name: 'الأعمال الإنشائية', category: 'structural', planned: 250000, actual: 87500, committed: 150000, remaining: 100000, deviation: -5000 , organizationId: org1.id },
    ],
  });
  console.info('✅ 11 budget items created (across 4 projects)');

  // ========== 27. NEW: Defects (4) ==========
  await db.defect.createMany({
    data: [
      { projectId: project1.id, title: 'تشقق في الجدار الشرقي', severity: 'HIGH', location: 'الطابق الأرضي - الجدار الشرقي', assigneeId: structuralUser.id, status: 'IN_PROGRESS', resolutionNotes: 'تم أخذ العينات للتحليل' , organizationId: org1.id },
      { projectId: project2.id, title: 'تسريب مياه في مواقف السيارات', severity: 'MEDIUM', location: 'طابق المواقف B1', assigneeId: mepUser.id, status: 'OPEN' , organizationId: org1.id },
      { projectId: project5.id, title: 'عدم مطابقة خرسانة الأعمدة', severity: 'CRITICAL', location: 'الطابق الثالث - أعمدة C3-C5', assigneeId: structuralUser.id, status: 'OPEN' , organizationId: org1.id },
      { projectId: project7.id, title: 'كسر في بلاط المدخل', severity: 'NORMAL', location: 'المدخل الرئيسي', status: 'RESOLVED', resolutionNotes: 'تم استبدال البلاط التالف' , organizationId: org1.id },
    ],
  });
  console.info('✅ 4 defects created');

  // ========== 28. NEW: RFIs (3) ==========
  await db.rFI.createMany({
    data: [
      { projectId: project1.id, number: 'RFI-001', subject: 'توضيح مواصبات الخرسانة', description: 'نرجو توضيح الدرجة المطلوبة للخرسانة في الأساسات', fromId: structuralUser.id, toId: pmUser.id, priority: 'HIGH', dueDate: daysFromNow(7), status: 'REPLIED', response: 'درجة خرسانة C40 للأساسات كما هو موضح في المواصفات الفنية' , organizationId: org1.id },
      { projectId: project2.id, number: 'RFI-002', subject: 'تعديل مسار الكابلات', description: 'هل يمكن تعديل مسار الكابلات الرئيسية لتجنب التعارض مع أنابيب التكييف', fromId: mepUser.id, toId: engineerUser.id, priority: 'NORMAL', dueDate: daysFromNow(15), status: 'OPEN' , organizationId: org1.id },
      { projectId: project5.id, number: 'RFI-003', subject: 'مواصفات الحديد المستخدم', description: 'نرجو تأكيد نوع وقطر حديد التسليح المستخدم في الأعمدة', fromId: structuralUser.id, toId: pmUser.id, priority: 'URGENT', status: 'OPEN' , organizationId: org1.id },
    ],
  });
  console.info('✅ 3 RFIs created');

  // ========== 29. NEW: Leave Requests (3) ==========
  await db.leave.createMany({
    data: [
      { employeeId: engineerUser.id, type: 'ANNUAL', startDate: daysFromNow(5), endDate: daysFromNow(8), days: 3, reason: 'إجازة سنوية', status: 'PENDING' , organizationId: org1.id },
      { employeeId: structuralUser.id, type: 'SICK', startDate: monthsAgo(1), endDate: monthsAgo(1, 10), days: 1, reason: 'مراجعة طبية', status: 'APPROVED', approvedById: adminUser.id , organizationId: org1.id },
      { employeeId: mepUser.id, type: 'EMERGENCY', startDate: daysFromNow(10), endDate: daysFromNow(12), days: 2, reason: 'ظرف عائلي طارئ', status: 'PENDING' , organizationId: org1.id },
    ],
  });
  console.info('✅ 3 leave requests created');

  // ========== 30. NEW: Documents (2-3 per project) ==========
  await db.document.createMany({
    data: [
      // Project 1 documents
      { projectId: project1.id, name: 'مخطط معماري - الطابق الأرضي.pdf', fileType: 'pdf', fileSize: 2500000, category: 'drawings', version: 3, filePath: '/uploads/prj-001/arch-ground-floor-v3.pdf', uploadedById: engineerUser.id , organizationId: org1.id },
      { projectId: project1.id, name: 'تقرير التربة.pdf', fileType: 'pdf', fileSize: 1200000, category: 'report', version: 1, filePath: '/uploads/prj-001/soil-report.pdf', uploadedById: structuralUser.id , organizationId: org1.id },
      { projectId: project1.id, name: 'عقد التصميم.pdf', fileType: 'pdf', fileSize: 800000, category: 'contract', version: 1, filePath: '/uploads/prj-001/design-contract.pdf', uploadedById: adminUser.id , organizationId: org1.id },
      // Project 2 documents
      { projectId: project2.id, name: 'مخطط إنشائي - الأساسات.pdf', fileType: 'pdf', fileSize: 3100000, category: 'drawings', version: 2, filePath: '/uploads/prj-002/struct-foundation-v2.pdf', uploadedById: structuralUser.id , organizationId: org1.id },
      { projectId: project2.id, name: 'مواصفات الخرسانة.docx', fileType: 'docx', fileSize: 450000, category: 'specs', version: 1, filePath: '/uploads/prj-002/concrete-specs.docx', uploadedById: structuralUser.id , organizationId: org1.id },
      // Project 3 documents
      { projectId: project3.id, name: 'دراسة الجدوى الاقتصادية.pdf', fileType: 'pdf', fileSize: 1800000, category: 'report', version: 1, filePath: '/uploads/prj-003/feasibility-study.pdf', uploadedById: pmUser.id , organizationId: org1.id },
      { projectId: project3.id, name: 'مخطط الموقع العام.pdf', fileType: 'pdf', fileSize: 2200000, category: 'drawings', version: 1, filePath: '/uploads/prj-003/site-plan.pdf', uploadedById: engineerUser.id , organizationId: org1.id },
      // Project 5 documents
      { projectId: project5.id, name: 'تقرير الحسابات الإنشائية.pdf', fileType: 'pdf', fileSize: 900000, category: 'calculations', version: 2, filePath: '/uploads/prj-005/structural-calcs-v2.pdf', uploadedById: structuralUser.id , organizationId: org1.id },
    ],
  });
  console.info('✅ 8 documents created (across 4 projects)');

  // ========== 31. NEW: Client Interactions (3) ==========
  await db.clientInteraction.createMany({
    data: [
      { projectId: project1.id, clientId: client1.id, type: 'MEETING', date: monthsAgo(1), subject: 'مراجعة التصميم المعماري', description: 'اجتماع مع العميل لمراجعة المخططات المعمارية النهائية', outcome: 'تمت الموافقة على التصميم مع تعديلات بسيطة على الواجهة' , organizationId: org1.id },
      { projectId: project2.id, clientId: client2.id, type: 'CALL', date: daysFromNow(-5), subject: 'متابعة تأخر المشروع', description: 'مكالمة هاتفية لمتابعة تقدم المشروع ومناقشة أسباب التأخير', outcome: 'العميل يطلب تسريع الإنجاز مع إمكانية تمديد الموعد' , organizationId: org1.id },
      { projectId: project3.id, clientId: client3.id, type: 'EMAIL', date: monthsAgo(1), subject: 'إرسال عرض الأسعار', description: 'إرسال عرض أسعار شامل التصميم والإشراب عبر البريد الإلكتروني', outcome: 'في انتظار رد العميل' , organizationId: org1.id },
    ],
  });
  console.info('✅ 3 client interactions created');

  // ========== 32. NEW: Risks (4) ==========
  await db.risk.createMany({
    data: [
      { projectId: project1.id, title: 'تأخر توريد مواد البناء', category: 'SCHEDULE', probability: 3, impact: 4, score: 12, status: 'OPEN', mitigationPlan: 'التعاقد مع مورد بديل وتخزين احتياطي من المواد الأساسية', strategy: 'MITIGATE', createdById: adminUser.id , organizationId: org1.id },
      { projectId: project2.id, title: 'تجاوز الميزانية المتوقعة', category: 'FINANCIAL', probability: 4, impact: 4, score: 16, status: 'MITIGATED', mitigationPlan: 'مراجعة الميزانية شهريا والتفاوض على أسعار ثابتة مع الموردين', strategy: 'MITIGATE', createdById: adminUser.id , organizationId: org1.id },
      { projectId: project5.id, title: 'عدم مطابقة المواصفات', category: 'TECHNICAL', probability: 2, impact: 5, score: 10, status: 'OPEN', mitigationPlan: 'فحص جميع الموارد قبل التوريد واعتماد عينات مسبقا', strategy: 'MITIGATE', createdById: pmUser.id , organizationId: org1.id },
      { projectId: project3.id, title: 'تأخر موافقات البلدية', category: 'EXTERNAL', probability: 3, impact: 3, score: 9, status: 'CLOSED', mitigationPlan: 'تقديم المستندات مبكرا ومتابعة دورية مع البلدية', strategy: 'MITIGATE', createdById: adminUser.id , organizationId: org1.id },
    ],
  });
  console.info('✅ 4 risks created');

  // ========== 33. NEW: Submittals (3) ==========
  await db.submittal.createMany({
    data: [
      { projectId: project1.id, number: 'SUB-001', title: 'مواصفات الخرسانة الجاهزة', type: 'MATERIAL', status: 'APPROVED', revisionNumber: 1 , organizationId: org1.id },
      { projectId: project2.id, number: 'SUB-002', title: 'كتالوج المصاعد', type: 'EQUIPMENT', status: 'UNDER_REVIEW', revisionNumber: 1 , organizationId: org1.id },
      { projectId: project3.id, number: 'SUB-003', title: 'عينات بلاط الأرضيات', type: 'SAMPLE', status: 'REJECTED', revisionNumber: 2 , organizationId: org1.id },
    ],
  });
  console.info('✅ 3 submittals created');

  // ========== 34. NEW: Change Orders (2) ==========
  await db.changeOrder.createMany({
    data: [
      { projectId: project1.id, number: 'CO-001', description: 'تغيير شكل وحجم المسبح بناء على طلب العميل', type: 'CHANGE', costImpact: 15000, timeImpact: '5 أيام', status: 'APPROVED' , organizationId: org1.id },
      { projectId: project2.id, number: 'CO-002', description: 'ترقية نظام التكييف من نظام تقليدي إلى نظام VRV', type: 'CHANGE', costImpact: 45000, timeImpact: '10 أيام', status: 'PENDING' , organizationId: org1.id },
    ],
  });
  console.info('✅ 2 change orders created');

  // ========== 35. NEW: Transmittals (2) ==========
  await db.transmittal.createMany({
    data: [
      { projectId: project1.id, number: 'TRN-001', subject: 'إرسال مخططات للبلدية', fromId: secUser.id, toName: 'بلدية دبي', toCompany: 'بلدية دبي', deliveryMethod: 'MANUAL', status: 'REPLIED' , organizationId: org1.id },
      { projectId: project2.id, number: 'TRN-002', subject: 'إرسال تقرير التربة', fromId: pmUser.id, toName: 'شركة البناء الحديث', toCompany: 'المقاول - شركة البناء الحديث', deliveryMethod: 'EMAIL', status: 'RECEIVED' , organizationId: org1.id },
    ],
  });
  console.info('✅ 2 transmittals created');

  // ========== 36. NEW: Violations (2) — moved after supervision checklists (need checklistId) ==========
  // See section 42b below

  // ========== 37. NEW: Suppliers (3) — created individually to capture IDs for purchase orders ==========
  const supplier1 = await db.supplier.create({ data: { name: 'شركة الإمارات للحديد', category: 'MATERIALS', email: 'sales@emsteel.ae', phone: '+971-2-555-1122', address: 'أبو ظبي', rating: 5, organizationId: org1.id } });
  const supplier2 = await db.supplier.create({ data: { name: 'مؤسسة الخرسانة الجاهزة', category: 'MATERIALS', email: 'orders@rakreadymix.ae', phone: '+971-7-266-3344', address: 'رأس الخيمة', rating: 4, organizationId: org1.id } });
  const _supplier3 = await db.supplier.create({ data: { name: 'شركة الأنارة الحديثة', category: 'EQUIPMENT', email: 'info@modernlight.ae', phone: '+971-4-333-5566', address: 'دبي', rating: 4, organizationId: org1.id } });
  console.info('✅ 3 suppliers created');

  // ========== 38. NEW: Purchase Orders (2) ==========
  await db.purchaseOrder.createMany({
    data: [
      { projectId: project1.id, number: 'PO-001', supplierId: supplier1.id, amount: 70000, status: 'APPROVED', createdById: pmUser.id , organizationId: org1.id },
      { projectId: project2.id, number: 'PO-002', supplierId: supplier2.id, amount: 28000, status: 'DRAFT', createdById: structuralUser.id , organizationId: org1.id },
    ],
  });
  console.info('✅ 2 purchase orders created');

  // ========== 39. NEW: Guarantee Letters (2) ==========
  await db.guaranteeLetter.createMany({
    data: [
      { projectId: project1.id, guaranteeNumber: 'GL-001', type: 'ADVANCE_PAYMENT', amount: 25000, bankName: 'بنك رأس الخيمة الوطني', issueDate: monthsAgo(14), expiryDate: monthsFromNow(2), status: 'ACTIVE' , organizationId: org1.id },
      { projectId: project2.id, guaranteeNumber: 'GL-002', type: 'PERFORMANCE', amount: 85000, bankName: 'بنك دبي التجاري', issueDate: monthsAgo(12), expiryDate: monthsFromNow(6), status: 'ACTIVE' , organizationId: org1.id },
    ],
  });
  console.info('✅ 2 guarantee letters created');

  // ========== 40. NEW: Retainages (2) ==========
  await db.retainage.createMany({
    data: [
      { projectId: project1.id, percentage: 5, retainedAmount: 12500, releasedAmount: 5000, status: 'PARTIALLY_RELEASED', organizationId: org1.id },
      { projectId: project2.id, percentage: 10, retainedAmount: 85000, releasedAmount: 0, status: 'HELD', organizationId: org1.id },
    ],
  });
  console.info('✅ 2 retainages created');

  // ========== 41. NEW: Commissions (2) ==========
  await db.commission.createMany({
    data: [
      { userId: pmUser.id, projectId: project1.id, type: 'project_referral', amount: 5000, currency: 'AED', percentage: 2, baseAmount: 250000, status: 'PENDING', description: 'عمولة إحالة مشروع فيلا المنطقة الأولى' , organizationId: org1.id },
      { userId: engineerUser.id, projectId: project2.id, type: 'project_referral', amount: 12000, currency: 'AED', percentage: 1.5, baseAmount: 800000, status: 'APPROVED', description: 'عمولة إحالة مشروع المبنى السكني' , organizationId: org1.id },
    ],
  });
  console.info('✅ 2 commissions created');

  // ========== 42. NEW: Supervision Checklists (2) — created individually to capture IDs for violations ==========
  const checklist1 = await db.supervisionChecklist.create({ data: { projectId: project1.id, title: 'فحص الأساسات قبل الصب', stage: 'FOUNDATION', visitDate: monthsAgo(2), engineerId: structuralUser.id, workerCount: 12, contractorName: 'شركة البناء الحديث', progressOverall: 65, status: 'COMPLETED', organizationId: org1.id } });
  const checklist2 = await db.supervisionChecklist.create({ data: { projectId: project5.id, title: 'فحص العزل المائي', stage: 'WATERPROOFING', visitDate: daysFromNow(-5), engineerId: engineerUser.id, workerCount: 8, contractorName: 'شركة البناء الحديث', progressOverall: 35, status: 'IN_PROGRESS', organizationId: org1.id } });
  console.info('✅ 2 supervision checklists created');

  // ========== 42b. Violations (2) — require checklistId from supervision checklists above ==========
  await db.violation.createMany({
    data: [
      { checklistId: checklist2.id, projectId: project5.id, type: 'SAFETY', severity: 'HIGH', description: 'رصد عمال بدون خوذات وأحذية أمان في الموقع', contractorName: 'شركة البناء الحديث', status: 'RESOLVED', resolutionNotes: 'تم إلزام جميع العمال بارتداء معدات الوقاية وتوقيع عقوبات على المخالفين' , organizationId: org1.id },
      { checklistId: checklist1.id, projectId: project1.id, type: 'SAFETY', severity: 'MEDIUM', description: 'رصد أعمال بناء خارج ساعات العمل المسموح بها', status: 'OPEN' , organizationId: org1.id },
    ],
  });
  console.info('✅ 2 violations created');

  // ========== 43. NEW: Workflow Templates (2) ==========
  await db.workflowTemplate.createMany({
    data: [
      { name: 'سير عمل ترخيص فيلا', nameEn: 'Villa License Workflow', description: 'سير العمل القياسي للحصول على رخصة بناء فيلا', projectType: 'VILLA', isActive: true, organizationId: org1.id },
      { name: 'سير عمل التصميم الإنشائي', nameEn: 'Structural Design Workflow', description: 'سير العمل القياسي لتصميم الهيكل الإنشائي', projectType: 'BUILDING', isActive: true, organizationId: org1.id },
    ],
  });
  console.info('✅ 2 workflow templates created');

  // ========== SUMMARY ==========
  console.info('\n🎉 BluePrint database seeded successfully!');
  console.info('📧 Demo credentials defined in src/lib/demo-credentials.ts');
  console.info('📊 Summary:');
  console.info(`   - ${DEMO_CREDENTIALS.length} users`);
  console.info('   - 1 company settings');
  console.info('   - 5 employees');
  console.info('   - 10 clients (4 basic + 6 diverse)');
  console.info('   - 5 contractors');
  console.info('   - 10 projects');
  console.info('   - 13 project assignments');
  console.info('   - 21 tasks (9 base + 12 typed)');
  console.info('   - 10 project stages');
  console.info('   - 9 schedule phases');
  console.info('   - 5 BOQ items');
  console.info('   - 6 invoices');
  console.info('   - 4 payments');
  console.info('   - 11 budget items');
  console.info('   - 3 contracts');
  console.info('   - 3 site visits');
  console.info('   - 4 defects');
  console.info('   - 2 site diaries');
  console.info('   - 3 RFIs');
  console.info('   - 3 meetings');
  console.info('   - 3 suppliers');
  console.info('   - 3 government approvals');
  console.info('   - 3 knowledge articles');
  console.info('   - 1 proposal');
  console.info('   - 5 notifications');
  console.info('   - 6 bids');
  console.info('   - 5 approvals');
  console.info('   - 8 task comments');
  console.info('   - 3 leave requests');
  console.info('   - 8 documents');
  console.info('   - 3 client interactions');
  console.info('   - 4 risks');
  console.info('   - 3 submittals');
  console.info('   - 2 change orders');
  console.info('   - 2 transmittals');
  console.info('   - 2 violations');
  console.info('   - 3 suppliers');
  console.info('   - 2 purchase orders');
  console.info('   - 2 guarantee letters');
  console.info('   - 2 retainages');
  console.info('   - 2 commissions');
  console.info('   - 2 supervision checklists');
  console.info('   - 2 workflow templates');
}

main()
  .then(async () => { await db.$disconnect(); })
  .catch(async (e) => { console.error('❌ Seed error:', e); await db.$disconnect(); process.exit(1); });
