"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chat-store";

export function useTabTitle() {
  const unreadCounts = useChatStore((s) => s.unreadCounts);

  useEffect(() => {
    const total = Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0);
    document.title = total > 0 ? `(${total}) Chat` : "Chat";
  }, [unreadCounts]);
}
