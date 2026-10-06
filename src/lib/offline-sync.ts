'use client';

export interface OfflineAction {
  id: string;
  type: "create-site-diary" | "create-site-visit" | "create-defect" | "approve-approval" | "reject-approval";
  data: unknown;
  timestamp: number;
}

const QUEUE_KEY = "blueprint_offline_actions";

export function isOfflineClient(): boolean {
  if (typeof window === "undefined") return false;
  
  // Custom manual override toggler check (useful for testing and development)
  const override = localStorage.getItem("blueprint_offline_override");
  if (override === "offline") return true;
  if (override === "online") return false;
  
  return !navigator.onLine;
}

export function toggleOfflineOverride(status: "online" | "offline" | "none") {
  if (typeof window === "undefined") return;
  if (status === "none") {
    localStorage.removeItem("blueprint_offline_override");
  } else {
    localStorage.setItem("blueprint_offline_override", status);
  }
  window.dispatchEvent(new CustomEvent("blueprint-network-status-change"));
}

export function queueOfflineAction(type: OfflineAction["type"], data: unknown): OfflineAction {
  if (typeof window === "undefined") {
    return { id: "", type, data, timestamp: Date.now() };
  }

  const action: OfflineAction = {
    id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type,
    data,
    timestamp: Date.now(),
  };

  const queue = getQueuedActions();
  queue.push(action);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

  // Trigger a custom event to notify listeners (e.g. lists to display optimistic item)
  window.dispatchEvent(new CustomEvent("blueprint-offline-queue-change"));

  return action;
}

export function getQueuedActions(): OfflineAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removeQueuedAction(id: string) {
  if (typeof window === "undefined") return;
  const queue = getQueuedActions().filter((act) => act.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent("blueprint-offline-queue-change"));
}

export async function syncAction(action: OfflineAction): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const globalWindow = (typeof window !== "undefined" ? window : {}) as Record<string, unknown>;
  if (globalWindow._csrfToken) {
    headers["x-csrf-token"] = String(globalWindow._csrfToken);
  }

  try {
    if (action.type === "create-site-diary") {
      const res = await fetch("/api/site-diary", {
        method: "POST",
        headers,
        body: JSON.stringify(action.data),
      });
      return res.ok;
    }

    if (action.type === "create-site-visit") {
      const res = await fetch("/api/site-visits", {
        method: "POST",
        headers,
        body: JSON.stringify(action.data),
      });
      return res.ok;
    }

    if (action.type === "create-defect") {
      const res = await fetch("/api/defects", {
        method: "POST",
        headers,
        body: JSON.stringify(action.data),
      });
      return res.ok;
    }
    
    if (action.type === "approve-approval") {
      const { approvalId, notes } = action.data as { approvalId: string; notes?: string };
      const res = await fetch(`/api/approvals/${approvalId}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ notes }),
      });
      return res.ok;
    }

    if (action.type === "reject-approval") {
      const { approvalId, notes } = action.data as { approvalId: string; notes?: string };
      const res = await fetch(`/api/approvals/${approvalId}/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({ notes }),
      });
      return res.ok;
    }

    return false;
  } catch (err) {
    console.error(`Error syncing offline action ${action.id}:`, err);
    return false;
  }
}

let isSyncing = false;

export async function syncAllPending(): Promise<{ success: number; failed: number }> {
  if (isSyncing || typeof window === "undefined" || isOfflineClient()) {
    return { success: 0, failed: 0 };
  }

  const queue = getQueuedActions();
  if (queue.length === 0) return { success: 0, failed: 0 };

  isSyncing = true;
  let successCount = 0;
  let failedCount = 0;

  // Process actions sequentially to maintain chronological order
  for (const action of queue) {
    const success = await syncAction(action);
    if (success) {
      removeQueuedAction(action.id);
      successCount++;
    } else {
      failedCount++;
    }
  }

  isSyncing = false;

  if (successCount > 0) {
    window.dispatchEvent(new CustomEvent("blueprint-offline-sync-completed", {
      detail: { successCount },
    }));
  }

  return { success: successCount, failed: failedCount };
}

// Automatically register online/offline listeners to sync
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    window.dispatchEvent(new CustomEvent("blueprint-network-status-change"));
    syncAllPending();
  });

  window.addEventListener("offline", () => {
    window.dispatchEvent(new CustomEvent("blueprint-network-status-change"));
  });
}
