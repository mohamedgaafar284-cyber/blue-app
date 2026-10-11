<div dir="rtl">

<img src="public/logo.png" alt="BluePrint Logo" width="200" />

# 🔵 BluePrint - Engineering Consultancy ERP
**نظام متكامل لإدارة مكاتب الاستشارات الهندسية في الإمارات العربية المتحدة**

BluePrint هو نظام تخطيط موارد المؤسسات (ERP) صُمم خصيصاً لتلبية احتياجات المكاتب الهندسية وشركات المقاولات والاستشارات. يوفر النظام بيئة عمل متكاملة لإدارة المشاريع، الفواتير، الموارد البشرية، المهام، والموافقات ضمن واجهة مستخدم حديثة وسهلة الاستخدام تدعم اللغتين العربية والإنجليزية.

---

## ✨ الميزات الرئيسية

### 🏢 إدارة المشاريع والمهام (Project & Task Management)
- **لوحة تحكم المشاريع:** تتبع حالة جميع المشاريع (نشط، متأخر، مكتمل) مع عرض التقدم المالي والزمني.
- **إدارة المهام:** تعيين المهام للمهندسين والموظفين مع تحديد الأولويات والمواعيد النهائية.
- **مخطط جانت (Gantt Chart):** تتبع زمني مرئي لتقدم المشاريع.

### 💰 الإدارة المالية والمحاسبية (Financial & Double-Entry Accounting)
- **إصدار الفواتير:** إنشاء فواتير احترافية وتصديرها كـ PDF مع دعم ضريبة القيمة المضافة (VAT) في الإمارات.
- **تتبع الدفعات والتسويات:** متابعة المدفوعات المستلمة والمتبقية مع نظام منع التعارض (Optimistic Concurrency Control).
- **بوابة الدفع (Stripe):** دعم مدمج لتلقي المدفوعات الإلكترونية من العملاء.
- **نظام القيود المزدوجة المتكامل (Automated Double-Entry Ledger):** ترحيل القيود اليومية تلقائياً للفواتير والمدفوعات إلى شجرة الحسابات (Chart of Accounts).
- **القيود العكسية الآلية والحماية المالية (Automated Reversals):** توليد قيود عكسية ذرية برقم مرجعي `REV-` عند إلغاء الدفعات مع حماية تامة من التعديل العشوائي للمبالغ وتحديث تلقائي لأرصدة الفواتير.
- **التقارير المالية وميزان المراجعة:** إصدار ميزان المراجعة (Trial Balance)، قائمة الدخل (Income Statement / P&L)، والميزانية العمومية (Balance Sheet).
- **دعم العملات الديناميكي المتعدد (Dynamic Multi-Currency):** تهيئة وتخصيص عملة المؤسسة (AED, SAR, USD, EUR, EGP) مع تطبيق فوري وتلقائي في جميع الكروت، الجداول، والمستندات المصدرة.

### 🏗️ بوابة المهندس الميداني والتفتيش (Field Engineering & Offline Portal)
- **وضع العمل بدون إنترنت (Offline-First):** تسجيل التقارير الميدانية وملاحظات التفتيش بدون اتصال مع مزامنة تلقائية عبر Background Sync.
- **تتبع الإحداثيات والخرائط الجغرافية (GPS & Geolocation):** تسجيل موقع المهندس بدقة أثناء الزيارات الميدانية.
- **الملاحظات الصوتية والذكاء الاصطناعي (Voice Notes & AI Defect Extraction):** تسجيل الملاحظات الصوتية واستخراج العيوب والتوصيات آلياً بواسطة نماذج الذكاء الاصطناعي وربطها بالمشروع فوراً.


### 🤝 إدارة علاقات العملاء (CRM Leads Kanban)
- **لوحة الكانبان للعملاء المحتملين (Leads Kanban Board):** إدارة خط المبيعات وسحب وإفلات العملاء المحتملين عبر الحالات (NEW, CONTACTED, QUALIFIED, PROPOSAL, WON, LOST).
- **تحويل العملاء المحتملين:** تحويل تلقائي للعملاء عند الفوز (WON) إلى عملاء دائمين (Clients) مع إنشاء جهة اتصال جديدة.

### 💬 تكامل واتساب للأعمال (WhatsApp Business Cloud API)
- **إرسال الرسائل والقوالب:** دعم إرسال قوالب واتساب المعتمدة من Meta للإشعارات الهامة (مثل إشعارات الفواتير والتقارير وتحديثات المشاريع).
- **نظام الويب هوك (Webhooks):** استقبال الرسائل الواردة وتحديثات حالة الرسائل (Sent, Delivered, Read) وتخزينها في قاعدة البيانات في الوقت الفعلي.

