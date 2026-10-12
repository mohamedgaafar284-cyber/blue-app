import { requireVerifiedPermission, orgCreate } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { validateBody, aiChatSchema } from '@/lib/api-validation';
import { providerRegistry } from '@/lib/ai/providers/registry';
import type { ChatMessage } from '@/lib/ai/providers/types';
import { log } from '@/lib/logger';
import { getEngineeringContext } from '@/lib/ai/engineering-knowledge';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { getCompanyCurrency } from '@/lib/currency-server';
import { isDemoMode } from '@/lib/demo-credentials';

import {
  getZAI,
  callZaiDirect,
  detectTopics,
  fetchContextData,
  fetchProjectContext,
  getDemoResponse,
  sseEvent,
  streamFullText,
  streamFromGenerator
} from '@/lib/ai/chat-service';

export async function POST(request: NextRequest) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'ai');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  const authResult = await requireVerifiedPermission(request, Permission.REPORTS_READ);
  if ('error' in authResult) return authResult.error;
  const authCtx = authResult.user;
  try {
    const body = await validateBody(request, aiChatSchema);
    if (body instanceof NextResponse) return body;
    const { message, conversationId: rawConversationId, language, projectId, modelId: bodyModelId, model: bodyModel } = body;

    // SECURITY: Always use the authenticated user's ID from the JWT token,
    // NEVER trust the client-supplied userId (prevents impersonation)
    const userId = authCtx.userId;

    // Fix: generate a unique conversationId if empty to prevent unique constraint crash
    const conversationId = rawConversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Fix: prefer modelId over model (frontend sends modelId, schema now accepts both)
    const resolvedModelId = (bodyModelId && bodyModelId !== 'gpt-4') ? bodyModelId : ((bodyModel && bodyModel !== 'gpt-4') ? bodyModel : 'zai-default');

    // Get or create conversation in database
    let conversation: {
      id: string;
      userId: string;
      messages: Array<{ role: string; content: string; createdAt: Date }>;
    } | null = null;

    try {
      conversation = await db.aIChatConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 20,
          },
        },
      });

      if (conversation && conversation.userId !== authCtx.userId) {
        return NextResponse.json(
          { error: "غير مسموح بالوصول لهذه المحادثة" },
          { status: 403 }
        );
      }

      if (!conversation) {
        conversation = await db.aIChatConversation.create({
          data: {
            id: conversationId,
            userId: authCtx.userId,
            projectId: projectId || null,
            title: message.substring(0, 50),
            messageCount: 0,
            ...orgCreate(authCtx),
          },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              take: 20,
            },
          },
        });
      }


      // Save user message
      await db.aIChatMessage.create({
        data: {
          conversationId,
          role: 'user',
          content: message,
          ...orgCreate(authCtx),
        },
      });
    } catch (dbError) {
      log.error('[AI Chat] Database error during conversation lookup/create:', dbError);
      // SECURITY: Don't silently set conversation=null and attempt to continue.
      // If the DB is down, creating a new conversation will also fail, and we
      // risk creating duplicate conversations or losing existing history.
      // Instead, return a clear error so the client can retry.
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }

    // Build history from database messages (or empty if db is unavailable)
    const history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = conversation
      ? conversation.messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }))
      : [];

    // Fetch user info using authenticated userId (from JWT, not client body)
    let userInfo: string | null = null;
    if (userId && await isDatabaseAvailable()) {
      try {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { name: true, role: true, department: true, position: true, email: true },
        });
        if (user) {
          const roleNames: Record<string, { ar: string; en: string }> = {
            ADMIN: { ar: 'المدير العام', en: 'Admin' },
            MANAGER: { ar: 'المدير', en: 'Manager' },
            PROJECT_MANAGER: { ar: 'مدير مشاريع', en: 'Project Manager' },
            ENGINEER: { ar: 'مهندس', en: 'Engineer' },
            DRAFTSMAN: { ar: 'رسام', en: 'Draftsman' },
            ACCOUNTANT: { ar: 'محاسب', en: 'Accountant' },
            HR: { ar: 'موارد بشرية', en: 'HR' },
            SECRETARY: { ar: 'سكرتير', en: 'Secretary' },
            VIEWER: { ar: 'مشاهد', en: 'Viewer' },
          };
          const roleInfo = roleNames[user.role] || { ar: user.role, en: user.role };
          userInfo = `Current user: ${user.name} (${user.email}), Role: ${roleInfo.ar} / ${roleInfo.en}, Department: ${user.department || 'N/A'}, Position: ${user.position || 'N/A'}`;
        }
      } catch (userErr) {
        log.error('[AI Chat] Error fetching user info:', userErr);
      }
    }

    // Detect topics and fetch context data — pass role for RBAC enforcement
    const topics = detectTopics(message);
    const contextData = await fetchContextData(topics, authCtx.role, userId, projectId, authCtx.organizationId);

    // Fetch project context if projectId is provided
    let projectContextSection = '';
    if (projectId) {
      const projectContext = await fetchProjectContext(projectId, authCtx);
      if (projectContext) {
        projectContextSection = `\n\n${projectContext}\nThe user is currently viewing this specific project. Provide answers focused on this project's data. When answering, always reference this project context and use its specific data when available.`;
      }
    }

    // Build system prompt with context
    let contextSection = '';
    if (Object.keys(contextData).length > 0) {
      contextSection = `\n\nCurrent system data context (use this to provide accurate answers):\n${JSON.stringify(contextData, null, 2)}`;
    }

    const engineeringContext = getEngineeringContext(message);

    const companyCurrency = await getCompanyCurrency(authCtx.organizationId);

    const systemPrompt = `أنت "بلو" (Blue)، المساعد الذكي المتخصص في الهندسة المدنية والإنشائية في الإمارات العربية المتحدة. أنت تعمل داخل نظام BluePrint لإدارة مكاتب الاستشارات الهندسية.

## هويتك وخبراتك
- مهندس مدني استشاري بخبرة 20+ سنة في سوق الإمارات
- مختص في التصميم الإنشائي والمتابعة الإنشائية لمشاريع الفلل والمباني
- خبير بالموافقات الحكومية (البلدية، الدفاع المدني، FEWA، DEWA، ADDC)
- ملم بأكواد البناء: Abu Dhabi IBC 2013, Dubai Building Code, RAK Code
- ملم بالمواصفات والأسعار المحلية في سوق الإمارات

## ما يمكنك فعله (قدرات حقيقية)
1. **حسابات هندسية**: حساب الأحمال، أبعاد الخرسانة، كمية الحديد، سمك البلاطة
2. **تكاليف البناء**: تقدير تكاليف بناء على أسعار السوق الإماراتي (${companyCurrency})
3. **الموافقات الحكومية**: إرشادات حول إجراءات البلدية والدفاع المدني والهيئة
4. **تحليل المشاريع**: مراجعة بيانات المشاريع والمهام والفواتير من قاعدة البيانات
5. **تقييم المخاطر**: تحديد المخاطر الهندسية والمالية واقتراح حلول
6. **المواصفات الفنية**: توفير مواصفات الخرسانة والحديد والتشطيبات حسب الأكواد
7. **إدارة المقاولين**: تحليل عطاءات وتقييم مقاولين
8. **تقارير الموقع**: إرشادات لزيارات الموقع وتسجيل العيوب

## قواعد الرد
- أجب باللغة العربية دائماً إلا إذا طلب المستخدم الإنجليزية
- استخدم وحدات القياس (العملة: ${companyCurrency}، kN/m² للأحمال، mm للأبعاد)
- اذكر الكود أو المواصفة المعتمدة عند تقديم معلومات فنية
- قدم أرقاماً محددة وليس عامة (مثلاً: "سمك البلاطة 150mm" وليس "سمك مناسب")
- اربط الإجابة ببيانات المشروع الفعلية من قاعدة البيانات عندما تكون متاحة
- نبّه دائماً أن الحسابات التقديربية تحتاج مراجعة مهندس مصنف
- استخدم تنسيق Markdown مع جداول ورموز واضحة

## تنسيق الإجابة
- استخدم **عناوين** فرعية واضحة
- ضع الأرقام والأبعاد في تنسيق كود: \`150mm\`
- استخدم جداول Markdown للمقارنات
- أضف تنبيهات السلامة عند الحاجة: ⚠️

## معلومات نظام BluePrint
- منصة إدارة استشارات هندسية في الإمارات
- يتعامل مع المشاريع (فلل، مباني، تجاري، صناعي)
- يتتبع المهام بلوحات كانبان (todo, in_progress, review, done)
- عمليات مالية (${companyCurrency}) (فواتير، مدفوعات، مقترحات، ميزانيات)
- إدارة الموقع (زيارات، عيوب، يومية موقع، RFI، submittals)
- موافقات حكومية (البلدية، FEWA، Etisalat، الدفاع المدني)
- وحدات الموارد البشرية (موظفون، حضور، إجازات)
- إدارة المقاولين مع نظام تقييم
- إدارة العطاءات مع تقييم معيار موزون
- العملة: ${companyCurrency}
${engineeringContext}
${userInfo ? `\n\n${userInfo}` : ''}
${projectContextSection}
${contextSection}`;

    // ============================================
    // Build chat messages for AI providers
    // ============================================
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(0, -1).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // ============================================
    // Determine the AI provider and streaming strategy
    // ============================================
    const modelId = resolvedModelId;
    const { provider, model } = providerRegistry.parseModelId(modelId);

    // Resolve which provider/model to use (same 4-tier fallback logic as before)
    let usedProvider = provider;
    let usedModel = model;
    let streamStrategy: 'real-stream' | 'simulate' = 'simulate';
    let providerToUse: InstanceType<typeof import('@/lib/ai/providers/openai-compatible').OpenAICompatibleProvider> | null = null;

    // Check if ZAI is available before deciding streaming strategy
    let zaiAvailable = false;

    if (provider === 'zai') {
      // Tier 1: Try ZAI SDK (no streaming)
      try {
        const ZAIClass = await getZAI();
        if (ZAIClass) {
          const zai = await ZAIClass.create();
          const completion = await zai.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              ...history,
              { role: 'user', content: message },
            ],
            temperature: 0.7,
            max_tokens: 1500,
          });
          const aiMessage = completion.choices[0]?.message?.content || '';
          // P3-28: extract real token usage from the provider response when present.
          // OpenAI-compatible APIs return { usage: { total_tokens, prompt_tokens, completion_tokens } }.
          const zaiUsage = (completion as { usage?: { total_tokens?: unknown } }).usage;
          const zaiTokens = typeof zaiUsage?.total_tokens === 'number' ? zaiUsage.total_tokens : 0;
          // ZAI SDK doesn't support streaming → simulate
          usedModel = 'zai-default';
          zaiAvailable = true;

          // Build SSE stream simulating token delivery
          const fullText = aiMessage;
          const stream = new ReadableStream({
            async start(controller) {
              try {
                await streamFullText(controller, fullText);
                // Save to DB
                try {
                  await db.aIChatMessage.create({
                    data: { conversationId, role: 'assistant', content: fullText, tokens: zaiTokens, model: usedModel, ...orgCreate(authCtx) },
                  });
                  await db.aIChatConversation.update({
                    where: { id: conversationId },
                    data: {
                      lastMessageAt: new Date(),
                      messageCount: { increment: 2 },
                      title: (conversation as Record<string, unknown> & { title?: string })?.title || message.substring(0, 50),
                    },
                  });
                } catch (dbErr) {
                  log.error('[AI Chat] Non-fatal DB error saving ZAI msg:', dbErr);
                  throw dbErr;
                }
                controller.enqueue(sseEvent({ type: 'done', message: { content: fullText, conversationId, provider: usedProvider, model: usedModel } }));
                controller.close();
              } catch (err) {
                controller.enqueue(sseEvent({ type: 'error', error: err instanceof Error ? err.message : 'Stream error' }));
                controller.close();
              }
            },
          });
          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
          });
        }
      } catch (zaiError) {
        log.warn('[AI] ZAI SDK failed, trying direct HTTP call:', { error: zaiError instanceof Error ? zaiError.message : zaiError });
      }

      // Tier 2: Direct HTTP call to ZAI backend (no streaming)
      if (!zaiAvailable) {
        try {
          const zaiMessages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: message },
          ];
          const aiMessage = await callZaiDirect(zaiMessages, { temperature: 0.7, maxTokens: 1500 });
          usedModel = 'zai-default';
          zaiAvailable = true;

          const fullText = aiMessage;
          const stream = new ReadableStream({
            async start(controller) {
              try {
                await streamFullText(controller, fullText);
                try {
                  // TODO(P3-28): callZaiDirect() returns only the message string, not the
                  // full provider response — so we can't read usage.total_tokens here.
                  // Refactor callZaiDirect to return { content, usage } to enable real
                  // token tracking for the Tier-2 fallback path.
                  await db.aIChatMessage.create({
                    data: { conversationId, role: 'assistant', content: fullText, tokens: 0, model: usedModel, ...orgCreate(authCtx) },
                  });
                  await db.aIChatConversation.update({
                    where: { id: conversationId },
                    data: {
                      lastMessageAt: new Date(),
                      messageCount: { increment: 2 },
                      title: (conversation as Record<string, unknown> & { title?: string })?.title || message.substring(0, 50),
                    },
                  });
                } catch (dbErr) {
                  log.error('[AI Chat] Non-fatal DB error saving ZAI direct msg:', dbErr);
                  throw dbErr;
                }
                controller.enqueue(sseEvent({ type: 'done', message: { content: fullText, conversationId, provider: usedProvider, model: usedModel } }));
                controller.close();
              } catch (err) {
                controller.enqueue(sseEvent({ type: 'error', error: err instanceof Error ? err.message : 'Stream error' }));
                controller.close();
              }
            },
          });
          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
          });
        } catch (directError) {
          log.warn('[AI] ZAI direct HTTP call failed:', { error: directError instanceof Error ? directError.message : directError });
        }
      }

      // Tier 3: Use first available external provider (with real streaming if supported)
      if (!zaiAvailable) {
        const fallbackProvider = providerRegistry.getFirstAvailableExternalProvider();
        if (fallbackProvider) {
          providerToUse = providerRegistry.getProvider(fallbackProvider.providerId) as InstanceType<typeof import('@/lib/ai/providers/openai-compatible').OpenAICompatibleProvider> | null;
          if (providerToUse) {
            usedProvider = fallbackProvider.providerId;
            usedModel = fallbackProvider.model;
            streamStrategy = typeof providerToUse.chatStream === 'function' ? 'real-stream' : 'simulate';
          }
        }
      }

      // Tier 4: Demo mode fallback
      if (!providerToUse) {
        if (!isDemoMode()) {
          return NextResponse.json({
            error: 'AI_SERVICE_UNAVAILABLE',
            message: language === 'ar'
              ? 'عذراً، خدمة المساعد الذكي غير متاحة. يرجى إضافة API Key لأحد المزودين في ملف .env'
              : 'AI assistant unavailable. Please add an API key for one of the providers in your .env file',
          }, { status: 503 });
        }
        const demoText = getDemoResponse(message, language || 'ar', contextData, companyCurrency);
        usedProvider = 'demo';
        usedModel = 'demo-fallback';

        const stream = new ReadableStream({
          async start(controller) {
            try {
              await streamFullText(controller, demoText);
              try {
                // TODO(P3-28): demo-mode fallback — no real API call, so token usage
                // is unknown. Acceptable for demo; this path should never fire in
                // production (DEMO_MODE must be false in NODE_ENV=production).
                await db.aIChatMessage.create({
                  data: { conversationId, role: 'assistant', content: demoText, tokens: 0, model: usedModel, ...orgCreate(authCtx) },
                });
                await db.aIChatConversation.update({
                  where: { id: conversationId },
                  data: {
                    lastMessageAt: new Date(),
                    messageCount: { increment: 2 },
                    title: (conversation as Record<string, unknown> & { title?: string })?.title || message.substring(0, 50),
                  },
                });
              } catch (dbErr) { 
                log.error('[AI Chat] Non-fatal DB error saving demo msg:', dbErr);
                throw dbErr;
              }
              controller.enqueue(sseEvent({ type: 'done', message: { content: demoText, conversationId, provider: usedProvider, model: usedModel } }));
              controller.close();
            } catch (err) {
              controller.enqueue(sseEvent({ type: 'error', error: err instanceof Error ? err.message : 'Stream error' }));
              controller.close();
            }
          },
        });
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        });
      }
    } else {
      // Use external provider directly (OpenAI, Gemini, DeepSeek, etc.)
      const externalProvider = providerRegistry.getProvider(provider);
      if (!externalProvider) {
        return NextResponse.json({
          error: 'PROVIDER_NOT_CONFIGURED',
          message: language === 'ar'
            ? `المزود "${provider}" غير متوفر. يرجى إضافة API Key في ملف .env`
            : `Provider "${provider}" is not available. Please check API key in .env`,
        }, { status: 400 });
      }
      providerToUse = externalProvider as InstanceType<typeof import('@/lib/ai/providers/openai-compatible').OpenAICompatibleProvider>;
      streamStrategy = typeof providerToUse.chatStream === 'function' ? 'real-stream' : 'simulate';
    }

    // ============================================
    // Build and return SSE streaming response
    // ============================================
    // At this point we have providerToUse set (from tier 3 fallback or direct external provider)
    const finalProvider = providerToUse;
    const finalStrategy = streamStrategy;
    const finalUsedProvider = usedProvider;
    const finalUsedModel = usedModel;
    const finalConversationId = conversationId;
    const finalConversation = conversation;
    const finalMessage = message;

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = '';
        try {
          if (finalStrategy === 'real-stream' && finalProvider.chatStream) {
            // Real streaming from the provider
            fullText = await streamFromGenerator(
              controller,
              finalProvider.chatStream(chatMessages, { model: finalUsedModel, temperature: 0.7, maxTokens: 1500 }),
            );
          } else {
            // Non-streaming provider → collect full response then simulate streaming
            const result = await finalProvider.chat(chatMessages, { model: finalUsedModel, temperature: 0.7, maxTokens: 1500 });
            fullText = result;
            await streamFullText(controller, fullText);
          }

          // Save AI response to database (graceful: skip if db unavailable)
          try {
            // TODO(P3-28): the AIProvider.chat()/chatStream() abstraction in
            // src/lib/ai/providers/openai-compatible.ts returns only the message
            // string, discarding the `usage` object from the provider response.
            // Refactor the provider interface to return { content, usage } so we
            // can record real token counts here too. For now, tokens: 0 is the
            // best we can do without breaking the provider interface.
            await db.aIChatMessage.create({
              data: {
                conversationId: finalConversationId,
                role: 'assistant',
                content: fullText,
                tokens: 0,
                model: finalUsedModel,
                ...orgCreate(authCtx),
              },
            });
            await db.aIChatConversation.update({
              where: { id: finalConversationId },
              data: {
                lastMessageAt: new Date(),
                messageCount: { increment: 2 },
                title: (finalConversation as Record<string, unknown> & { title?: string })?.title || finalMessage.substring(0, 50),
              },
            });
          } catch (dbError) {
            log.error('[AI Chat] Database error saving AI response:', dbError);
            throw dbError;
          }

          controller.enqueue(sseEvent({
            type: 'done',
            message: {
              content: fullText,
              conversationId: finalConversationId,
              provider: finalUsedProvider,
              model: finalUsedModel,
            },
          }));
          controller.close();
        } catch (err) {
          log.error('[AI Chat] Streaming error:', err);
          controller.enqueue(sseEvent({ type: 'error', error: err instanceof Error ? err.message : 'Unknown streaming error' }));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('AI Chat API error:', { error: errorMessage });

    // Return user-friendly error messages (match on internal message but never expose it)
    if (errorMessage.includes('API key') || errorMessage.includes('auth') || errorMessage.includes('credential')) {
      return NextResponse.json({
        error: 'AI_AUTH_ERROR',
        message: 'عذراً، حدث خطأ في المصادقة مع خدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.',
      }, { status: 503 });
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      return NextResponse.json({
        error: 'AI_TIMEOUT',
        message: 'عذراً، استغرقت المعالجة وقتاً طويلاً. يرجى المحاولة مرة أخرى.',
      }, { status: 504 });
    }

    return NextResponse.json({
      error: process.env.NODE_ENV === 'development' ? errorMessage : 'AI_ERROR',
      message: 'عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
    }, { status: 500 });
  }
}
