"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CallModal } from "@/components/call/call-modal";
import { RejoinCallBanner } from "@/components/call/rejoin-call-banner";
import { ChatPanel } from "@/components/chat/chat-panel";
import { MembersPanel } from "@/components/layout/members-panel";
import { Sidebar } from "@/components/layout/sidebar";
import { useIdleDetection } from "@/hooks/use-idle-detection";
import { useSocket } from "@/hooks/use-socket";
import { useTabTitle } from "@/hooks/use-tab-title";
import { useWebRTC } from "@/hooks/use-webrtc";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";

export default function ChatPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, fetchMe } = useAuthStore();
  const { loadRooms, loadConversations, loadFriends, loadFriendRequests, loadUsers, loadBlocked, loadBlockingMe, restoreActiveTarget, loadMessages } = useChatStore();

  useSocket();
  useIdleDetection();
  useTabTitle();
  const webrtc = useWebRTC();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void Promise.all([
        loadRooms(),
        loadConversations(),
        loadFriends(),
        loadFriendRequests(),
        loadUsers(),
        loadBlocked(),
        loadBlockingMe(),
      ]).then(() => {
        restoreActiveTarget();
        void loadMessages();
      });
    }
  }, [isAuthenticated, loadRooms, loadConversations, loadFriends, loadFriendRequests, loadUsers, restoreActiveTarget, loadMessages]);

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0e1020]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-900/50">
            C
          </div>
          <p className="text-sm text-zinc-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-dvh overflow-hidden bg-[#0e1020]">
      <Sidebar />
      <ChatPanel onCall={webrtc.startCall} />
      <MembersPanel onCall={webrtc.startCall} />

      <CallModal {...webrtc} />
      <RejoinCallBanner onRejoin={webrtc.startCall} />
    </div>
  );
}
