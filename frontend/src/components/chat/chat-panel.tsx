"use client";

import { ChevronLeft, MessageCircle, MoreVertical, Phone, Search, Users, Video, WifiOff } from "lucide-react";
import { MessageInput } from "@/components/chat/message-input";
import { MessageList } from "@/components/chat/message-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useChatStore } from "@/stores/chat-store";

const AVATAR_PALETTE = [
  "bg-violet-600","bg-emerald-600","bg-sky-600","bg-pink-500",
  "bg-amber-500","bg-teal-600","bg-rose-600","bg-indigo-500",
];
function avatarBg(name: string): string {
  const sum = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

type Props = {
  onCall: (userId: string, displayName: string, withVideo?: boolean) => void;
};

export function ChatPanel({ onCall }: Props) {
  const activeTarget = useChatStore((s) => s.activeTarget);
  const setActiveTarget = useChatStore((s) => s.setActiveTarget);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const { isOnline: isNetworkOnline } = useNetworkStatus();

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
        "min-w-0 flex-1 flex-col bg-[#0d0f1a]",
        activeTarget ? "flex" : "hidden md:flex",
      )}
    >
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        {/* Back button — mobile only */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[#8b8fa8] hover:text-white md:hidden"
          onClick={() => setActiveTarget(null)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* DM: colorful 40px avatar + name/status column */}
        {dmUser && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white",
                avatarBg(dmUser.display_name),
              )}
            >
              {dmUser.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex flex-col">
              <h2 className="truncate text-lg font-bold text-white leading-tight">
                {dmUser.display_name}
              </h2>
              {isOnline ? (
                <span className="text-xs text-emerald-400">Active now</span>
              ) : (
                <span className="text-xs text-[#8b8fa8]">Offline</span>
              )}
            </div>
          </div>
        )}

        {/* Room: colorful 40px rounded-xl avatar + room name */}
        {activeTarget?.type === "room" && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white",
                avatarBg(title),
              )}
            >
              {title.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex flex-col">
              <h2 className="truncate text-lg font-bold text-white leading-tight">{title}</h2>
            </div>
          </div>
        )}

        {/* Spacer when no active target */}
        {!activeTarget && <div className="flex-1" />}

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[#8b8fa8] hover:text-white"
            title="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
          {dmUser && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#8b8fa8] hover:text-white"
                title="Voice call"
                onClick={() => onCall(dmUser.id, dmUser.display_name, false)}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#8b8fa8] hover:text-white"
                title="Video call"
                onClick={() => onCall(dmUser.id, dmUser.display_name, true)}
              >
                <Video className="h-4 w-4" />
              </Button>
              <div className="mx-1 h-5 w-px bg-white/[0.06]" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#8b8fa8] hover:text-white"
                title="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Offline banner */}
      {!isNetworkOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
          <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-400">You're offline — reconnecting when network returns</p>
        </div>
      )}

      {!activeTarget ? (
        <div className="hidden flex-1 flex-col items-center justify-center gap-4 md:flex">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1e2040]">
            <MessageCircle className="h-8 w-8 text-[#4a4e6a]" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-[#8b8fa8]">No conversation selected</p>
            <p className="mt-1 text-sm text-[#4a4e6a]">Choose a group or friend from the sidebar</p>
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
