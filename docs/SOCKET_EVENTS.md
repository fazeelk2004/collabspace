# CollabSpace — Socket.io Event Contract

Single Socket.io namespace (`/`). The connection is authenticated in a socket
middleware by verifying the JWT from the httpOnly cookie — unauthenticated sockets
are rejected before any handler runs.

## Rooms

| Room | Who may join | Used for |
|---|---|---|
| `user:{userId}` | the user themself (auto-joined) | notifications, DM alerts |
| `workspace:{id}` | verified workspace members | presence, member/board events, channel list updates |
| `board:{id}` | members with board access | task/column/comment events, board viewers |
| `channel:{id}` | members of the channel's workspace | channel chat |
| `dm:{threadId}` | the two thread participants | direct messages |

**Every `join` request re-validates membership against PostgreSQL.** Rooms are the
tenant-isolation mechanism for real-time data: a broadcast to `board:{id}` can only
reach sockets that proved membership.

## Client → Server events

| Event | Payload | Effect |
|---|---|---|
| `workspace:join` / `workspace:leave` | `{ workspaceId }` | join/leave workspace room, mark online in Redis, broadcast presence |
| `board:join` / `board:leave` | `{ boardId }` | join/leave board room, update "viewing board" set in Redis |
| `channel:join` / `channel:leave` | `{ channelId }` | join/leave channel room |
| `dm:join` | `{ threadId }` | join DM room (participant check) |
| `task:editing` | `{ boardId, taskId, editing }` | broadcast "user is editing task X" |
| `typing` | `{ room: {kind, id}, isTyping }` | typing indicator for comments/chat (kind: task/channel/dm) |
| `presence:ping` | — | refresh presence TTL + lastActiveAt |

Chat messages, tasks, comments are **not** written via sockets — they go through the
REST API (validation + persistence), and the API then broadcasts. This keeps a
single write path with one set of permission checks.

## Server → Client events

| Event | Room | Payload |
|---|---|---|
| `task:created` / `task:updated` / `task:deleted` | board | full task DTO / `{ taskId }` |
| `task:moved` | board | `{ taskId, fromColumnId, toColumnId, position, movedBy }` |
| `column:created` / `column:updated` / `column:deleted` / `column:reordered` | board | column DTO |
| `comment:added` / `comment:updated` / `comment:deleted` | board | comment DTO |
| `task:editing` | board | `{ taskId, user, editing }` |
| `board:created` / `board:updated` / `board:deleted` | workspace | board DTO |
| `member:updated` / `member:removed` | workspace | membership DTO |
| `presence:state` | workspace | `{ online: userId[] }` (sent on join) |
| `presence:online` / `presence:offline` | workspace | `{ userId }` |
| `board:viewers` | board | `{ viewers: userId[] }` |
| `typing` | task/channel/dm room | `{ room, user, isTyping }` |
| `chat:message` / `chat:message:updated` / `chat:message:deleted` | channel / dm | message DTO |
| `chat:reaction` | channel / dm | `{ messageId, emoji, userId, op: add\|remove }` |
| `chat:read` | channel / dm | `{ userId, lastReadAt }` |
| `notification:new` | user | notification DTO |
| `activity:new` | board + workspace | activity DTO |

## Why the Redis adapter

On ECS, multiple containers run behind the ALB. User A may be connected to
container 1 and user B to container 2. `@socket.io/redis-adapter` publishes every
broadcast through Redis pub/sub so all containers deliver it to their local
sockets. Presence state also lives in Redis (`SETEX presence:user:{id}`,
`SADD board:viewers:{id}`) so it is consistent across containers and survives
individual container restarts.

## Flow example — moving a task

```
User A drags task ──► PATCH /api/tasks/:id/move        (optimistic UI applied)
                       ├─ session check (JWT cookie)
                       ├─ membership + role check (≥ MEMBER)
                       ├─ prisma update (position, columnId)
                       ├─ activity log row
                       └─ io.to(`board:{boardId}`).emit("task:moved", …)
                                            │ (Redis pub/sub fans out)
User B (other container) ◄─────────────────┘  board store applies move
```
