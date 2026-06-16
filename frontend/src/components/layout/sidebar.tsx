"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, isYesterday } from "date-fns";
import { LogOut, Plus, Search, Settings, ShieldBan, ShieldCheck, Trash2, UserMinus } from "lucide-react";
import { AddFriendDialog } from "@/components/friends/add-friend-dialog";
import { FriendRequests } from "@/components/friends/friend-requests";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePresenceTick } from "@/hooks/use-presence-tick";
import { presenceColor, presenceLabel } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { filterRooms, useChatStore } from "@/stores/chat-store";

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

function SectionHeader({
  title,
  badge,
  onAdd,
  addTitle,
}: {
  title: string;
  badge?: number;
  onAdd?: () => void;
  addTitle?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#4a4e6a]">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-violet-950/80 px-2.5 py-1 text-xs font-semibold text-violet-400">
            {badge}
          </span>
        )}
      </div>
      {onAdd && (
        <button
          className="flex h-6 w-6 items-center justify-center text-[#4a4e6a] transition-colors hover:text-violet-300"
          title={addTitle}
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

export function Sidebar() {
  usePresenceTick();
  const router = useRouter();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);

  type Confirm =
    | { type: "unfriend"; userId: string; name: string }
    | { type: "block"; userId: string; name: string }
    | { type: "unblock"; userId: string; name: string }
    | { type: "deleteGroup"; roomId: string; name: string }
    | null;
  const [confirm, setConfirm] = useState<Confirm>(null);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const rooms = useChatStore((s) => s.rooms);
  const friends = useChatStore((s) => s.friends);
  const conversations = useChatStore((s) => s.conversations);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const activeTarget = useChatStore((s) => s.activeTarget);
  const setActiveTarget = useChatStore((s) => s.setActiveTarget);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const startDm = useChatStore((s) => s.startDm);
  const unfriend = useChatStore((s) => s.unfriend);
  const blockUser = useChatStore((s) => s.blockUser);
  const unblockUser = useChatStore((s) => s.unblockUser);
  const blockedUserIds = useChatStore((s) => s.blockedUserIds);
  const deleteGroup = useChatStore((s) => s.deleteGroup);
  const unreadCounts = useChatStore((s) => s.unreadCounts);

  const groups = filterRooms(rooms, "group");

  const selectRoom = async (room: (typeof rooms)[0]) => {
    setActiveTarget({ type: "room", room });
    await loadMessages();
  };

  const selectDm = async (conv: (typeof conversations)[0]) => {
    setActiveTarget({ type: "dm", conversation: conv });
    await loadMessages();
  };

  const messageFriend = async (friendId: string) => {
    await startDm(friendId);
    await loadMessages();
  };

  return (
    <>
      <aside
        className={cn(
          "flex-col bg-[#13152a] shrink-0 border-r border-white/[0.06]",
          "w-full md:w-80",
          activeTarget ? "hidden md:flex" : "flex",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 font-bold text-white shadow-lg shadow-violet-900/50">
            C
          </div>
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight text-white leading-none">Chat</span>
            <span className="text-[10px] uppercase tracking-widest text-[#4a4e6a] mt-0.5">By System</span>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center gap-2 rounded-lg bg-[#1a1d35] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#4a4e6a]" />
            <input
              type="text"
              placeholder="Search conversations"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a4e6a] focus:outline-none"
              readOnly
            />
          </div>
        </div>

        {/* Scrollable list */}
        <ScrollArea className="flex-1 px-3 py-3">
          <FriendRequests />

          {/* Friends */}
          <section className="mb-5">
            <SectionHeader
              title="Friends"
              badge={friends.length}
              onAdd={() => setAddFriendOpen(true)}
              addTitle="Add friend"
            />
            {friends.length === 0 && (
              <p className="px-2 py-1 text-xs text-[#4a4e6a]">No friends yet</p>
            )}
            {friends.map((friend) => {
              const presence = onlineUsers.get(friend.id);
              const isOnline = presence?.isOnline ?? friend.is_online;
              const isIdle = presence?.isIdle ?? false;
              const lastSeenAt = presence?.lastSeenAt ?? friend.last_seen_at;
              return (
                <div
                  key={friend.id}
                  className="group flex w-full items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[#1a1d35]"
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                    onClick={() => messageFriend(friend.id)}
                    title={presenceLabel(isOnline, lastSeenAt, isIdle)}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white",
                          avatarBg(friend.display_name),
                        )}
                      >
                        {friend.display_name[0].toUpperCase()}
                      </div>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#13152a]",
                          presenceColor(isOnline, lastSeenAt, isIdle),
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-white">{friend.display_name}</p>
                      <p className={cn("truncate text-xs", isOnline ? "text-emerald-400" : "text-[#8b8fa8]")}>
                        {presenceLabel(isOnline, lastSeenAt, isIdle)}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
                    {blockedUserIds.has(friend.id) ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:text-emerald-400"
                        title="Unblock"
                        onClick={() =>
                          setConfirm({ type: "unblock", userId: friend.id, name: friend.display_name })
                        }
                      >
                        <ShieldCheck className="h-3 w-3" />
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:text-red-400"
                          title="Unfriend"
                          onClick={() =>
                            setConfirm({ type: "unfriend", userId: friend.id, name: friend.display_name })
                          }
                        >
                          <UserMinus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:text-orange-400"
                          title="Block"
                          onClick={() =>
                            setConfirm({ type: "block", userId: friend.id, name: friend.display_name })
                          }
                        >
                          <ShieldBan className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Groups */}
          <section className="mb-5">
            <SectionHeader title="Groups" onAdd={() => setCreateGroupOpen(true)} addTitle="Create group" />
            {groups.length === 0 && (
              <p className="px-2 py-1 text-xs text-[#4a4e6a]">No groups yet</p>
            )}
            {groups.map((room) => {
              const isActive = activeTarget?.type === "room" && activeTarget.room.id === room.id;
              const roomUnread = unreadCounts.get(`room:${room.id}`) ?? 0;
              return (
                <div
                  key={room.id}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-2 py-2 transition-colors",
                    isActive ? "bg-[#1e2040] border-l-2 border-violet-500" : "hover:bg-[#1a1d35]",
                  )}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3"
                    onClick={() => selectRoom(room)}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                        avatarBg(room.name),
                      )}
                    >
                      {room.name[0].toUpperCase()}
                    </div>
                    <span className={cn("truncate text-sm font-medium", isActive ? "text-white" : "text-[#c8cde8]")}>
                      {room.name}
                    </span>
                    {roomUnread > 0 && !isActive && (
                      <span className="ml-auto shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[18px] text-center">
                        {roomUnread > 99 ? "99+" : roomUnread}
                      </span>
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                    title="Delete group"
                    onClick={() => setConfirm({ type: "deleteGroup", roomId: room.id, name: room.name })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </section>

          {/* DMs */}
          <section>
            <SectionHeader title="Direct Messages" />
            {conversations.length === 0 && (
              <p className="px-2 py-1 text-xs text-[#4a4e6a]">No conversations yet</p>
            )}
            {conversations.map((conv) => {
              const other = conv.other_user;
              const presence = other ? onlineUsers.get(other.id) : undefined;
              const isOnline = presence?.isOnline ?? other?.is_online ?? false;
              const isIdle = presence?.isIdle ?? false;
              const lastSeenAt = presence?.lastSeenAt ?? other?.last_seen_at ?? null;
              const isActive = activeTarget?.type === "dm" && activeTarget.conversation.id === conv.id;
              const dmUnread = unreadCounts.get(`dm:${conv.id}`) ?? 0;

              const ts = conv.created_at;
              const d = new Date(ts);
              const label = isToday(d)
                ? format(d, "h:mm a")
                : isYesterday(d)
                ? "Yesterday"
                : format(d, "EEE");

              return (
                <button
                  key={conv.id}
                  onClick={() => selectDm(conv)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                    isActive ? "bg-[#1e2040] border-l-2 border-violet-500" : "hover:bg-[#1a1d35]",
                  )}
                >
                  <div
                    className={cn(
                      "h-10 w-10 shrink-0 flex items-center justify-center rounded-full text-sm font-bold text-white",
                      avatarBg(other?.display_name || "?"),
                    )}
                  >
                    {(other?.display_name || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">{other?.display_name || "Unknown"}</p>
                      <span className="shrink-0 text-[11px] text-[#4a4e6a]">{label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="truncate text-xs text-[#8b8fa8]">{conv.last_message || "No messages yet"}</p>
                      {dmUnread > 0 && !isActive && (
                        <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[18px] text-center">
                          {dmUnread > 99 ? "99+" : dmUnread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        </ScrollArea>

        {/* User footer */}
        <div className="border-t border-white/[0.06] px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <div className="relative shrink-0">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white",
                  avatarBg(user?.display_name ?? "?"),
                )}
              >
                {user?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#13152a] bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.display_name}</p>
              <p className="truncate text-xs text-[#8b8fa8]">@{user?.username}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-[#4a4e6a] hover:text-white"
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-[#4a4e6a] hover:text-white"
              title="Log out"
              onClick={() => logout().then(() => router.push("/login"))}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />
      <AddFriendDialog open={addFriendOpen} onOpenChange={setAddFriendOpen} />

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === "deleteGroup"
            ? `Delete "${confirm.name}"?`
            : confirm?.type === "unfriend"
            ? `Unfriend ${confirm.name}?`
            : confirm?.type === "block"
            ? `Block ${confirm.name}?`
            : confirm?.type === "unblock"
            ? `Unblock ${confirm.name}?`
            : ""
        }
        description={
          confirm?.type === "deleteGroup"
            ? "This will permanently delete the group and all its messages."
            : confirm?.type === "unfriend"
            ? "You will need to send a new friend request to reconnect."
            : confirm?.type === "block"
            ? "They won't be able to message you and you won't be able to message them."
            : confirm?.type === "unblock"
            ? "They will be able to message you again."
            : undefined
        }
        confirmLabel={
          confirm?.type === "unblock"
            ? "Unblock"
            : confirm?.type === "block"
            ? "Block"
            : confirm?.type === "unfriend"
            ? "Unfriend"
            : "Delete"
        }
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.type === "deleteGroup") deleteGroup(confirm.roomId);
          else if (confirm.type === "unfriend") unfriend(confirm.userId);
          else if (confirm.type === "block") blockUser(confirm.userId);
          else if (confirm.type === "unblock") unblockUser(confirm.userId);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
