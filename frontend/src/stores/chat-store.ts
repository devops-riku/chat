import { create } from "zustand";
import {
  api,
  type Conversation,
  type FriendshipRequest,
  type Message,
  type Room,
  type User,
} from "@/lib/api";

export type ChatTarget =
  | { type: "room"; room: Room }
  | { type: "dm"; conversation: Conversation };

type ChatState = {
  rooms: Room[];
  conversations: Conversation[];
  friends: User[];
  friendRequests: FriendshipRequest[];
  users: User[];
  messages: Message[];
  hasMoreMessages: boolean;
  loadingOlderMessages: boolean;
  activeTarget: ChatTarget | null;
  replyingTo: Message | null;
  typingUsers: Map<string, string>; // userId → contextKey ("room:id" | "dm:id")
  onlineUsers: Map<string, { isOnline: boolean; isIdle: boolean; lastSeenAt: string | null }>;
  blockedUserIds: Set<string>;
  blockedByIds: Set<string>;
  // messageId → ordered list of reader userIds (real-time updates from socket)
  seenBy: Map<string, string[]>;
  setActiveTarget: (target: ChatTarget | null) => void;
  markMessageSeen: (messageId: string, readerId: string) => void;
  setReplyingTo: (message: Message | null) => void;
  loadRooms: () => Promise<void>;
  loadConversations: () => Promise<void>;
  loadFriends: () => Promise<void>;
  loadFriendRequests: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loadMessages: () => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  addMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;
  setTyping: (userId: string, contextKey: string, typing: boolean) => void;
  setPresence: (userId: string, isOnline: boolean, lastSeenAt?: string | null, isIdle?: boolean) => void;
  startDm: (userId: string) => Promise<Conversation>;
  createGroup: (data: { name: string; description?: string; member_ids: string[] }) => Promise<Room>;
  searchUsers: (query: string) => Promise<User[]>;
  sendFriendRequest: (userId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  rejectFriendRequest: (friendshipId: string) => Promise<void>;
  unfriend: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  loadBlocked: () => Promise<void>;
  loadBlockingMe: () => Promise<void>;
  addFriendRequest: (req: FriendshipRequest) => void;
  removeFriendRequest: (friendshipId: string) => void;
  addBlockedBy: (userId: string) => void;
  removeBlockedBy: (userId: string) => void;
  deleteGroup: (roomId: string) => Promise<void>;
  removeGroup: (roomId: string) => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  conversations: [],
  friends: [],
  friendRequests: [],
  users: [],
  messages: [],
  hasMoreMessages: false,
  loadingOlderMessages: false,
  activeTarget: null,
  replyingTo: null,
  typingUsers: new Map(),
  onlineUsers: new Map(),
  blockedUserIds: new Set(),
  blockedByIds: new Set(),
  seenBy: new Map(),

  setActiveTarget: (target) =>
    set({ activeTarget: target, messages: [], hasMoreMessages: false, loadingOlderMessages: false, typingUsers: new Map(), replyingTo: null, seenBy: new Map() }),

  markMessageSeen: (messageId, readerId) =>
    set((s) => {
      const seenBy = new Map(s.seenBy);
      const prev = seenBy.get(messageId) ?? [];
      if (prev.includes(readerId)) return s;
      seenBy.set(messageId, [...prev, readerId]);
      // Also bump read_count on the message so initial-load and real-time stay consistent
      const messages = s.messages.map((m) =>
        m.id === messageId ? { ...m, read_count: m.read_count + 1 } : m,
      );
      return { seenBy, messages };
    }),

  setReplyingTo: (message) => set({ replyingTo: message }),

  loadRooms: async () => {
    const rooms = await api.get<Room[]>("/rooms");
    set({ rooms });
  },

  loadConversations: async () => {
    const conversations = await api.get<Conversation[]>("/conversations");
    set({ conversations });
  },

  loadFriends: async () => {
    const friends = await api.get<User[]>("/friends");
    set({ friends });
  },

  loadFriendRequests: async () => {
    const friendRequests = await api.get<FriendshipRequest[]>("/friends/requests");
    set({ friendRequests });
  },

  loadUsers: async () => {
    const users = await api.get<User[]>("/conversations/users");
    const onlineUsers = new Map(
      users.map((u) => [u.id, { isOnline: u.is_online, isIdle: false, lastSeenAt: u.last_seen_at }]),
    );
    set({ users, onlineUsers });
  },

  loadMessages: async () => {
    const target = get().activeTarget;
    if (!target) return;
    const limit = 50;
    if (target.type === "room") {
      const messages = await api.get<Message[]>(`/messages/room/${target.room.id}?limit=${limit}`);
      set({ messages, hasMoreMessages: messages.length >= limit });
    } else {
      const messages = await api.get<Message[]>(`/messages/dm/${target.conversation.id}?limit=${limit}`);
      set({ messages, hasMoreMessages: messages.length >= limit });
    }
  },

  loadOlderMessages: async () => {
    const { activeTarget, messages, loadingOlderMessages, hasMoreMessages } = get();
    if (!activeTarget || loadingOlderMessages || !hasMoreMessages) return;
    const oldest = messages[0];
    if (!oldest) return;
    const limit = 50;
    set({ loadingOlderMessages: true });
    try {
      let older: Message[];
      if (activeTarget.type === "room") {
        older = await api.get<Message[]>(`/messages/room/${activeTarget.room.id}?limit=${limit}&before_id=${oldest.id}`);
      } else {
        older = await api.get<Message[]>(`/messages/dm/${activeTarget.conversation.id}?limit=${limit}&before_id=${oldest.id}`);
      }
      set((s) => ({
        messages: [...older, ...s.messages],
        hasMoreMessages: older.length >= limit,
        loadingOlderMessages: false,
      }));
    } catch {
      set({ loadingOlderMessages: false });
    }
  },

  addMessage: (message) => {
    set((state) => {
      const target = state.activeTarget;
      if (!target) return state;
      if (target.type === "room" && message.room_id !== target.room.id) return state;
      if (target.type === "dm" && message.conversation_id !== target.conversation.id) return state;
      const exists = state.messages.some((m) => m.id === message.id);
      if (exists) return state;
      return { messages: [...state.messages, message] };
    });
  },

  removeMessage: (messageId) => {
    set((state) => ({ messages: state.messages.filter((m) => m.id !== messageId) }));
  },


  setTyping: (userId, contextKey, typing) => {
    set((state) => {
      const next = new Map(state.typingUsers);
      if (typing) next.set(userId, contextKey);
      else next.delete(userId);
      return { typingUsers: next };
    });
  },

  setPresence: (userId, isOnline, lastSeenAt, isIdle) => {
    set((state) => {
      const onlineUsers = new Map(state.onlineUsers);
      const prev = state.onlineUsers.get(userId);
      onlineUsers.set(userId, {
        isOnline,
        isIdle: isIdle !== undefined ? isIdle : (prev?.isIdle ?? false),
        lastSeenAt: lastSeenAt !== undefined ? lastSeenAt : (prev?.lastSeenAt ?? null),
      });
      return { onlineUsers };
    });
  },

  startDm: async (userId) => {
    const conversation = await api.post<Conversation>(`/conversations/with/${userId}`);
    set((state) => ({
      conversations: [
        conversation,
        ...state.conversations.filter((c) => c.id !== conversation.id),
      ],
      activeTarget: { type: "dm", conversation },
      replyingTo: null,
    }));
    return conversation;
  },

  createGroup: async (data) => {
    const room = await api.post<Room>("/rooms/groups", data);
    set((state) => ({
      rooms: [...state.rooms.filter((r) => r.id !== room.id), room].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      activeTarget: { type: "room", room },
      messages: [],
      replyingTo: null,
    }));
    const messages = await api.get<Message[]>(`/messages/room/${room.id}`);
    set({ messages });
    return room;
  },

  searchUsers: async (query) => api.get<User[]>(`/friends/search?q=${encodeURIComponent(query)}`),

  sendFriendRequest: async (userId) => {
    await api.post("/friends/request", { user_id: userId });
    await get().loadFriendRequests();
  },

  acceptFriendRequest: async (friendshipId) => {
    await api.post(`/friends/requests/${friendshipId}/accept`);
    await Promise.all([get().loadFriendRequests(), get().loadFriends(), get().loadUsers()]);
  },

  rejectFriendRequest: async (friendshipId) => {
    await api.post(`/friends/requests/${friendshipId}/reject`);
    await get().loadFriendRequests();
  },

  unfriend: async (userId) => {
    await api.delete(`/friends/${userId}`);
    set((s) => ({ friends: s.friends.filter((f) => f.id !== userId) }));
  },

  blockUser: async (userId) => {
    await api.post(`/friends/${userId}/block`);
    set((s) => ({ blockedUserIds: new Set([...s.blockedUserIds, userId]) }));
  },

  unblockUser: async (userId) => {
    await api.post(`/friends/${userId}/unblock`);
    set((s) => {
      const next = new Set(s.blockedUserIds);
      next.delete(userId);
      return { blockedUserIds: next };
    });
  },

  loadBlocked: async () => {
    const blocked = await api.get<User[]>("/friends/blocked");
    set({ blockedUserIds: new Set(blocked.map((u) => u.id)) });
  },

  loadBlockingMe: async () => {
    const blocking = await api.get<User[]>("/friends/blocking-me");
    set({ blockedByIds: new Set(blocking.map((u) => u.id)) });
  },

  addFriendRequest: (req) => {
    set((s) => {
      if (s.friendRequests.some((r) => r.id === req.id)) return s;
      return { friendRequests: [req, ...s.friendRequests] };
    });
  },

  removeFriendRequest: (friendshipId) => {
    set((s) => ({ friendRequests: s.friendRequests.filter((r) => r.id !== friendshipId) }));
  },

  addBlockedBy: (userId) => {
    set((s) => ({ blockedByIds: new Set([...s.blockedByIds, userId]) }));
  },

  removeBlockedBy: (userId) => {
    set((s) => {
      const next = new Set(s.blockedByIds);
      next.delete(userId);
      return { blockedByIds: next };
    });
  },

  deleteGroup: async (roomId) => {
    await api.delete(`/rooms/${roomId}`);
    // UI is updated via the group_deleted socket event
  },

  removeGroup: (roomId) => {
    set((s) => {
      const rooms = s.rooms.filter((r) => r.id !== roomId);
      const activeTarget = s.activeTarget?.type === "room" && s.activeTarget.room.id === roomId
        ? null
        : s.activeTarget;
      return { rooms, activeTarget, messages: activeTarget ? s.messages : [] };
    });
  },
}));

export function filterRooms(rooms: Room[], type: Room["room_type"] | Room["room_type"][]) {
  const types = Array.isArray(type) ? type : [type];
  return rooms.filter((r) => types.includes(r.room_type));
}
