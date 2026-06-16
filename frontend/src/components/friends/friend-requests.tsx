"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";

export function FriendRequests() {
  const friendRequests = useChatStore((s) => s.friendRequests);
  const acceptFriendRequest = useChatStore((s) => s.acceptFriendRequest);
  const rejectFriendRequest = useChatStore((s) => s.rejectFriendRequest);

  if (friendRequests.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-violet-900/50 bg-violet-950/20 p-2">
      <p className="mb-2 px-1 text-xs font-semibold uppercase text-violet-300">Friend requests</p>
      {friendRequests.map((req) => (
        <div key={req.id} className="mb-1 flex items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-[#1d1533]">
          <span className="truncate text-sm text-violet-200">
            {req.friend?.display_name || "Someone"}
          </span>
          <div className="flex shrink-0 gap-1">
            <Button
              size="icon"
              className="h-7 w-7 bg-emerald-600 hover:bg-emerald-500"
              title="Accept"
              onClick={() => acceptFriendRequest(req.id)}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Decline"
              onClick={() => rejectFriendRequest(req.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
