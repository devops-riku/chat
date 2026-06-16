"use client";

import { useState } from "react";
import {
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallStore } from "@/stores/call-store";
import type { useWebRTC } from "@/hooks/use-webrtc";

type Props = ReturnType<typeof useWebRTC>;

export function CallModal({
  localVideoRef,
  remoteVideoRef,
  answerCall,
  endCall,
  toggleMute,
  toggleVideo,
  switchCamera,
  toggleScreenShare,
}: Props) {
  const callState = useCallStore();
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  if (callState.state === "idle") return null;

  const handleAccept = async () => {
    const pending = (window as unknown as { __pendingCall?: {
      caller_id: string;
      room_key: string;
      sdp: RTCSessionDescriptionInit;
    } }).__pendingCall;
    if (pending) {
      await answerCall(pending.caller_id, pending.room_key, pending.sdp);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in sm:items-center">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-t-3xl bg-[#150e24] ring-1 ring-violet-800/40 sm:rounded-3xl">
        {/* Video grid */}
        <div className="grid grid-cols-1 gap-px bg-violet-800/40 sm:grid-cols-2">
          <div className="relative bg-[#0e0b15] h-44 sm:h-auto sm:aspect-video">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
              onCanPlay={() => setHasRemoteVideo(true)}
            />
            {!hasRemoteVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-violet-400/50">
                <div className="h-14 w-14 rounded-full bg-[#2a1f4a] flex items-center justify-center text-2xl font-bold text-violet-400/50">
                  {callState.remoteDisplayName?.[0]?.toUpperCase() ?? "?"}
                </div>
                <p className="text-sm">{callState.state === "outgoing" ? "Calling…" : "Connecting…"}</p>
              </div>
            )}
            <div className="absolute bottom-2 left-2 rounded-lg bg-violet-950/70 px-2 py-0.5 text-xs text-violet-200">
              {callState.remoteDisplayName || "Remote"}
            </div>
          </div>

          <div className="relative bg-[#150e24] h-44 sm:h-auto sm:aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover mirror"
            />
            <div className="absolute bottom-2 left-2 rounded-lg bg-violet-950/70 px-2 py-0.5 text-xs text-violet-200">
              You
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 border-t border-violet-800/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-violet-50">
              {callState.remoteDisplayName || "Call"}
            </p>
            <p className="text-xs capitalize text-violet-400/50 mt-0.5">{callState.state}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {callState.state === "incoming" && (
              <Button onClick={handleAccept} className="bg-emerald-600 hover:bg-emerald-500 flex-1 sm:flex-none">
                Accept
              </Button>
            )}

            {(callState.state === "active" || callState.state === "outgoing") && (
              <>
                <Button variant="secondary" size="icon" onClick={toggleMute} title={callState.isMuted ? "Unmute" : "Mute"}>
                  {callState.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button variant="secondary" size="icon" onClick={toggleVideo} title={callState.isVideoOff ? "Start video" : "Stop video"}>
                  {callState.isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </Button>
                <Button variant="secondary" size="icon" onClick={switchCamera} title="Switch camera">
                  <SwitchCamera className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" onClick={toggleScreenShare} title="Share screen" className="hidden sm:inline-flex">
                  <Monitor className="h-4 w-4" />
                </Button>
              </>
            )}

            <Button variant="destructive" size="icon" onClick={endCall} title="End call">
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
