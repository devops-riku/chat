"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";

const IDLE_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "touchstart"] as const;

export function useIdleDetection() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isIdleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const goIdle = () => {
      if (isIdleRef.current) return;
      isIdleRef.current = true;
      const s = getSocket();
      if (s.connected) s.emit("set_idle", {});
    };

    const goActive = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (isIdleRef.current) {
        isIdleRef.current = false;
        const s = getSocket();
        if (s.connected) s.emit("set_active", {});
      }
      timerRef.current = setTimeout(goIdle, IDLE_TIMEOUT_MS);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        goIdle();
      } else {
        goActive();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, goActive, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);

    // Start the idle timer on mount
    timerRef.current = setTimeout(goIdle, IDLE_TIMEOUT_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, goActive);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuthenticated]);
}
