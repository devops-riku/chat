"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Copy, CornerDownRight, Loader2, Reply, Trash2 } from "lucide-react";
import { AttachmentPreview } from "@/components/chat/attachment-preview";
import { api } from "@/lib/api";
import type { Message } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";

const SWIPE_THRESHOLD = 56;
const SWIPE_MAX = 72;

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
      <div className="absolute inset-0 bg-black/50" style={{ opacity: Math.max(0, 1 - dragY / 260) }} onClick={onClose} />
      <div
        className="relative rounded-t-3xl bg-zinc-900 pb-8 shadow-2xl"
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
        <div className="mx-auto mt-3 mb-5 h-1 w-10 rounded-full bg-zinc-600" />
        {msg.content && (
          <div className="mx-4 mb-4 rounded-2xl bg-zinc-800 px-4 py-3">
            <p className="mb-1 text-xs font-medium text-zinc-500">{msg.author?.display_name ?? "Unknown"}</p>
            <p className="line-clamp-3 text-sm text-zinc-200">{msg.content}</p>
          </div>
        )}
        <div className="mx-4 overflow-hidden rounded-2xl bg-zinc-800 divide-y divide-zinc-700/60">
          <button className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-zinc-700/60" onClick={() => { onReply(); onClose(); }}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600/20"><Reply className="h-4 w-4 text-indigo-400" /></span>
            <span className="text-sm font-medium text-zinc-100">Reply</span>
          </button>
          {msg.content && (
            <button className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-zinc-700/60" onClick={handleCopy}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700/50"><Copy className="h-4 w-4 text-zinc-300" /></span>
              <span className="text-sm font-medium text-zinc-100">Copy text</span>
            </button>
          )}
          {isOwn && (
            <button className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-zinc-700/60" onClick={() => { onDelete(); onClose(); }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15"><Trash2 className="h-4 w-4 text-red-400" /></span>
              <span className="text-sm font-medium text-red-400">Delete message</span>
            </button>
          )}
        </div>
        <button className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center justify-center rounded-2xl bg-zinc-800 py-4 text-sm font-semibold text-zinc-300 active:bg-zinc-700" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Seen indicator ───────────────────────────────────────────────────────────
