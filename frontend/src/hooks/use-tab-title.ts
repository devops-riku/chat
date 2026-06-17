"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";

// ── Favicon badge ─────────────────────────────────────────────────────────────
function setFaviconBadge(count: number) {
  if (typeof document === "undefined") return;

  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Base icon: violet rounded square with "C" (matches app logo)
  const r = 6;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#7c3aed");
  grad.addColorStop(1, "#6d28d9");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("C", size / 2, size / 2 + 1);

  // Red badge in top-right corner
  if (count > 0) {
    const br = 9;
    const bx = size - br + 2;
    const by = br - 2;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, 2 * Math.PI);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count > 9 ? "9+" : String(count), bx, by);
  }

  // Replace (or create) the <link rel="icon"> element
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = canvas.toDataURL("image/png");
}

// ── Tab title + favicon hook ───────────────────────────────────────────────────
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

    // Always update favicon badge
    setFaviconBadge(total);

    if (total === 0) {
      document.title = "Chat";
      return;
    }

    const label = `(${total}) New message${total > 1 ? "s" : ""}`;

    if (document.hidden) {
      // Blink title when tab is in background
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

  // Stop blinking when tab regains focus
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
