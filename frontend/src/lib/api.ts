const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).join(", ")
      : detail || res.statusText;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function uploadFile(file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/uploads`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail || res.statusText, res.status);
  }
  return res.json() as Promise<Attachment>;
}

export type User = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string | null;
};

export type Room = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  room_type: "global" | "channel" | "group";
  created_at: string;
};

export type Attachment = {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
};

export type MessageReplyPreview = {
  id: string;
  content: string;
  author_id: string;
  author: User | null;
};

export type Message = {
  id: string;
  content: string;
  author_id: string;
  room_id: string | null;
  conversation_id: string | null;
  parent_id: string | null;
  created_at: string;
  author: User | null;
  read_count: number;
  reply_to: MessageReplyPreview | null;
  attachments: Attachment[];
};

export type Conversation = {
  id: string;
  user_one_id: string;
  user_two_id: string;
  created_at: string;
  other_user: User | null;
  last_message: string | null;
};

export type FriendshipRequest = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  friend: User | null;
};