### 👥 الموارد البشرية (HR & Employees)
- **إدارة الموظفين:** سجل كامل لكل موظف يشمل الراتب، المسمى الوظيفي، وتاريخ الانضمام.
- **نظام الحضور والانصراف:** تتبع ساعات العمل والإجازات والمغادرات.
- **الاعتمادات والموافقات:** نظام هرمي لطلب واعتماد الإجازات والمصروفات.

### 🤖 الذكاء الاصطناعي (AI Integration)
- **مساعد الذكاء الاصطناعي:** روبوت محادثة مدمج لمساعدة المهندسين والمديرين في تحليل البيانات واستخراج التقارير.
- **تحليل المستندات والصور:** استخدام تقنيات AI لتحليل المخططات الهندسية والمستندات.
- **مزودي AI متعددين:** يدعم النظام 9 مزودين (ZAI, OpenAI, Gemini, DeepSeek, Mistral, OpenRouter, xAI, Groq, HuggingFace) عبر موجه ذكي (AI Router).

### 🌍 النظام ثنائي اللغة ويدعم تعدد المستأجرين (i18n & Multi-tenant)
- دعم كامل للعربية والإنجليزية (RTL / LTR) مع إمكانية التبديل الفوري.
- دعم تقويم هجري (Hijri) متكامل للتواريخ في الواجهات والتقارير.
- مصمم لدعم العمليات السحابية متعددة المستأجرين (SaaS / Multi-tenancy) مع عزل كامل للبيانات.

### 🔔 الإشعارات والوقت الحقيقي (Real-time & Notifications)
- **WebSocket Server مستقل:** خدمة Socket.io منفصلة على بورت 3003 للدردشة والإشعارات الفورية.
- **Web Push Notifications:** إشعارات متصفح مدمجة عبر VAPID keys.
- **BullMQ Workers:** معالجة الخلفية للبريد الإلكتروني، التقارير، والتنبيهات.

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

- **Frontend:** Next.js 16 (App Router), React 19, TailwindCSS 4, Radix UI / shadcn/ui, Framer Motion.
- **Backend:** Next.js Route Handlers, Prisma ORM, Zod validation.
- **Database:** PostgreSQL (للإنتاج) / SQLite (للتطوير المحلي) — مع Dynamic Provider.
- **Authentication:** JWT (jose), HTTPOnly Cookies, RBAC, 2FA (TOTP + Backup codes), OAuth (Google + Microsoft).
- **Real-time:** Socket.io (chat-service مستقل), BullMQ + Redis.
- **Storage:** Local filesystem أو S3-compatible (AWS S3, MinIO, DigitalOcean Spaces).
- **Payments:** Stripe (subscriptions, invoices, payment intents).
- **AI:** Z-AI SDK + multi-provider router.
- **Monitoring:** Sentry (error tracking), Winston (logging with daily rotation).
- **PWA:** Serwist service worker + offline page.
- **Runtime:** Bun (بديل سريع لـ npm/Node.js).

---

## 🔐 الأمان (Security)

النظام مبني بمعايير Enterprise-grade:

- **Authentication:** JWT + Refresh Tokens + 2FA (TOTP + Backup + SMS) + OAuth social login.
- **Authorization:** Role-Based Access Control (RBAC) + per-organization data isolation via `orgFilter()`.
- **CSRF Protection:** Double-submit cookie pattern على جميع الـ APIs.
- **Rate Limiting:** Tier-based (strict/auth/api/loose/ai/export/webhook) على Edge + API + WebSocket.
- **CSP Headers:** Content-Security-Policy مع per-request nonce لمنع XSS.
- **Security Headers:** X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **File Upload Security:** MIME type blocklist + extension validation + 50MB max size.
- **Account Lockout:** بعد محاولات فاشلة + Cloudflare Turnstile captcha.
- **Audit Logging:** جميع العمليات الحساسة مسجلة في `SecurityAuditLog` و `ActivityLog`.
- **Soft Delete:** على الـ User لمنع فقدان البيانات المرتبطة.

راجع التقرير الأمني الكامل: [docs/security-audit.md](docs/security-audit.md)

---

## 📊 المراقبة والصحة (Monitoring & Health)