function SeenIndicator({ readerNames }: { readerNames: string[] }) {
  if (readerNames.length === 0) return null;
  return (
    <div className="mt-1 flex items-center justify-end gap-1 animate-in">
      <div className="flex -space-x-1">
        {readerNames.slice(0, 3).map((name, i) => (
          <div
            key={i}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] border-zinc-900 bg-indigo-700 text-[8px] font-bold text-white"
            title={`Seen by ${name}`}
          >
            {name[0].toUpperCase()}
          </div>
        ))}
      </div>
      {readerNames.length === 1 ? (
        <span className="text-[10px] text-zinc-500">Seen</span>
      ) : (
        <span className="text-[10px] text-zinc-500">Seen by {readerNames.length}</span>
      )}
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
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const el = scrollContainerRef.current;
      if (el) savedScrollRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
      loadOlderMessages();
    }, { threshold: 0.1 });
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
    const onMove = (e: TouchEvent) => { if (sweepingH.current) e.preventDefault(); };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try { await api.delete(`/messages/${pendingDeleteId}`); }
    catch { /* silent */ }
    finally { setPendingDeleteId(null); }
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
    ? activeTarget.type === "room" ? `room:${activeTarget.room.id}` : `dm:${activeTarget.conversation.id}`
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
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
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
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
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
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 sm:px-4 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500">
        <div ref={listRef} className="space-y-3 py-4">
          {/* Top sentinel */}
          <div ref={topSentinelRef} className="flex h-8 items-center justify-center">
            {loadingOlderMessages && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
          </div>

          {messages.map((msg) => {
            const isOwn = msg.author_id === currentUser?.id;
            const swipeX = swipeState?.id === msg.id ? swipeState.x : 0;
            const releasing = swipeState?.id !== msg.id;

            const isLastSeenMsg = isOwn && msg.id === lastSeenOwnMsgId;
            const rtReaderIds = seenBy.get(msg.id) ?? [];
            const readerNames = rtReaderIds
              .filter((id) => id !== currentUser?.id)
              .map((id) => {
                const u = users.find((u) => u.id === id);
                if (u) return u.display_name;
                if (activeTarget?.type === "dm") return activeTarget.conversation.other_user?.display_name ?? "?";
                return "?";
              });

            const fallbackSeen = isLastSeenMsg && msg.read_count > 0 && rtReaderIds.length === 0;
            const displayReaderNames = fallbackSeen
              ? activeTarget?.type === "dm"
                ? [activeTarget.conversation.other_user?.display_name ?? "?"]
                : []
              : readerNames;

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                data-msg-id={msg.id}
                data-author-id={msg.author_id}
                className={cn(
                  "group relative select-none rounded-xl px-1 transition-colors duration-700",
                  highlightedId === msg.id && "bg-indigo-500/10",
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
                    "pointer-events-none absolute top-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white",
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
                  className={cn("flex gap-2 sm:gap-3", isOwn ? "flex-row-reverse" : "")}
                  style={{
                    transform: `translateX(${swipeX}px)`,
                    transition: releasing ? "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)" : "none",
                    willChange: "transform",
                  }}
                >
                  {!isOwn && (
                    <Avatar className="h-8 w-8 shrink-0 sm:h-9 sm:w-9">
                      <AvatarFallback className="bg-indigo-900/50 text-xs font-bold text-indigo-200 sm:text-sm">
                        {(msg.author?.display_name || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className={cn("max-w-[85%] sm:max-w-[75%] md:max-w-[70%]", isOwn && "items-end text-right")}>
                    {/* Meta */}
                    <div className={cn("mb-1 flex flex-wrap items-baseline gap-1.5", isOwn ? "justify-end" : "")}>
                      {isOwn ? (
                        <>
                          <span className="text-xs text-zinc-600">{format(new Date(msg.created_at), "hh:mm a")}</span>
                          <span className="text-xs font-semibold text-indigo-400">You</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-semibold text-zinc-200">{msg.author?.display_name || "Unknown"}</span>
                          <span className="text-xs text-zinc-600">{format(new Date(msg.created_at), "hh:mm a")}</span>
                        </>
                      )}

                      {/* Desktop hover buttons */}
                      <div className="hidden gap-0.5 opacity-0 transition sm:flex sm:group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-200" title="Reply" onClick={() => setReplyingTo(msg)}>
                          <Reply className="h-3.5 w-3.5" />
                        </Button>
                        {isOwn && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-red-400" title="Delete" onClick={() => setPendingDeleteId(msg.id)}>
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
                        onKeyDown={(e) => e.key === "Enter" && scrollToMessage(msg.reply_to!.id)}
                        className={cn(
                          "mb-1.5 flex cursor-pointer items-start gap-1 rounded-lg border-l-2 border-indigo-500 bg-zinc-800/80 px-2 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-700/80",
                          isOwn && "text-right",
                        )}
                      >
                        <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-indigo-400" />
                        <div className="min-w-0">
                          <span className="font-medium text-indigo-300">{msg.reply_to.author?.display_name || "Unknown"}</span>
                          <p className="truncate">{msg.reply_to.content}</p>
                        </div>
                      </div>
                    )}

                    {/* Bubble */}
                    {msg.content && (
                      <p className={cn(
                        "inline-block rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        isOwn
                          ? "rounded-tr-sm bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                          : "rounded-tl-sm bg-[#1a1f2e] text-zinc-100",
                      )}>
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

                    {/* Seen indicator */}
                    {isLastSeenMsg && <SeenIndicator readerNames={displayReaderNames} />}
                  </div>
                </div>
              </div>
            );
          })}

          {typingNames.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]" />
              </div>
              <p className="text-xs text-zinc-500">
                {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing
              </p>
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
