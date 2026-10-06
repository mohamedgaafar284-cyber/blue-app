import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedPermission } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { callZaiDirect } from '@/lib/ai/chat-service';
import { providerRegistry } from '@/lib/ai/providers/registry';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { log } from '@/lib/logger';
import { z } from 'zod';

const siteAiAssistantSchema = z.object({
  audioTranscript: z.string().min(3, 'Transcript too short').max(5000),
  action: z.enum(['format_inspection', 'analyze_defect', 'daily_summary']).default('format_inspection'),
  projectName: z.string().optional(),
  language: z.enum(['ar', 'en']).optional().default('ar'),
});

export async function POST(request: NextRequest) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'ai');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const authResult = await requireVerifiedPermission(request, Permission.SITE_DIARY_CREATE);
    if ('error' in authResult) return authResult.error;

    const body = await request.json();
    const validation = siteAiAssistantSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { audioTranscript, action, projectName, language } = validation.data;
    const isEn = language === 'en';

    let systemPrompt = '';
    if (action === 'format_inspection') {
      systemPrompt = isEn 
        ? `You are an expert senior supervising consultant engineer for UAE construction projects.
Your task: Convert messy, spoken voice notes from site engineers into a crisp, professional "Technical Site Inspection Report" in JSON format in ENGLISH.
Current Project: ${projectName || 'Engineering Project'}

Extract and structure the following fields:
1. title: concise official inspection title (e.g., "Inspection of First Floor Slab Reinforcement & Formwork").
2. findings: technical breakdown of observed site conditions.
3. notes: general consultant observations.
4. recommendations: concrete actions required prior to approval.
5. defects: array of defects identified, each with title, severity (LOW, NORMAL, HIGH, CRITICAL), location, and recommendation.

Output strict JSON only:
{
  "title": "...",
  "findings": "...",
  "notes": "...",
  "recommendations": "...",
  "defects": [
    { "title": "...", "severity": "NORMAL", "location": "...", "recommendation": "..." }
  ]
}`
        : `أنت مهندس استشاري خبير في الإشراف على مشاريع البناء والفلل في دولة الإمارات العربية المتحدة.
مهمتك: استلام الملاحظات الصوتية الميدانية غير المرتبة من مهندس الموقع وتحويلها فوراً إلى "تقرير فحص واستلام هندسي رسمي (Technical Site Inspection Report)" دقيق ومنسق بصيغة JSON باللغة العربية.

المشروع الحالي: ${projectName || 'مشروع هندسي'}

يجب أن تقوم باستخراج وتنظيم الحقول التالية:
1. title: عنوان موجز ورسمي للزيارة (مثال: "فحص أعمال حدادة ونجارة سقف الدور الأول").
2. findings: صياغة فنية مهنية لما تم رصده، تشمل الإيجابيات والملاحظات الإنشائية/المعمارية بدقة.
3. notes: تعليمات أو ملاحظات عامة للاستشاري والمقاول.
4. recommendations: التوصيات الهندسية المحددة والواجب اتخاذها قبل الصب أو الاستلام.
5. defects: قائمة بالعيوب أو الملاحظات الحرجة إن وُجدت، وكل عيب يحتوي على:
   - title: عنوان العيب
   - severity: إحدى القيم التالية فقط (LOW, NORMAL, HIGH, CRITICAL)
   - location: المكان أو العنصر المحدد (مثال: "كانات أعمدة المحور C-2")
   - recommendation: طريقة المعالجة المقترحة هندسياً طبقاً لكود البناء.

أخرج النتيجة بصيغة JSON فقط بدون أي نصوص قبلها أو بعدها، على هذا النحو:
{
  "title": "...",
  "findings": "...",
  "notes": "...",
  "recommendations": "...",
  "defects": [
    {
      "title": "...",
      "severity": "NORMAL",
      "location": "...",
      "recommendation": "..."
    }
  ]
}`;
    } else if (action === 'analyze_defect') {
      systemPrompt = `أنت مهندس خبير في تشخيص عيوب التنفيذ الخرساني والتشطيبات طبقاً للأكواد الإماراتية والدولية (ACI, BS, UAE Building Codes).
حلل مشكلة الموقع التالية واقترح التوصية الفنية المعتمدة لإصلاحها، وحدد درجة خطورتها.
أخرج النتيجة كـ JSON بالشكل:
{
  "title": "...",
  "severity": "LOW | NORMAL | HIGH | CRITICAL",
  "rootCause": "السبب المرجح هندسياً",
  "repairMethod": "خطوات المعالجة الهندسية المعتمدة",
  "preventiveAction": "الإجراء الوقائي لتفادي التكرار"
}`;
    } else {
      systemPrompt = `أنت مساعد مهندس الموقع. لخص يومية الموقع واستخرج عدد العمال والأنشطة والعوائق كـ JSON:
{
  "workDescription": "...",
  "issues": "...",
  "status": "COMPLETED | IN_PROGRESS | DELAYED"
}`;
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `الملاحظات الميدانية المسجلة:\n"${audioTranscript}"` },
    ];

    let aiRawResponse = '';

    // 1. Try external providers if configured (Gemini/Groq/OpenAI)
    const fallbackProvider = providerRegistry.getFirstAvailableExternalProvider();
    if (fallbackProvider) {
      try {
        const providerInstance = providerRegistry.getProvider(fallbackProvider.providerId);
        if (providerInstance && typeof providerInstance.chat === 'function') {
          aiRawResponse = await providerInstance.chat(messages, {
            model: fallbackProvider.model,
            temperature: 0.2,
            maxTokens: 1200,
          });
        }
      } catch (err) {
        log.warn('[Site AI Assistant] External provider failed, trying direct ZAI fallback', { error: String(err) });
      }
    }

    // 2. Try ZAI direct fallback
    if (!aiRawResponse) {
      try {
        aiRawResponse = await callZaiDirect(messages, { temperature: 0.2, maxTokens: 1200 });
      } catch (zaiErr) {
        log.warn('[Site AI Assistant] ZAI call failed, using intelligent rule-based parser', { error: String(zaiErr) });
      }
    }

    // 3. Fallback: Rule-based intelligent parsing if AI providers aren't keyed in .env
    if (!aiRawResponse) {
      const isCritical = /هبوط|شروخ|تشققات|صدأ|تعشيش عميق|ميلان|crack|settlement/i.test(audioTranscript);
      const isHigh = /تأخير|توقف|غياب|رفض|reject|stop/i.test(audioTranscript);

      const parsedData = {
        title: `تقرير معاينة موقع - ${new Date().toLocaleDateString('ar-AE')}`,
        findings: `تمت المعاينة الميدانية ورصد ما يلي: ${audioTranscript}`,
        notes: 'يرجى من المقاول الالتزام بالمواصفات القياسية وتعليمات الاستشاري بموقع العمل.',
        recommendations: 'إعادة المعاينة بعد استيفاء الملاحظات وقبل الانتقال للمرحلة التالية.',
        defects: isCritical || isHigh ? [
          {
            title: isCritical ? 'ملاحظة حرجة تتطلب مراجعة إنشائية' : 'ملاحظة تنفيذية في الموقع',
            severity: isCritical ? 'CRITICAL' : 'HIGH',
            location: 'عناصر الموقع قيد التنفيذ',
            recommendation: 'إيقاف الصب/الأعمال في هذا الجزء لحين التعديل واعتماد المهندس المشرف.',
          }
        ] : [],
      };

      return NextResponse.json({ success: true, data: parsedData, source: 'parser' });
    }

    // Clean JSON markdown if wrapped in ```json ... ```
    let cleanJson = aiRawResponse.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    try {
      const parsed = JSON.parse(cleanJson);
      return NextResponse.json({ success: true, data: parsed, source: 'ai' });
    } catch {
      // If AI didn't return pure JSON, package it cleanly
      return NextResponse.json({
        success: true,
        data: {
          title: `تقرير ميداني فني - ${new Date().toLocaleDateString('ar-AE')}`,
          findings: aiRawResponse,
          notes: audioTranscript,
          recommendations: 'متابعة الملاحظات المدونة أعلاه والتأكد من مطابقتها لأصول الصنعة.',
          defects: [],
        },
        source: 'ai-text',
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('[Site AI Assistant] Error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
