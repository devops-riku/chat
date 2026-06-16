"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, Copy, CornerDownRight, Loader2, Reply, Trash2 } from "lucide-react";
import { AttachmentPreview } from "@/components/chat/attachment-preview";
import { api } from "@/lib/api";
import type { Message } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";

const SWIPE_THRESHOLD = 56;
const SWIPE_MAX = 72;

// ─── Avatar helper ────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  "bg-violet-600",
  "bg-emerald-600",
  "bg-sky-600",
  "bg-pink-500",
  "bg-amber-500",
  "bg-teal-600",
  "bg-rose-600",
  "bg-indigo-500",
];
function avatarBg(name: string): string {
  const sum = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────
function ContextMenu({
  msg,
  isOwn,
  onClose,
  onReply,
  onDelete,
}: {
  msg: Message;
  isOwn: boolean;
  onClose: () => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
  };
  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (dragStart.current === null) return;
    const dy = e.touches[0].clientY - dragStart.current;
    if (dy > 0) setDragY(dy);
  };
  const handleSheetTouchEnd = () => {
    if (dragY > 110) onClose();
    else setDragY(0);
    dragStart.current = null;
  };
  const handleCopy = () => {
    if (msg.content) navigator.clipboard?.writeText(msg.content);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <div
        className="absolute inset-0 bg-black/50"
        style={{ opacity: Math.max(0, 1 - dragY / 260) }}
        onClick={onClose}
      />
      <div
        className="relative rounded-t-3xl bg-[#1a1d35] pb-8"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? "transform 0.3s cubic-bezier(0.32,0.72,0,1)" : "none",
          animation: dragY === 0 ? "slide-up 0.28s cubic-bezier(0.32,0.72,0,1)" : "none",
        }}
        onTouchStart={handleSheetTouchStart}
        onTouchMove={handleSheetTouchMove}
        onTouchEnd={handleSheetTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 mb-5 h-1 w-10 rounded-full bg-violet-500/50" />
        {msg.content && (
          <div className="mx-4 mb-4 rounded-xl bg-[#1e2040] px-4 py-3">
            <p className="mb-1 text-xs font-medium text-[#8b8fa8]">
              {msg.author?.display_name ?? "Unknown"}
            </p>
            <p className="line-clamp-3 text-sm text-white/80">{msg.content}</p>
          </div>
        )}
        <div className="mx-4 overflow-hidden rounded-xl bg-[#1e2040] divide-y divide-white/[0.06]">
          <button
            className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-white/[0.04]"
            onClick={() => {
              onReply();
              onClose();
            }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/20">
              <Reply className="h-4 w-4 text-violet-400" />
            </span>
            <span className="text-sm font-medium text-white">Reply</span>
          </button>
          {msg.content && (
            <button
              className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-white/[0.04]"
              onClick={handleCopy}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06]">
                <Copy className="h-4 w-4 text-[#8b8fa8]" />
              </span>
              <span className="text-sm font-medium text-white">Copy text</span>
            </button>
          )}
          {isOwn && (
            <button
              className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-white/[0.04]"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15">
                <Trash2 className="h-4 w-4 text-red-400" />
              </span>
              <span className="text-sm font-medium text-white">Delete message</span>
            </button>
          )}
        </div>
        <button
          className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center justify-center rounded-2xl bg-[#1e2040] py-4 text-sm font-semibold text-[#8b8fa8] active:bg-[#252847]"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────
export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const hasMoreMessages = useChatStore((s) => s.hasMoreMessages);
  const loadingOlderMessages = useChatStore((s) => s.loadingOlderMessages);
  const loadOlderMessages = useChatStore((s) => s.loadOlderMessages);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const activeTarget = useChatStore((s) => s.activeTarget);
  const users = useChatStore((s) => s.users);
  const seenBy = useChatStore((s) => s.seenBy);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const currentUser = useAuthStore((s) => s.user);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);

  // Swipe state
  const [swipeState, setSwipeState] = useState<{ id: string; x: number } | null>(null);
  const touchStart = useRef<{ x: number; y: number; id: string } | null>(null);
  const sweepingH = useRef(false);
  const moved = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scroll container + top sentinel refs ─────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const prevLastMsgIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);
  const alreadyMarked = useRef(new Set<string>());

  // Reset on target change
  useEffect(() => {
    alreadyMarked.current.clear();
    isInitialLoadRef.current = true;
    prevLastMsgIdRef.current = null;
    savedScrollRef.current = null;
  }, [activeTarget]);

  // ── Smart scroll management ───────────────────────────────────────────────
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || messages.length === 0) return;
    const lastId = messages[messages.length - 1]?.id ?? null;
    if (savedScrollRef.current) {
      const { scrollHeight, scrollTop } = savedScrollRef.current;
      el.scrollTop = el.scrollHeight - scrollHeight + scrollTop;
      savedScrollRef.current = null;
    } else if (isInitialLoadRef.current) {
      el.scrollTop = el.scrollHeight;
      isInitialLoadRef.current = false;
    } else if (lastId !== prevLastMsgIdRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLastMsgIdRef.current = lastId;
  }, [messages]);

  // ── Load older messages when top sentinel comes into view ─────────────────
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !hasMoreMessages || loadingOlderMessages) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const el = scrollContainerRef.current;
        if (el)
          savedScrollRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
        loadOlderMessages();
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreMessages, loadingOlderMessages, loadOlderMessages]);

  // ── Auto-mark messages as read via IntersectionObserver ──────────────────
  useEffect(() => {
    if (!currentUser || !activeTarget || !listRef.current) return;

    const contextPayload =
      activeTarget.type === "room"
        ? { room_id: activeTarget.room.id }
        : { conversation_id: activeTarget.conversation.id };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const msgId = el.dataset.msgId;
          const authorId = el.dataset.authorId;
          if (!msgId || authorId === currentUser.id) continue;
          if (alreadyMarked.current.has(msgId)) continue;
          alreadyMarked.current.add(msgId);
          getSocket().emit("message_read", { message_id: msgId, ...contextPayload });
        }
      },
      { root: scrollContainerRef.current, threshold: 0.6 },
    );

    listRef.current.querySelectorAll("[data-msg-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [messages, currentUser, activeTarget]);

  // ── Non-passive native listener so horizontal swipe can prevent scroll ───
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (sweepingH.current) e.preventDefault();
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await api.delete(`/messages/${pendingDeleteId}`);
    } catch {
      /* silent */
    } finally {
      setPendingDeleteId(null);
    }
  };

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(messageId);
    setTimeout(() => setHighlightedId(null), 1500);
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);

  const activeContextKey = activeTarget
    ? activeTarget.type === "room"
      ? `room:${activeTarget.room.id}`
      : `dm:${activeTarget.conversation.id}`
    : null;

  const lastSeenOwnMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.author_id !== currentUser?.id) continue;
      const rtReaders = seenBy.get(m.id) ?? [];
      if (rtReaders.length > 0) return m.id;
      if (m.read_count > 0) return m.id;
    }
    return null;
  })();

  // The last own message (for "Sent" indicator)
  const lastOwnMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].author_id === currentUser?.id) return messages[i].id;
    }
    return null;
  })();

  // ── Touch handlers ────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent, msgId: string) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, id: msgId };
    sweepingH.current = false;
    moved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!moved.current) {
        navigator.vibrate?.(45);
        const msg = messages.find((m) => m.id === msgId);
        if (msg) setContextMsg(msg);
      }
    }, 450);
  };

  const onTouchMove = (e: React.TouchEvent, msgId: string, isOwn: boolean) => {
    moved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const start = touchStart.current;
    if (!start || start.id !== msgId) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (!sweepingH.current && Math.abs(dx) + Math.abs(dy) > 8) {
      sweepingH.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!sweepingH.current) return;
    const wantLeft = isOwn;
    if (wantLeft ? dx >= 0 : dx <= 0) return;
    const abs = Math.abs(dx);
    const clamped = abs <= SWIPE_MAX ? abs : SWIPE_MAX + (abs - SWIPE_MAX) * 0.12;
    setSwipeState({ id: msgId, x: wantLeft ? -clamped : clamped });
  };

  const onTouchEnd = (msgId: string, msg: Message) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (swipeState?.id === msgId && Math.abs(swipeState.x) >= SWIPE_THRESHOLD) {
      setReplyingTo(msg);
      navigator.vibrate?.(28);
    }
    setSwipeState(null);
    touchStart.current = null;
    sweepingH.current = false;
  };

  const onTouchCancel = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setSwipeState(null);
    touchStart.current = null;
    sweepingH.current = false;
  };

  const typingNames = [...typingUsers.entries()]
    .filter(([id, ctx]) => id !== currentUser?.id && ctx === activeContextKey)
    .map(([id]) => users.find((u) => u.id === id)?.display_name || "Someone");

  return (
    <>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-2 sm:px-4 [scrollbar-width:thin] [scrollbar-color:#1e2040_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1e2040] [&::-webkit-scrollbar-thumb:hover]:bg-[#252847]"
      >
        <div ref={listRef} className="space-y-3 py-4">
          {/* Top sentinel */}
          <div ref={topSentinelRef} className="flex h-8 items-center justify-center">
            {loadingOlderMessages && (
              <Loader2 className="h-4 w-4 animate-spin text-violet-400/50" />
            )}
          </div>

          {messages.map((msg) => {
            const isOwn = msg.author_id === currentUser?.id;
            const swipeX = swipeState?.id === msg.id ? swipeState.x : 0;
            const releasing = swipeState?.id !== msg.id;

            const isLastSeenMsg = isOwn && msg.id === lastSeenOwnMsgId;
            const isLastOwnMsg = isOwn && msg.id === lastOwnMsgId;
            const rtReaderIds = seenBy.get(msg.id) ?? [];
            const readerNames = rtReaderIds
              .filter((id) => id !== currentUser?.id)
              .map((id) => {
                const u = users.find((u) => u.id === id);
                if (u) return u.display_name;
                if (activeTarget?.type === "dm")
                  return activeTarget.conversation.other_user?.display_name ?? "?";
                return "?";
              });

            const fallbackSeen =
              isLastSeenMsg && msg.read_count > 0 && rtReaderIds.length === 0;
            const hasReaders = readerNames.length > 0 || fallbackSeen;

            // Author display name for avatar
            const authorName = isOwn
              ? currentUser?.display_name || "You"
              : msg.author?.display_name || "?";

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                data-msg-id={msg.id}
                data-author-id={msg.author_id}
                className={cn(
                  "group relative select-none rounded-xl px-1 transition-colors duration-700",
                  highlightedId === msg.id && "bg-violet-500/10",
                )}
                style={{ touchAction: "pan-y" }}
                onTouchStart={(e) => onTouchStart(e, msg.id)}
                onTouchMove={(e) => onTouchMove(e, msg.id, isOwn)}
                onTouchEnd={() => onTouchEnd(msg.id, msg)}
                onTouchCancel={onTouchCancel}
              >
                {/* Swipe reply indicator */}
                <div
                  className={cn(
                    "pointer-events-none absolute top-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white",
                    isOwn ? "right-2" : "left-2",
                  )}
                  style={{
                    opacity: Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1),
                    transform: `translateY(-50%) scale(${0.5 + Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1) * 0.5})`,
                    transition: releasing ? "opacity 0.2s, transform 0.2s" : "none",
                  }}
                >
                  <Reply className="h-3.5 w-3.5" />
                </div>

                {/* Message row */}
                <div
                  className={cn(
                    "flex items-end gap-3",
                    isOwn ? "flex-row-reverse" : "",
                  )}
                  style={{
                    transform: `translateX(${swipeX}px)`,
                    transition: releasing
                      ? "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)"
                      : "none",
                    willChange: "transform",
                  }}
                >
                  {/* Avatar — shown for both sent and received */}
                  <div
                    className={cn(
                      "h-10 w-10 shrink-0 flex items-center justify-center rounded-full text-sm font-bold text-white",
                      avatarBg(authorName),
                    )}
                  >
                    {authorName[0]?.toUpperCase()}
                  </div>

                  <div
                    className={cn(
                      "max-w-[75%] sm:max-w-[70%] md:max-w-[65%]",
                      isOwn && "items-end",
                    )}
                  >
                    {/* Meta row */}
                    <div
                      className={cn(
                        "mb-1 flex flex-wrap items-baseline gap-1",
                        isOwn ? "justify-end" : "",
                      )}
                    >
                      {isOwn ? (
                        <>
                          <span className="text-xs text-[#4a4e6a]">
                            {format(new Date(msg.created_at), "h:mm a")}
                          </span>
                          <span className="text-xs font-medium text-[#8b8fa8] ml-1">You</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-medium text-[#8b8fa8]">
                            {msg.author?.display_name}
                          </span>
                          <span className="text-xs text-[#4a4e6a] ml-1.5">
                            {format(new Date(msg.created_at), "h:mm a")}
                          </span>
                        </>
                      )}

                      {/* Desktop hover buttons */}
                      <div className="hidden gap-0.5 opacity-0 transition sm:flex sm:group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-[#4a4e6a] hover:text-white"
                          title="Reply"
                          onClick={() => setReplyingTo(msg)}
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </Button>
                        {isOwn && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-[#4a4e6a] hover:text-red-400"
                            title="Delete"
                            onClick={() => setPendingDeleteId(msg.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Reply preview */}
                    {msg.reply_to && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => scrollToMessage(msg.reply_to!.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && scrollToMessage(msg.reply_to!.id)
                        }
                        className={cn(
                          "mb-1.5 flex cursor-pointer items-start gap-1 rounded-lg border-l-2 border-violet-500 bg-[#1a1d35] px-2 py-1.5 text-xs text-[#8b8fa8] transition-colors hover:bg-[#1e2040]",
                          isOwn && "text-right",
                        )}
                      >
                        <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                        <div className="min-w-0">
                          <span className="font-medium text-white">
                            {msg.reply_to.author?.display_name || "Unknown"}
                          </span>
                          <p className="truncate text-[#8b8fa8]">{msg.reply_to.content}</p>
                        </div>
                      </div>
                    )}

                    {/* Bubble */}
                    {msg.content && (
                      <p
                        className={cn(
                          "inline-block px-3.5 py-2.5 text-sm leading-relaxed",
                          isOwn
                            ? "rounded-2xl rounded-tr-sm bg-violet-600 text-white"
                            : "rounded-2xl rounded-tl-sm bg-[#1a1d35] text-[#c8cde8]",
                        )}
                      >
                        {msg.content}
                      </p>
                    )}

                    {/* Attachments */}
                    {(msg.attachments ?? []).length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        {msg.attachments.map((att) => (
                          <AttachmentPreview key={att.id} attachment={att} isOwn={isOwn} />
                        ))}
                      </div>
                    )}

                    {/* Seen / Sent indicator — only for own messages */}
                    {isOwn && isLastSeenMsg && hasReaders && (
                      <p className="mt-1 text-[11px] text-[#4a4e6a] text-right">
                        Read {format(new Date(msg.created_at), "h:mm a")}
                      </p>
                    )}
                    {isOwn && isLastOwnMsg && !isLastSeenMsg && (
                      <p className="mt-1 text-[11px] text-[#4a4e6a] text-right flex items-center justify-end gap-0.5">
                        <Check className="h-3 w-3" /> Sent
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingNames.length > 0 && (
            <div className="flex items-end gap-3 px-1">
              <div
                className={cn(
                  "h-8 w-8 shrink-0 flex items-center justify-center rounded-full text-xs font-bold text-white",
                  avatarBg(typingNames[0] || "?"),
                )}
              >
                {(typingNames[0] || "?")[0]?.toUpperCase()}
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-[#1a1d35] px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8b8fa8] [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8b8fa8] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8b8fa8] [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <ConfirmDialog
          open={!!pendingDeleteId}
          title="Delete message?"
          description="This will permanently delete the message and any attached files."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      </div>

      {contextMsg && (
        <ContextMenu
          msg={contextMsg}
          isOwn={contextMsg.author_id === currentUser?.id}
          onClose={() => setContextMsg(null)}
          onReply={() => setReplyingTo(contextMsg)}
          onDelete={() => setPendingDeleteId(contextMsg.id)}
        />
      )}
    </>
  );
}