- **Health Endpoint:** `GET /api/health` يفحص:
  - Database connection
  - Redis connection + latency
  - Stripe API
  - Storage (local/S3)
  - BullMQ workers status
  - Chat-service health (HTTP check على بورت 3003)
- **Authentication:** الـ detailed checks محمية بـ `HEALTH_CHECK_SECRET` bearer token.
- **Sentry:** Error tracking + source maps + performance monitoring.
- **Graceful Shutdown:** SIGTERM/SIGINT handlers لتصريف آمن للـ WebSocket + BullMQ + Prisma + Redis.

---

## 🚀 البدء السريع (Quick Start)

لقد قمنا بتوفير سكريبت إعداد تلقائي (`setup.bat` للويندوز أو `setup.sh` للماك/لينكس) يقوم بتهيئة كل شيء بضغطة زر واحدة!

### على نظام Windows:
قم بالضغط مرتين على ملف `setup.bat` أو تشغيله من موجه الأوامر (CMD):
```cmd
setup.bat
```

### على نظام Mac / Linux:
```bash
chmod +x setup.sh
./setup.sh
```

### ماذا يفعل سكريبت الإعداد؟
1. **يطلب منك اختيار وضع التشغيل:** 
   - `Demo Mode`: لتجربة النظام أو تقديم عرض توضيحي (يقوم بزراعة بيانات تجريبية مثل المشاريع والفواتير).
   - `Production Mode`: بيئة نظيفة وجاهزة للعمل الفعلي.
2. **يطلب منك تحديد قاعدة البيانات:** `PostgreSQL` أو `SQLite`.
3. **يُنشئ المتغيرات السرية:** يولد مفاتيح تشفير آمنة (JWT, CSRF, Encryption).
4. **يُنشئ ملف `.env`** ويقوم بتنظيف الملفات القديمة.
5. **يقوم بتثبيت الحزم** عبر `bun install`.
6. **يهيئ قاعدة البيانات** ويزرع البيانات التجريبية (إذا تم اختيار وضع الـ Demo).
7. **يشغل السيرفر المحلي** لتتمكن من استخدام التطبيق فوراً.

---

## 🔐 حسابات الدخول التجريبية (Demo Accounts)

إذا قمت باختيار **Demo Mode** أثناء الإعداد، يتم إنشاء حسابات تجريبية تلقائياً. يتم عرض بيانات الدخول في سطر الأوامر بعد اكتمال الإعداد — **لا تقم بمشاركة بيانات الدخول أو تضمينها في مستندات عامة**.

> ⚠️ **تنبيه أمني:** لحماية حساباتك، لا يتم حفظ كلمات المرور في المستندات. بعد تشغيل سكريبت الإعداد، ستجد بيانات الدخول في مخرجات السكريبت فقط. قم بتغيير كلمات المرور فوراً بعد أول تسجيل دخول.

---

## 🚪 نظام التسجيل والدعوات (Registration & Invitations)

- **التسجيل الذاتي (Self-Registration):** تم إيقاف التسجيل الذاتي المفتوح من الواجهة الأمامية للمتصفح لدواعي أمنية وضمان عزل المستأجرين (Multi-tenancy Isolation).
- **دعوة المستخدمين الجدد (User Invitations):** تعتمد عملية إضافة موظفين أو شركاء جدد بالكامل على نظام الدعوات التي يرسلها مديرو المنظمات المسجلون من داخل لوحة التحكم، أو من خلال الربط المباشر مع مزودي الهوية عبر حسابات Microsoft / Google المعتمدة للمنظمة.

---

## 📜 الترخيص (License)

هذا المشروع مُرخّص تحت **Commercial Proprietary License** — جميع الحقوق محفوظة.

- 📄 [LICENSE](LICENSE) — نص الترخيص الكامل.
- 📄 [NOTICE](NOTICE) — معلومات حقوق الملكية.
- ❌ **غير مسموح** بالاستخدام، النسخ، التعديل، أو التوزيع بدون إذن كتابي مسبق.
- ✅ للاستفسارات التجارية أو طلبات الترخيص، يرجى التواصل عبر: `legal@blueprint.ae`.

---

## 🤝 المساهمة (Contributing)

نرحب بمساهمات المجتمع! راجع [CONTRIBUTING.md](CONTRIBUTING.md) للحصول على:
- إعداد بيئة التطوير المحلية
- استراتيجية الفروع (Branching Strategy)
- تنسيق رسائل الالتزام (Conventional Commits)
- معايير جودة الكود

