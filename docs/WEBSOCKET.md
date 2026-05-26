# WebSocket / Socket.IO Flow

Socket.IO endpoint: `http://api.localhost/socket.io`

Authentication uses the `access_token` HTTP-only cookie (sent automatically with `withCredentials: true`) or `{ token: "<jwt>" }` in the handshake `auth` payload.

## Connection lifecycle

```
Client                    Server
  | connect (auth/cookie)    |
  |------------------------->|
  |                          | validate JWT
  |                          | enter room user:{id}
  |<-------------------------| accept
  |                          | broadcast presence_update
```

On disconnect, if no other sessions exist for the user, `is_online` is set to `false`.

## Chat events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ room_id }` | Subscribe to room channel |
| `leave_room` | `{ room_id }` | Unsubscribe |
| `join_dm` | `{ conversation_id }` | Subscribe to DM channel |
| `send_message` | `{ room_id?, conversation_id?, content }` | Send message |
| `typing_start` | `{ room_id?, conversation_id? }` | Typing indicator on |
| `typing_stop` | `{ room_id?, conversation_id? }` | Typing indicator off |
| `message_read` | `{ message_id, room_id?, conversation_id? }` | Read receipt |

### Server → Client

| Event | Payload |
|-------|---------|
| `new_message` | Full message object |
| `typing` | `{ user_id, typing, room_id?, conversation_id? }` |
| `message_read` | `{ message_id, user_id, read_at }` |
| `presence_update` | `{ user_id, is_online }` |
| `room_joined` | `{ room_id, user_id }` |

## Room naming (Redis adapter)

- Room messages: `room:{room_id}`
- DM messages: `dm:{conversation_id}`
- User signaling: `user:{user_id}`

Redis pub/sub allows multiple backend instances to share Socket.IO state.

## WebRTC signaling events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `call_offer` | C→S→Callee | SDP offer + create call session |
| `incoming_call` | S→Callee | Ring notification |
| `call_answer` | C→S→Caller | SDP answer |
| `call_answered` | S→Caller | Answer delivered |
| `ice_candidate` | C↔S↔Peer | ICE trickle |
| `call_end` | C↔S↔Peer | Hang up |

See [WEBRTC.md](./WEBRTC.md) for media path details.
