"use client";

import { useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";
import { useCallStore } from "@/stores/call-store";

export function useWebRTC() {
  const user = useAuthStore((s) => s.user);
  const callState = useCallStore();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const attachStream = useCallback((video: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (video && stream) {
      video.srcObject = stream;
    }
  }, []);

  const cleanup = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    pendingCandidatesRef.current = [];
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    sessionStorage.removeItem("call_rejoin");
    callState.reset();
  }, [callState]);

  const createPeer = useCallback(async () => {
    if (!iceServersRef.current.length) {
      const config = await api.get<{ iceServers: RTCIceServer[] }>("/turn-config");
      iceServersRef.current = config.iceServers;
    }

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pc.onicecandidate = (event) => {
      // Read from store directly so we always get the current remoteUserId/roomKey,
      // not a stale closure value from when createPeer was last instantiated.
      const { remoteUserId, roomKey } = useCallStore.getState();
      if (event.candidate && remoteUserId && roomKey) {
        getSocket().emit("ice_candidate", {
          target_id: remoteUserId,
          candidate: event.candidate,
          room_key: roomKey,
        });
      }
    };
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        pc.restartIce();
      }
    };
    peerRef.current = pc;
    return pc;
  }, []); // no deps — reads live store state inside handlers

  const getLocalStream = useCallback(async (video = true) => {
    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video,
      });
      attachStream(localVideoRef.current, localStreamRef.current);
    }
    return localStreamRef.current;
  }, [attachStream]);

  const drainPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const queued = pendingCandidatesRef.current.splice(0);
    for (const c of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    }
  }, []);

  const startCall = useCallback(
    async (calleeId: string, displayName: string, withVideo = true) => {
      if (!user) return;
      callState.setRemote(calleeId, displayName);
      callState.setWithVideo(withVideo);
      callState.setState("outgoing");

      const stream = await getLocalStream(withVideo);
      const pc = await createPeer();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      getSocket().emit("call_offer", {
        callee_id: calleeId,
        sdp: pc.localDescription,
        type: "offer",
        with_video: withVideo,
      });
    },
    [user, callState, createPeer, getLocalStream],
  );

  const answerCall = useCallback(
    async (callerId: string, roomKey: string, sdp: RTCSessionDescriptionInit) => {
      callState.setRoomKey(roomKey);
      callState.setState("active");

      const { withVideo } = useCallStore.getState();
      const stream = await getLocalStream(withVideo);
      const pc = await createPeer();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await drainPendingCandidates(pc);
      const { remoteUserId, remoteDisplayName } = useCallStore.getState();
      if (remoteUserId && remoteDisplayName) {
        sessionStorage.setItem("call_rejoin", JSON.stringify({ remoteUserId, remoteDisplayName }));
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      getSocket().emit("call_answer", {
        caller_id: callerId,
        room_key: roomKey,
        sdp: pc.localDescription,
        type: "answer",
      });
    },
    [callState, createPeer, getLocalStream, drainPendingCandidates],
  );

  const handleRemoteAnswer = useCallback(
    async (sdp: RTCSessionDescriptionInit) => {
      const pc = peerRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await drainPendingCandidates(pc);
      const { remoteUserId, remoteDisplayName } = useCallStore.getState();
      if (remoteUserId && remoteDisplayName) {
        sessionStorage.setItem("call_rejoin", JSON.stringify({ remoteUserId, remoteDisplayName }));
      }
      callState.setState("active");
    },
    [callState, drainPendingCandidates],
  );

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerRef.current;
    if (!pc) return;
    // Queue the candidate if remote description isn't set yet — it will be
    // drained by drainPendingCandidates() once setRemoteDescription completes.
    if (!pc.remoteDescription) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const endCall = useCallback(() => {
    if (callState.remoteUserId) {
      getSocket().emit("call_end", {
        target_id: callState.remoteUserId,
        room_key: callState.roomKey,
      });
    }
    cleanup();
  }, [callState.remoteUserId, callState.roomKey, cleanup]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = callState.isMuted;
    });
    callState.toggleMute();
  }, [callState]);

  const toggleVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = callState.isVideoOff;
    });
    callState.toggleVideo();
  }, [callState]);

  const switchCamera = useCallback(async () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((d) => d.kind === "videoinput");
    if (cameras.length < 2) return;
    const current = videoTrack.getSettings().deviceId;
    const next = cameras.find((c) => c.deviceId !== current) || cameras[0];
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: next.deviceId } },
      audio: true,
    });
    const newTrack = newStream.getVideoTracks()[0];
    const sender = peerRef.current?.getSenders().find((s) => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(newTrack);
    videoTrack.stop();
    localStreamRef.current?.removeTrack(videoTrack);
    localStreamRef.current?.addTrack(newTrack);
    attachStream(localVideoRef.current, localStreamRef.current);
  }, [attachStream]);

  const toggleScreenShare = useCallback(async () => {
    const pc = peerRef.current;
    if (!pc) return;

    if (callState.isScreenSharing) {
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && cameraTrack) await sender.replaceTrack(cameraTrack);
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      callState.toggleScreenShare();
      return;
    }

    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenStreamRef.current = screen;
    const screenTrack = screen.getVideoTracks()[0];
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(screenTrack);
    screenTrack.onended = () => toggleScreenShare();
    callState.toggleScreenShare();
  }, [callState]);

  // Keep stable refs to the latest callbacks so the socket listeners never
  // need to be torn down and re-registered (which would open a gap where an
  // incoming event like call_answered could be silently dropped).
  const handleRemoteAnswerRef = useRef(handleRemoteAnswer);
  const handleIceCandidateRef = useRef(handleIceCandidate);
  const cleanupRef = useRef(cleanup);
  useEffect(() => { handleRemoteAnswerRef.current = handleRemoteAnswer; }, [handleRemoteAnswer]);
  useEffect(() => { handleIceCandidateRef.current = handleIceCandidate; }, [handleIceCandidate]);
  useEffect(() => { cleanupRef.current = cleanup; }, [cleanup]);

  useEffect(() => {
    const socket = getSocket();

    socket.on(
      "incoming_call",
      (data: { caller_id: string; caller_name?: string; room_key: string; sdp: RTCSessionDescriptionInit; with_video?: boolean }) => {
        const store = useCallStore.getState();
        if (store.state !== "idle") return;
        store.setRoomKey(data.room_key);
        store.setRemote(data.caller_id, data.caller_name ?? "Incoming call");
        store.setWithVideo(data.with_video ?? true);
        store.setState("incoming");
        (window as unknown as { __pendingCall?: typeof data }).__pendingCall = data;
      },
    );

    socket.on(
      "call_answered",
      async (data: { room_key: string; sdp: RTCSessionDescriptionInit }) => {
        useCallStore.getState().setRoomKey(data.room_key);
        await handleRemoteAnswerRef.current(data.sdp);
      },
    );

    socket.on(
      "ice_candidate",
      async (data: { candidate: RTCIceCandidateInit }) => {
        await handleIceCandidateRef.current(data.candidate);
      },
    );

    socket.on("call_ended", () => cleanupRef.current());

    return () => {
      socket.off("incoming_call");
      socket.off("call_answered");
      socket.off("ice_candidate");
      socket.off("call_ended");
    };
  }, []); // register once — handlers stay current via refs above

  return {
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    toggleScreenShare,
    cleanup,
  };
}
