"use client";

import { Phone, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePresenceTick } from "@/hooks/use-presence-tick";
import { presenceColor, presenceLabel } from "@/lib/presence";
import { useChatStore } from "@/stores/chat-store";

type Props = {
  onCall: (userId: string, displayName: string, withVideo?: boolean) => void;
};

export function MembersPanel({ onCall }: Props) {
  usePresenceTick();
  const friends = useChatStore((s) => s.friends);
  const users = useChatStore((s) => s.users);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const startDm = useChatStore((s) => s.startDm);
  const loadMessages = useChatStore((s) => s.loadMessages);

  const activeTarget = useChatStore((s) => s.activeTarget);

  if (activeTarget?.type !== "room") return null;

  const displayUsers = users;

  const handleDm = async (userId: string) => {
    await startDm(userId);
    await loadMessages();
  };

  const handleCall = (userId: string, name: string) => {
    onCall(userId, name, false);
  };

  return (
    <aside className="hidden w-56 flex-col border-l border-violet-900/40 bg-[#150e24] lg:flex">
      <div className="border-b border-violet-900/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-violet-400/70">
        Members — {displayUsers.length}
      </div>
      <ScrollArea className="flex-1 px-2 py-2">
        {displayUsers.map((user) => {
          const presence = onlineUsers.get(user.id);
          const isOnline = presence?.isOnline ?? user.is_online;
          const isIdle = presence?.isIdle ?? false;
          const lastSeenAt = presence?.lastSeenAt ?? user.last_seen_at;
          return (
            <div
              key={user.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#1d1533]"
            >
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{user.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#150e24]",
                    presenceColor(isOnline, lastSeenAt, isIdle),
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-violet-50">{user.display_name}</p>
                <p className="truncate text-xs text-violet-400/70">{presenceLabel(isOnline, lastSeenAt, isIdle)}</p>
              </div>
              <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDm(user.id)}
                  title="Message"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCall(user.id, user.display_name)}
                  title="Call"
                >
                  <Phone className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </ScrollArea>
    </aside>
  );
}
