# WebRTC Signaling Flow

NexusChat uses **mesh signaling** through Socket.IO. Media flows peer-to-peer with TURN fallback via Coturn.

## Architecture

```
┌─────────┐                      ┌─────────┐
│ Caller  │◄────── P2P media ───►│ Callee  │
│ Browser │                      │ Browser │
└────┬────┘                      └────┬────┘
     │  SDP / ICE (Socket.IO)           │
     └──────────► FastAPI ◄─────────────┘
                      │
                 Redis pub/sub
```

When NAT traversal fails, both peers use Coturn:

```
Browser ──► Coturn (TURN) ──► Browser
```

## Call sequence

1. **Caller** creates `RTCPeerConnection`, gets local media, creates offer.
2. Caller emits `call_offer` with `{ callee_id, sdp }`.
3. Server creates `call_sessions` row with `room_key`, emits `incoming_call` to callee.
4. **Callee** accepts → creates answer, emits `call_answer` with `{ caller_id, room_key, sdp }`.
5. Server emits `call_answered` to caller; both set remote descriptions.
6. ICE candidates trickle via `ice_candidate` events (targeted to `user:{id}` room).
7. Either party emits `call_end` → peer cleans up, session marked `ended`.

## ICE configuration

Fetched from `GET /api/turn-config`:

```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    {
      "urls": "turn:localhost:3478",
      "username": "nexus",
      "credential": "nexus_turn_secret"
    }
  ]
}
```

## Frontend controls

- Mute / unmute audio
- Enable / disable camera
- Switch camera (multi-device)
- Screen share (replaces video track; restores on end)
- ICE restart on `connectionState === "failed"`

## Production notes

- Use TLS for TURNS (`turns:`) in production.
- Restrict Coturn with firewall rules and strong credentials.
- Consider SFU (e.g. mediasoup, LiveKit) for multi-party calls beyond MVP.
