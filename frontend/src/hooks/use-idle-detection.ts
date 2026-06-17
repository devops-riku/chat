"use client";

import { useEffect, useRef } from "react";
import { connectSocket, getSocket } from "@/lib/socket";
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
      const s = getSocket();
      // Reconnect immediately if socket dropped while user was idle
      if (!s.connected) {
        connectSocket();
      }
      if (isIdleRef.current) {
        isIdleRef.current = false;
        if (s.connected) {
          s.emit("set_active", {});
        } else {
          // Emit once the socket finishes reconnecting
          s.once("connect", () => s.emit("set_active", {}));
        }
      }
      timerRef.current = setTimeout(goIdle, IDLE_TIMEOUT_MS);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        goIdle();
      } else {
        // Reconnect immediately if socket dropped while in background
        const s = getSocket();
        if (!s.connected) {
          connectSocket();
        }
        goActive();
      }
    };

    const handleOffline = () => {
      // Network lost — go idle immediately and let the socket die naturally
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!isIdleRef.current) {
        isIdleRef.current = true;
        const s = getSocket();
        // Try to emit before the socket closes; fire-and-forget if already gone
        if (s.connected) s.emit("set_idle", {});
      }
    };

    const handleOnline = () => {
      // Network restored — reconnect socket and go active
      connectSocket();
      isIdleRef.current = false;
      const s = getSocket();
      if (s.connected) {
        s.emit("set_active", {});
      } else {
        s.once("connect", () => s.emit("set_active", {}));
      }
      timerRef.current = setTimeout(goIdle, IDLE_TIMEOUT_MS);
    };

    // Handle the case where the page loads while already offline
    if (!navigator.onLine) handleOffline();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, goActive, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Start the idle timer on mount
    timerRef.current = setTimeout(goIdle, IDLE_TIMEOUT_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, goActive);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isAuthenticated]);
}
