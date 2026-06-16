"use client";

import { useEffect, useRef } from "react";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import type { Message } from "@/lib/api";

export function useSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addMessage = useChatStore((s) => s.addMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const removeGroup = useChatStore((s) => s.removeGroup);
  const addBlockedBy = useChatStore((s) => s.addBlockedBy);
  const removeBlockedBy = useChatStore((s) => s.removeBlockedBy);
  const addFriendRequest = useChatStore((s) => s.addFriendRequest);
  const removeFriendRequest = useChatStore((s) => s.removeFriendRequest);
  const loadFriends = useChatStore((s) => s.loadFriends);
  const setTyping = useChatStore((s) => s.setTyping);
  const setPresence = useChatStore((s) => s.setPresence);
  const markMessageSeen = useChatStore((s) => s.markMessageSeen);
  const incrementUnread = useChatStore((s) => s.incrementUnread);
  const activeTarget = useChatStore((s) => s.activeTarget);
  const joinedRef = useRef<string | null>(null);
  const activeTargetRef = useRef(activeTarget);

  // Tell the server we're going offline before the tab closes, then disconnect.
  // This guarantees the server marks the user offline immediately rather than
  // waiting up to ~20s for the ping timeout to fire.
  useEffect(() => {
    const handleBeforeUnload = () => {
      const s = getSocket();
      if (s.connected) {
        s.emit("going_offline", {});
      }
      disconnectSocket();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    activeTargetRef.current = activeTarget;
  }, [activeTarget]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    const onConnect = () => {
      // Reset joinedRef so the join-room effect below re-emits join_room/join_dm
      joinedRef.current = null;
      // Immediately re-join the active target so we don't wait for the effect cycle
      const target = activeTargetRef.current;
      if (target) {
        if (target.type === "room") {
          socket.emit("join_room", { room_id: target.room.id });
        } else {
          socket.emit("join_dm", { conversation_id: target.conversation.id });
        }
      }
    };
    socket.on("connect", onConnect);

    socket.on("new_message", (message: Message) => {
      addMessage(message);
      const me = useAuthStore.getState().user;
      if (message.author_id !== me?.id) {
        const msgKey = message.room_id ? `room:${message.room_id}` : `dm:${message.conversation_id}`;
        const target = activeTargetRef.current;
        const activeKey = target
          ? (target.type === "room" ? `room:${target.room.id}` : `dm:${target.conversation.id}`)
          : null;
        if (msgKey !== activeKey) incrementUnread(msgKey);
      }
    });

    // dm_notification fires on the personal user channel when a DM arrives in
    // a conversation the user isn't currently viewing — used for unread counts.
    socket.on("dm_notification", () => {
      // TODO: increment unread badge for the conversation in the sidebar
    });

    socket.on("typing", (data: { user_id: string; typing: boolean; room_id?: string; conversation_id?: string }) => {
      const contextKey = data.room_id ? `room:${data.room_id}` : `dm:${data.conversation_id}`;
      setTyping(data.user_id, contextKey, data.typing);
    });

    socket.on("presence_update", (data: { user_id: string; is_online: boolean; last_seen_at?: string | null; is_idle?: boolean }) => {
      setPresence(data.user_id, data.is_online, data.last_seen_at, data.is_idle);
    });

    socket.on("message_read", (data: { message_id: string; user_id: string }) => {
      markMessageSeen(data.message_id, data.user_id);
    });

    socket.on("message_deleted", (data: { message_id: string }) => {
      removeMessage(data.message_id);
    });

    socket.on("group_deleted", (data: { room_id: string }) => {
      removeGroup(data.room_id);
    });

    socket.on("you_are_blocked", (data: { by_user_id: string }) => {
      addBlockedBy(data.by_user_id);
    });

    socket.on("you_are_unblocked", (data: { by_user_id: string }) => {
      removeBlockedBy(data.by_user_id);
    });

    socket.on("friend_request_received", (req) => {
      addFriendRequest(req);
    });

    socket.on("friend_request_accepted", (req) => {
      removeFriendRequest(req.id);
      void loadFriends();
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("new_message");
      socket.off("dm_notification");
      socket.off("typing");
      socket.off("presence_update");
      socket.off("message_read");
      socket.off("message_deleted");
      socket.off("group_deleted");
      socket.off("you_are_blocked");
      socket.off("you_are_unblocked");
      socket.off("friend_request_received");
      socket.off("friend_request_accepted");
    };
  }, [isAuthenticated, addMessage, removeMessage, removeGroup, addBlockedBy, removeBlockedBy, addFriendRequest, removeFriendRequest, loadFriends, setTyping, setPresence, markMessageSeen, incrementUnread]);

  useEffect(() => {
    if (!isAuthenticated || !activeTarget) return;

    const key =
      activeTarget.type === "room"
        ? `room:${activeTarget.room.id}`
        : `dm:${activeTarget.conversation.id}`;

    if (joinedRef.current === key) return;
    joinedRef.current = key;

    if (activeTarget.type === "room") {
      getSocket().emit("join_room", { room_id: activeTarget.room.id });
    } else {
      getSocket().emit("join_dm", { conversation_id: activeTarget.conversation.id });
    }
  }, [isAuthenticated, activeTarget]);

  return getSocket();
}
