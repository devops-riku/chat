"use client";

import { ChevronLeft, MessageCircle, MoreVertical, Phone, Users, Video } from "lucide-react";
import { MessageInput } from "@/components/chat/message-input";
import { MessageList } from "@/components/chat/message-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";

type Props = {
  onCall: (userId: string, displayName: string, withVideo?: boolean) => void;
};

export function ChatPanel({ onCall }: Props) {
  const activeTarget = useChatStore((s) => s.activeTarget);
  const setActiveTarget = useChatStore((s) => s.setActiveTarget);
  const onlineUsers = useChatStore((s) => s.onlineUsers);

  let title = "Chat";

  if (activeTarget?.type === "room") {
    title = activeTarget.room.name;
  } else if (activeTarget?.type === "dm") {
    title = activeTarget.conversation.other_user?.display_name || "Direct Message";
  }

  const dmUser = activeTarget?.type === "dm" ? activeTarget.conversation.other_user : null;
  const isOnline = dmUser ? (onlineUsers.get(dmUser.id)?.isOnline ?? dmUser.is_online) : false;

  return (
    <main
      className={cn(
        "min-w-0 flex-1 flex-col bg-[#0e1020]",
        activeTarget ? "flex" : "hidden md:flex",
      )}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        {/* Back button — mobile only */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-zinc-400 hover:text-zinc-100 md:hidden"
          onClick={() => setActiveTarget(null)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {activeTarget?.type === "room" && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
            <Users className="h-3.5 w-3.5" />
          </div>
        )}

        {/* Presence dot + title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {dmUser && (
            <span className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              isOnline ? "bg-emerald-400" : "bg-zinc-600",
            )} />
          )}
          <h2 className="truncate font-semibold text-zinc-100">{title}</h2>
        </div>

        {dmUser && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
              title="Voice call"
              onClick={() => onCall(dmUser.id, dmUser.display_name, false)}
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
              title="Video call"
              onClick={() => onCall(dmUser.id, dmUser.display_name, true)}
            >
              <Video className="h-4 w-4" />
            </Button>
            <div className="mx-1 h-5 w-px bg-white/10" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        )}
      </header>

      {!activeTarget ? (
        <div className="hidden flex-1 flex-col items-center justify-center gap-4 md:flex">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10">
            <MessageCircle className="h-8 w-8 text-indigo-500/40" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-zinc-400">No conversation selected</p>
            <p className="mt-1 text-sm text-zinc-600">Choose a group or friend from the sidebar</p>
          </div>
        </div>
      ) : (
        <>
          <MessageList />
          <MessageInput />
        </>
      )}
    </main>
  );
}