جميع الـ commits يجب أن تتبع **Conventional Commits** (مُنفّذ عبر `commitlint` + `husky`).

---

## 📋 سجل التغييرات (Changelog)

راجع [CHANGELOG.md](CHANGELOG.md) لمعرفة جميع التغييرات الإصدارات السابقة.

---

## 📞 الدعم والمساهمة
هذا المشروع مخصص للاستخدام المؤسسي. إذا واجهت أي مشاكل أثناء الإعداد أو التشغيل، يرجى مراجعة سجلات الخطأ (Logs) أو التواصل مع فريق التطوير.

### 🛡️ حماية الفرع الرئيسي (Branch Protection)
لضمان استقرار النظام في بيئة الإنتاج، يرجى تفعيل إعدادات الحماية للفرع الرئيسي `main` عبر إعدادات GitHub (Settings → Branches → Add branch protection rule):
1. **Require a pull request before merging:** لتفعيل مراجعة الكود قبل الدمج.
2. **Require approvals:** تحديد عدد الموافقات المطلوبة (مثلاً 1 أو 2).
3. **Require status checks to pass before merging:** تأكد من تحديد اختبارات الـ CI لتمريرها أولاً.
4. **Require conversation resolution before merging:** لضمان حل كل التعليقات.
5. **Require linear history:** لتفادي merge commits الفوضوية.

---

## 🚀 النشر (Deployment)

> ⚠️ **مهم:** هذا التطبيق **لا يدعم Vercel** لأنه يتطلب:
> - WebSocket server منفصل (chat-service على بورت 3003)
> - Background workers (BullMQ)
> - اتصال مستمر بـ Redis و PostgreSQL
> 
> Vercel (serverless) لا يدعم هذه الميزات. الاستضافة الموصى بها هي **Docker على VPS**.

### باستخدام Docker (الطريقة الموصى بها):
```bash
# 1. انسخ ملف البيئة
cp .env.example .env
# (حرر .env بقيم الإنتاج)

# 2. شغّل كل الخدمات
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. هاجر قاعدة البيانات
docker compose exec app bunx prisma migrate deploy

# 4. زرع البيانات (أول مرة فقط)
docker compose exec app bunx tsx prisma/seed.ts
```

راجع [docs/deployment.md](docs/deployment.md) للتفاصيل الكاملة.

### المتطلبات:
- VPS بـ 2 vCPU + 4GB RAM على الأقل (Hetzner, DigitalOcean, AWS EC2)
- PostgreSQL 15+
- Redis 7+
- Docker + Docker Compose
- Domain + SSL (عبر Cloudflare أو Caddy auto-SSL)

---

## 🗂️ بنية المشروع (Project Structure)

```
blue-app/
├── src/
│   ├── app/                  # Next.js App Router (pages + API routes)
│   │   ├── api/              # 195 API route handler
│   │   ├── dashboard/        # 66 صفحة لوحة التحكم
│   │   └── ...               # صفحات عامة (about, services, quote, ...)
│   ├── components/           # React components (UI + pages + layout)
│   ├── lib/                  # Business logic (auth, ai, cache, queue, ...)
│   ├── hooks/                # React hooks (api, real-time, ...)
│   ├── store/                # Zustand stores
│   └── middleware.ts         # JWT + CSRF + rate limit proxy
├── prisma/                   # Prisma schema + migrations + seed
├── mini-services/
│   └── chat-service/         # Socket.io standalone server (port 3003)
├── __tests__/                # Jest unit + integration tests
├── e2e/                      # Playwright E2E tests
├── load-tests/               # k6 load tests
├── docs/                     # Documentation
│   ├── security-audit.md     # Security audit report
│   ├── deployment.md        # Deployment guide
│   ├── migration.md         # SQLite → PostgreSQL migration
│   └── remaining-work.md    # Remaining work roadmap
├── .github/                  # CI/CD workflows + dependabot
├── Dockerfile                # Production multi-stage build
├── docker-compose*.yml       # Docker orchestration (dev + prod)
└── Caddyfile                 # Reverse proxy + auto-SSL
```

---

## 📞 التواصل (Contact)

- **رقم الهاتف (Phone)**: +971 50 161 1234
- **البريد الإلكتروني (Email)**: info.blueprintrak@gmail.com
- **البريد القانوني (Legal)**: legal@blueprint.ae
- **الموقع (Location)**: Ras Al Khaimah, UAE

</div>
