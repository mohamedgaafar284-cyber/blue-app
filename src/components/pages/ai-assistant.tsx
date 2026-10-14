"use client";

import { useTranslations } from 'next-intl';
/* eslint-disable */


import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/auth-store";
import { streamAIChat } from "@/hooks/api/ai-chat";

import { Props, Message, ConversationMeta } from "./ai-assistant/types";
import { quickSuggestions } from "./ai-assistant/constants";
import { generateSuggestedReplies } from "./ai-assistant/suggested-replies";
import { useSpeechRecognition } from "./ai-assistant/use-speech-recognition";
import { useSpeechSynthesis } from "./ai-assistant/use-speech-synthesis";
import { loadConversations, saveConversations } from "./ai-assistant/conversation-storage";
import { ChatSidebar } from "./ai-assistant/chat-sidebar";
import { ChatHeader } from "./ai-assistant/chat-header";
import { ChatMessages } from "./ai-assistant/chat-messages";
import { ChatInput } from "./ai-assistant/chat-input";

// Model selector removed - the server uses z-ai-web-dev-sdk which auto-configures
// and does not support model switching. Keeping selectedModel for API compatibility.

export default function AIAssistant({ language: lang, projectId }: Props) {
  const tAuto = useTranslations();
  const isAr = lang === "ar";
  const { user: _user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(() => {
    if (typeof window === 'undefined') return 'conv-ssr';
    return `conv-${Date.now()}`;
  });
  const [selectedModelId, setSelectedModelId] = useState<string>('zai-default');

  // Read localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem('bp_selected_model');
    if (stored) setSelectedModelId(stored);
  }, []);

  const [_availableModels, setAvailableModels] = useState<Array<{
    id: string;
    name: string;
    provider: string;
    providerName: string;
    supportsVision: boolean;
  }>>([{ id: 'zai-default', name: 'BluePrint AI (Built-in)', provider: 'zai', providerName: 'BluePrint AI', supportsVision: true }]);

  // Fetch available models on mount
  useEffect(() => {
    const controller = new AbortController();
    const fetchModels = async () => {
      try {
        const res = await fetch('/api/ai/providers', { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.models) {
            setAvailableModels(data.data.models);
            const serverDefault = data.data.defaultModel;
            const current = localStorage.getItem('bp_selected_model');
            const exists = current && data.data.models.some((m: { id: string }) => m.id === current);
            if (!exists) {
              const smartDefault = serverDefault || 'zai-default';
              setSelectedModelId(smartDefault);
              localStorage.setItem('bp_selected_model', smartDefault);
            }
          }
        }
      } catch (err) { if ((err as Error).name !== 'AbortError') { /* keep defaults */ } }
    };
    fetchModels();
    return () => controller.abort();
  }, []);

  const selectedModel = selectedModelId;
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [_lastApiTokens, setLastApiTokens] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const safeSetTimeout = useCallback((cb: () => void, ms: number) => {
    const id = setTimeout(cb, ms);
    timeoutsRef.current.push(id);
  }, []);

  const { isListening, isSupported, startListening, stopListening } =
    useSpeechRecognition(isAr);
  const { speakingMsgId, speak, stop } = useSpeechSynthesis();

  // Estimate token count (rough: ~4 chars per token)
  const totalTokens = useMemo(() => {
    return messages.reduce((sum, msg) => {
      return sum + Math.ceil(msg.content.length / 4);
    }, 0);
  }, [messages]);

  // Auto-generate project summary welcome message when projectId is provided
  useEffect(() => {
    if (!projectId || messages.length > 0) return;

    let cancelled = false;

    const fetchProjectSummary = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok || cancelled) return;
        const project = await res.json();
        if (cancelled) return;

        const statusLabels: Record<string, { ar: string; en: string }> = {
          ACTIVE: { ar: "نشط", en: "Active" },
          COMPLETED: { ar: "مكتمل", en: "Completed" },
          DELAYED: { ar: "متأخر", en: "Delayed" },
          ON_HOLD: { ar: "معلق", en: "On Hold" },
          CANCELLED: { ar: "ملغي", en: "Cancelled" },
        };
        const statusLabel = statusLabels[project.status] || { ar: project.status, en: project.status };
        const clientName = project.client?.name || project.client?.company || "N/A";
        const budgetFormatted = project.budget
          ? `${project.budget.toLocaleString("en-AE")} AED`
          : tAuto('auto.notSet');
        const endDateFormatted = project.endDate
          ? new Date(project.endDate).toLocaleDateString(isAr ? "ar-AE" : "en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : tAuto('auto.notSet');

        const taskStats = project.taskStats || {};
        const totalTasks = taskStats.total || 0;
        const doneTasks = taskStats.done || 0;

        const welcomeMsg: Message = {
          id: `msg-welcome-${projectId}`,
          role: "assistant",
          content: isAr
            ? `## 📊 ملخص المشروع: ${project.name}\n\n| البيان | التفاصيل |\n|--------|---------|\n| **الحالة** | ${statusLabel.ar} |\n| **نسبة الإنجاز** | ${project.progress}% |\n| **الميزانية** | ${budgetFormatted} |\n| **العميل** | ${clientName} |\n| **الموقع** | ${project.location || "غير محدد"} |\n| **تاريخ الانتهاء** | ${endDateFormatted} |\n\n**المهام:** ${doneTasks} من ${totalTasks} مكتملة\n\nيمكنني مساعدتك في متابعة هذا المشروع. اسألني عن المهام، الفواتير، فريق العمل، أو أي تفاصيل أخرى!`
            : `## 📊 Project Summary: ${project.nameEn || project.name}\n\n| Detail | Value |\n|--------|-------|\n| **Status** | ${statusLabel.en} |\n| **Progress** | ${project.progress}% |\n| **Budget** | ${budgetFormatted} |\n| **Client** | ${clientName} |\n| **Location** | ${project.location || "Not set"} |\n| **Deadline** | ${endDateFormatted} |\n\n**Tasks:** ${doneTasks} of ${totalTasks} completed\n\nI can help you track this project. Ask me about tasks, invoices, team, or any other details!`,
          timestamp: new Date(),
        };

        setMessages([welcomeMsg]);
      } catch {
        // Silently fail - the user can still use the chat normally
      }
    };

    fetchProjectSummary();

    return () => {
      cancelled = true;
    };
  }, [projectId, messages.length, isAr]);

  // Load conversations from localStorage on mount
  useEffect(() => {
    setConversations(loadConversations());
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Pre-load voices for TTS
  useEffect(() => {
    window.speechSynthesis?.getVoices();
    const handleVoicesChanged = () => {
      window.speechSynthesis?.getVoices();
    };
    window.speechSynthesis?.addEventListener?.("voiceschanged", handleVoicesChanged);
    return () => {
      window.speechSynthesis?.removeEventListener?.("voiceschanged", handleVoicesChanged);
    };
  }, []);

  // Save current conversation to localStorage when messages change
  useEffect(() => {
    if (messages.length === 0) return;

    const firstUserMsg = messages.find((m) => m.role === "user");
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? "..." : "")
      : tAuto('auto.newChat');

    const meta: ConversationMeta = {
      id: conversationId,
      title,
      timestamp: new Date().toISOString(),
      messages,
    };

    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== conversationId);
      const updated = [meta, ...filtered].slice(0, 50);
      saveConversations(updated);
      return updated;
    });
  }, [messages, conversationId, isAr]);

  // Start new conversation
  const startNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(`conv-${Date.now()}`);
    setLastApiTokens(null);
    window.speechSynthesis.cancel();
    safeSetTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Load a conversation from history
  const loadConversation = useCallback((conv: ConversationMeta) => {
    setMessages(conv.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
    setConversationId(conv.id);
    setSidebarOpen(false);
    safeSetTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(
    (e: React.MouseEvent, convId: string) => {
      e.stopPropagation();
      setConversations((prev) => {
        const updated = prev.filter((c) => c.id !== convId);
        saveConversations(updated);
        return updated;
      });
      if (convId === conversationId) {
        startNewChat();
      }
    },
    [conversationId, startNewChat]
  );

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    // Create a placeholder AI message that will be updated as tokens stream in
    const aiMsgId = `msg-${Date.now()}-ai`;
    const aiMsg: Message = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setIsLoading(true);
    setLastApiTokens(null);

    try {
      const result = await streamAIChat(
        {
          message: messageText,
          conversationId,
          language: lang,
          projectId,
          model: selectedModel,
          modelId: selectedModelId,
        },
        (token: string) => {
          // Update the AI message content as tokens arrive
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: m.content + token }
                : m
            )
          );
        }
      );

      // Final update with the complete message (in case there were any differences)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: result.content }
            : m
        )
      );
    } catch (err) {
      // Check if the AI message already has some content (partial stream)
      // If so, don't replace it with an error
      const currentMessages = await new Promise<Message[]>((resolve) => {
        setMessages((prev) => {
          resolve(prev);
          return prev;
        });
      });
      const existingAiMsg = currentMessages.find((m) => m.id === aiMsgId);
      const hasPartialContent = existingAiMsg && existingAiMsg.content.length > 0;

      if (!hasPartialContent) {
        // Replace the empty AI message with an error message
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: isAr
                    ? `عذراً، حدث خطأ: ${errorMsg}. يرجى المحاولة مرة أخرى.`
                    : `Sorry, an error occurred: ${errorMsg}. Please try again.`,
                  isError: true,
                }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    // Remove current conversation from history
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== conversationId);
      saveConversations(updated);
      return updated;
    });
    setMessages([]);
    setClearDialogOpen(false);
    setLastApiTokens(null);
    window.speechSynthesis.cancel();
    safeSetTimeout(() => inputRef.current?.focus(), 100);
  };

  const exportChat = () => {
    const lines = messages.map((msg) => {
      const time = msg.timestamp.toLocaleTimeString(isAr ? "ar-AE" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const role =
        msg.role === "user"
          ? tAuto('auto.you')
          : tAuto('auto.aI');
      return `[${time}] ${role}: ${msg.content}`;
    });
    const text = lines.join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blueprint-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMessage = async (msg: Message) => {
    await navigator.clipboard.writeText(msg.content);
    setCopiedMsgId(msg.id);
    safeSetTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((text, isFinal) => {
        setInput(isFinal ? text : text);
        if (isFinal) {
          inputRef.current?.focus();
        }
      });
    }
  };

  const handleRetry = async () => {
    const lastErrorIdx = [...messages].reverse().findIndex((m) => m.isError);
    if (lastErrorIdx === -1) return;

    const actualIdx = messages.length - 1 - lastErrorIdx;
    let userMsg = "";
    for (let i = actualIdx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMsg = messages[i].content;
        break;
      }
    }

    if (!userMsg) return;

    // Replace the error message with an empty AI message placeholder for streaming
    const aiMsgId = `msg-${Date.now()}-ai`;
    setMessages((prev) => [
      ...prev.filter((_, idx) => idx !== actualIdx),
      { id: aiMsgId, role: "assistant", content: "", timestamp: new Date() },
    ]);
    setIsLoading(true);

    try {
      const result = await streamAIChat(
        {
          message: userMsg,
          conversationId,
          language: lang,
          projectId,
          model: selectedModel,
          modelId: selectedModelId,
        },
        (token: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: m.content + token }
                : m
            )
          );
        }
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: result.content }
            : m
        )
      );
    } catch (err) {
      const currentMessages = await new Promise<Message[]>((resolve) => {
        setMessages((prev) => {
          resolve(prev);
          return prev;
        });
      });
      const existingAiMsg = currentMessages.find((m) => m.id === aiMsgId);
      const hasPartialContent = existingAiMsg && existingAiMsg.content.length > 0;

      if (!hasPartialContent) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: isAr
                    ? `عذراً، حدث خطأ: ${errorMsg}. يرجى المحاولة مرة أخرى.`
                    : `Sorry, an error occurred: ${errorMsg}. Please try again.`,
                  isError: true,
                }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSpeak = (msg: Message) => {
    if (speakingMsgId === msg.id) {
      stop();
    } else {
      speak(msg.content, msg.id, isAr);
    }
  };

  const initialSuggestions = useMemo(() => quickSuggestions.slice(0, 4), []);

  const ttsSupported = useMemo(() => {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }, []);

  // Get the last AI message for suggested replies
  const lastAiMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && !messages[i].isError) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const suggestedReplies = useMemo(() => {
    if (!lastAiMessage || isLoading) return [];
    return generateSuggestedReplies(lastAiMessage.content, isAr);
  }, [lastAiMessage, isLoading, isAr]);

  // Format relative time for conversation history
  const formatRelativeTime = useCallback(
    (timestamp: string) => {
      const now = new Date();
      const date = new Date(timestamp);
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHour = Math.floor(diffMs / 3600000);
      const diffDay = Math.floor(diffMs / 86400000);

      if (diffMin < 1) return tAuto('auto.now');
      if (diffMin < 60) return isAr ? `منذ ${diffMin} د` : `${diffMin}m ago`;
      if (diffHour < 24) return isAr ? `منذ ${diffHour} س` : `${diffHour}h ago`;
      if (diffDay < 7) return isAr ? `منذ ${diffDay} ي` : `${diffDay}d ago`;
      return date.toLocaleDateString(isAr ? "ar-AE" : "en-US", {
        month: "short",
        day: "numeric",
      });
    },
    [isAr, tAuto]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex gap-3 h-[calc(100dvh-10rem)] max-w-6xl mx-auto">
        {/* Conversation History Sidebar */}
        <ChatSidebar
          isAr={isAr}
          sidebarOpen={sidebarOpen}
          conversations={conversations}
          conversationId={conversationId}
          startNewChat={startNewChat}
          setSidebarOpen={setSidebarOpen}
          loadConversation={loadConversation}
          deleteConversation={deleteConversation}
          formatRelativeTime={formatRelativeTime}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <ChatHeader
            isAr={isAr}
            sidebarOpen={sidebarOpen}
            messagesLength={messages.length}
            clearDialogOpen={clearDialogOpen}
            setSidebarOpen={setSidebarOpen}
            setClearDialogOpen={setClearDialogOpen}
            exportChat={exportChat}
            clearChat={clearChat}
            onQuickAction={handleSend}
            isLoading={isLoading}
          />

          {/* Chat Messages */}
          <ChatMessages
            isAr={isAr}
            messages={messages}
            isLoading={isLoading}
            copiedMsgId={copiedMsgId}
            speakingMsgId={speakingMsgId}
            ttsSupported={ttsSupported}
            suggestedReplies={suggestedReplies}
            initialSuggestions={initialSuggestions}
            messagesEndRef={messagesEndRef}
            handleSend={handleSend}
            handleCopyMessage={handleCopyMessage}
            handleRetry={handleRetry}
            handleSpeak={handleSpeak}
          />

          {/* Input Area */}
          <ChatInput
            isAr={isAr}
            input={input}
            setInput={setInput}
            inputRef={inputRef}
            handleKeyDown={handleKeyDown}
            isLoading={isLoading}
            isListening={isListening}
            isSupported={isSupported}
            messagesLength={messages.length}
            totalTokens={totalTokens}
            handleMicClick={handleMicClick}
            handleSend={handleSend}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
