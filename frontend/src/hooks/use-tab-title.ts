"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";

export function useTabTitle() {
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef = useRef(0);

  useEffect(() => {
    const total = Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0);
    totalRef.current = total;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (total === 0) {
      document.title = "Chat";
      return;
    }

    const label = `(${total}) New message${total > 1 ? "s" : ""}`;

    if (document.hidden) {
      // Blink between the unread label and a blank-ish title to grab attention
      let toggle = false;
      document.title = label;
      intervalRef.current = setInterval(() => {
        toggle = !toggle;
        document.title = toggle ? "💬 " + label : label;
      }, 1000);
    } else {
      document.title = label;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [unreadCounts]);

  // When tab comes back into focus, stop blinking and show steady count
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        const total = totalRef.current;
        document.title = total > 0 ? `(${total}) New message${total > 1 ? "s" : ""}` : "Chat";
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
}
