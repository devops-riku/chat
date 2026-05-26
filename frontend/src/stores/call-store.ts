import { create } from "zustand";

export type CallState = "idle" | "outgoing" | "incoming" | "active";

type CallStore = {
  state: CallState;
  remoteUserId: string | null;
  remoteDisplayName: string | null;
  roomKey: string | null;
  withVideo: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  setState: (state: CallState) => void;
  setRemote: (userId: string, displayName: string) => void;
  setRoomKey: (key: string) => void;
  setWithVideo: (withVideo: boolean) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  reset: () => void;
};

export const useCallStore = create<CallStore>((set) => ({
  state: "idle",
  remoteUserId: null,
  remoteDisplayName: null,
  roomKey: null,
  withVideo: true,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,

  setState: (state) => set({ state }),
  setRemote: (remoteUserId, remoteDisplayName) => set({ remoteUserId, remoteDisplayName }),
  setRoomKey: (roomKey) => set({ roomKey }),
  setWithVideo: (withVideo) => set({ withVideo }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleVideo: () => set((s) => ({ isVideoOff: !s.isVideoOff })),
  toggleScreenShare: () => set((s) => ({ isScreenSharing: !s.isScreenSharing })),
  reset: () =>
    set({
      state: "idle",
      remoteUserId: null,
      remoteDisplayName: null,
      roomKey: null,
      withVideo: true,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
    }),
}));
