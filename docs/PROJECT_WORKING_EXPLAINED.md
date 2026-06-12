# CollabSpace — How The Whole Project Works (Beginner Guide)

This document teaches you the project from zero: what each folder does, how data flows,
and what happens behind every click. Read it top to bottom once, then use it as a
reference while you explore the code.

---

## 1. Project Overview

CollabSpace is a **team collaboration app**: teams organize work on Kanban boards (like
Trello), talk in chat channels and DMs (like Slack), and see each other working **live** —
when a teammate moves a card or types a message, you see it instantly without refreshing.

**The full user journey:**

1. **Sign up / log in** — you create an account (`/register`). The server hashes your
   password, stores the user in PostgreSQL, and gives your browser a signed session
   cookie (a JWT). From now on every request carries that cookie.
2. **Create or join a workspace** — a *workspace* is your team's private space. Creating
   one makes you its **Owner** and auto-creates a "Getting Started" board, the four
   default columns, a `#general` chat channel and three labels. Joining happens through
   an invite link a teammate sends you.
3. **Create boards** — each board holds columns (To Do, In Progress, Review, Done) and
   each column holds task cards. Every board also gets its own discussion chat channel.
4. **Create and move tasks** — tasks have a title, description, priority, due date,
   assignees, labels, comments and file attachments. You drag cards between columns.
5. **Collaborate in real time** — when your browser opens a board it also opens a
   **WebSocket** connection and joins that board's "room". Every change anyone makes is
   broadcast to the room, so all open browsers update instantly.
6. **Comment, chat, upload, get notified** — comments and chat support `@mentions`,
   which create notifications; files go to Amazon S3; the bell icon updates live.
7. **Activity & analytics update automatically** — every important action writes a row
   to the activity log, and the workspace overview page charts progress.

---

## 2. Complete Folder Structure Explanation

```
collabspace/
├── app/          ← pages (what users see) and API routes (the backend)
├── components/   ← reusable React UI pieces
├── lib/          ← shared server/client logic ("the brain")
├── server/       ← the custom HTTP + Socket.io server
├── hooks/        ← reusable React hooks (socket wiring)
├── store/        ← global client state (Zustand)
├── types/        ← shared TypeScript types
├── prisma/       ← database schema, migrations, seed data
├── tests/        ← unit tests
├── docker/       ← AWS ECS task definition templates
├── .github/      ← CI/CD pipeline
└── docs/         ← documentation (you are here)
```

### `/app` — pages and API, the heart of Next.js

Next.js App Router maps folders to URLs. Two kinds of files live here:

- `page.tsx` files render **pages** (`app/w/[workspaceSlug]/page.tsx` → `/w/acme-demo`).
- `route.ts` files under `app/api/` are **API endpoints** — this is the backend. There is
  no separate Express app; these route handlers *are* the server-side code.

Key areas:

| Path | What it is |
|---|---|
| `app/(auth)/` | login & register pages. The `(auth)` parentheses create a *route group* — it shares a centered-card layout without affecting URLs. |
| `app/dashboard/` | "pick a workspace" hub shown after login |
| `app/w/[workspaceSlug]/` | everything inside one workspace: overview, boards, chat, members, activity, settings. Its `layout.tsx` checks membership before rendering anything — this is the tenant gate for pages. |
| `app/api/` | ~28 REST endpoints (documented in [API.md](API.md)) |
| `app/invite/[token]/` | the invitation accept page |
| `app/layout.tsx` | root layout: fonts, theme provider, React Query provider, toasts |
| `app/globals.css` | the design system: Tailwind v4 theme tokens for light/dark mode |

### `/components` — the UI, split by feature

| Folder | Contains |
|---|---|
| `components/ui/` | the design-system primitives (Button, Dialog, Dropdown, Avatar, Tabs, Sheet…) — shadcn-style wrappers around Radix UI. Every other component builds on these. |
| `components/layout/` | the app shell: sidebar (with workspace switcher and animated collapse), topbar, theme toggle, user menu, online-members stack, the invisible `PresenceListener`. |
| `components/auth/` | login/register forms (React Hook Form + Zod) |
| `components/workspace/` | workspace hub, create dialog, settings page |
| `components/board/` | `board-view.tsx` (the Kanban page brain: drag-and-drop, filters) and `board-column.tsx` |
| `components/tasks/` | task card, inline task composer, the task detail sheet, attachments |
| `components/comments/` | the comment list + the `@mention` textarea (also reused by chat) |
| `components/chat/` | chat sidebar, conversation view, message item, new-DM dialog |
| `components/notifications/` | the bell dropdown |
| `components/activity/` | activity feed rendering |
| `components/analytics/` | the overview dashboard + Recharts charts |

### `/lib` — shared logic, no UI

| File/folder | Job |
|---|---|
| `lib/db/prisma.ts` | creates **one** Prisma client for the whole process. Everything that touches PostgreSQL imports this. |
| `lib/auth/` | `password.ts` (bcrypt hashing), `jwt.ts` (sign/verify session tokens with `jose`), `session.ts` (read the cookie inside server code) |
| `lib/redis/` | `client.ts` (ioredis connection), `presence.ts` (who's online / viewing which board), `rate-limit.ts` (request throttling) |
| `lib/permissions/` | **the security core** — membership and role checks used by *both* API routes and socket handlers. `lib/permissions-client.ts` holds the pure role math (safe for the browser). |
| `lib/validations/` | every Zod schema. Imported by forms (client) *and* API routes (server) so the rules can never drift apart. |
| `lib/s3/` | presigned upload/download URL generation |
| `lib/activity.ts` | writes an activity row + broadcasts it |
| `lib/notifications.ts` | creates a notification row + pushes it to the recipient live |
| `lib/api-utils.ts` | helpers every API route uses: `requireAuth`, `parseBody`, `enforceRateLimit`, `withErrorHandling` |
| `lib/fetcher.ts` | the client-side `api()` wrapper around `fetch` |
| `lib/utils.ts` | `cn()` class merging, slugs, initials, mention parsing |

### `/server` — the custom server

| File | Job |
|---|---|
| `server/index.ts` | the entry point. Starts **one** HTTP server that handles both normal Next.js requests *and* Socket.io traffic on the same port. Also logs requests and handles graceful shutdown for ECS. |
| `server/socket.ts` | configures Socket.io: authenticates each connection from the JWT cookie, plugs in the **Redis adapter**, registers handlers. |
| `server/events.ts` | every socket event name as a constant + room name builders. Client and server both import this file, so the event contract is a single source of truth. |
| `server/emitter.ts` | the bridge that lets API routes broadcast (`emitToBoard(...)`) — it finds the Socket.io instance via `globalThis`. |
| `server/handlers/rooms.ts` | join/leave logic for workspace/board/channel/DM rooms — **re-checks membership in the database on every join**. |
| `server/handlers/presence.ts` | typing indicators, "editing task" signals, presence keepalive. |

### `/hooks`, `/store`, `/types`

- `hooks/use-socket.ts` — one shared socket connection per browser tab + helpers like
  `useSocketEvent`, `useBoardRoom`.
- `hooks/use-board-realtime.ts` — subscribes a mounted board to all its live events.
- `store/board-store.ts` — Zustand store holding the open board (columns + tasks).
  Both optimistic UI updates *and* incoming socket events funnel through it.
- `store/presence-store.ts` — the set of online user ids.
- `types/index.ts` — the DTO shapes API responses use, shared across all components.

### `/prisma`, `/tests`, `/docker`, `/.github`

- `prisma/schema.prisma` — all 20 database models ([explained here](DATABASE.md));
  `prisma/seed.ts` creates demo data.
- `tests/` — Vitest unit tests for permissions, validation schemas and utilities.
- `docker/` — example ECS task definitions (app + one-off migration task).
- `.github/workflows/ci-cd.yml` — lint → typecheck → test → build → push → migrate → deploy.

---

## 3. How Frontend and Backend Communicate

The frontend talks to the backend in two ways:

1. **HTTP requests** (REST API) for everything that *changes or loads data*.
2. **WebSocket events** for *receiving* live updates (covered in section 4).

Important design rule: **all writes go through HTTP**, never through the socket. One
write path = one place for validation and permission checks.

### The pieces involved

- **Forms** use **React Hook Form** with **Zod** resolvers — errors show instantly
  without a server round-trip.
- **`lib/fetcher.ts`** wraps `fetch()`: sends JSON, parses errors into a `FetchError`.
- **React Query** (`useQuery`) loads and caches server data (boards, members,
  notifications…) and re-fetches when we *invalidate* a cache key.
- **Zustand** (`board-store`) holds the live board state, because drag-and-drop and
  socket events need fast, fine-grained mutations that a fetch cache isn't built for.
- **Zod on the server** re-validates everything. Client validation is for UX; server
  validation is for security. Both import the *same schema* from `lib/validations`.

### Example walk-throughs

**Creating a workspace**
1. You type a name in `create-workspace-dialog.tsx`; Zod validates it client-side.
2. `api("/api/workspaces", {method:"POST", body:{name}})` sends it with your cookie.
3. `app/api/workspaces/route.ts` → `requireAuth()` reads the JWT → rate limit check →
   `createWorkspaceSchema.parse(body)` → one Prisma **transaction** creates the
   workspace, your OWNER membership, a default board with 4 columns, `#general`, labels.
4. The dialog gets `{workspace}` back and `router.push`-es you to `/w/<slug>`.

**Moving a task (drag-and-drop)**
1. `board-view.tsx` (dnd-kit) computes where you dropped the card and a fractional
   `position` — the midpoint between its new neighbours' positions.
2. The Zustand store applies the move **immediately** (optimistic UI — feels instant).
3. `PATCH /api/tasks/:id/move` runs: membership check, *"does the target column belong
   to the same board?"* check, Prisma update, activity row, then
   `emitToBoard(boardId, "task:moved", …)`.
4. If the request fails, the UI re-fetches the whole board to undo the optimistic move.

**Adding a comment** — `comments-section.tsx` POSTs to `/api/tasks/:id/comments`. The
server stores it, parses `@[Name](userId)` tokens, creates mention notifications, and
broadcasts `comment:added` to the board room.

**Uploading a file** — three steps (see section 7).

**Sending a chat message** — `conversation.tsx` POSTs to
`/api/channels/:id/messages`. The server stores it and broadcasts `chat:message` to the
channel room; everyone in that channel appends it to their list.

### How protected routes work

Three layers, outermost first:

1. **`middleware.ts`** runs at the edge before any page: no valid JWT → redirect to
   `/login`. (Convenience layer — fast redirects.)
2. **Server components** re-check: `app/w/[workspaceSlug]/layout.tsx` loads your
   membership row and renders 404 if you're not a member. (The page-level tenant gate.)
3. **Every API route** calls `requireAuth()` + a permission helper. (The real security —
   even hand-crafted `curl` requests can't bypass this.)

---

## 4. How Real-Time Communication Works

### What happens when you open a board

1. The browser already has one Socket.io connection (created lazily by
   `hooks/use-socket.ts`). During the handshake, `server/socket.ts` read your session
   cookie and verified the JWT — anonymous sockets are rejected before anything else.
2. `useBoardRealtime(boardId)` runs and emits `board:join`.
3. On the server, `handlers/rooms.ts` calls `requireBoardAccess(userId, boardId)` —
   a **fresh database check**. Only then does the socket join the room `board:<id>`.
4. The server adds you to the board's Redis viewer set and broadcasts `board:viewers`,
   so everyone sees "2 viewing".

### How updates flow (the key diagram)

```
User A drags a task
   │
   ├─ 1. Zustand store applies the move instantly (optimistic UI)
   └─ 2. PATCH /api/tasks/123/move ──► API route
                                          ├─ auth (JWT cookie)
                                          ├─ permission check (DB)
                                          ├─ prisma.task.update(...)
                                          ├─ activity log row
                                          └─ io.to("board:42").emit("task:moved", …)
                                                       │
                                          Redis pub/sub fans out to ALL containers
                                                       │
User B's browser (maybe connected to another container) ◄┘
   └─ use-board-realtime hears "task:moved" → board store moves the card → React re-renders
```

User A ignores their own `task:moved` echo (the payload carries `movedBy`), because they
already moved it optimistically.

### Typing indicators & presence

- Typing: the composer emits `typing {room, isTyping:true}` and auto-emits `false` after
  2 s of silence. The server **only relays it to rooms your socket already joined** — no
  DB hit needed because joining already proved membership. Receivers show the animated
  dots and clear them on the `false` signal.
- Online/offline: joining a workspace room writes `presence:online:<ws>:<user>` to Redis
  **with a 70-second TTL**. The client pings every 30 s to refresh it. If your laptop
  dies, the key simply expires — no stale "online forever" bug. Disconnect handlers also
  broadcast `presence:offline` immediately for the clean case.
- "Editing this task": the task sheet emits `task:editing` while you have unsaved edits;
  other viewers see a pencil pulse on that card.

### Why Redis is required on AWS ECS

In production, two or more containers run behind the load balancer. User A's socket might
live in container 1 and user B's in container 2. Without help, container 1's
`io.to("board:42").emit(...)` would only reach *its own* sockets. The
**@socket.io/redis-adapter** publishes every broadcast through Redis pub/sub, and every
container delivers it to its local members of that room. Presence data lives in Redis for
the same reason — any container can read it.

### How rooms prevent data leakage

A socket only ever receives an event if it's in the target room, and it can only enter a
room by passing a database membership check at join time. Workspace X's events go to
`workspace:X`/`board:…` rooms that only verified members of X have joined — a member of
workspace Y can't even subscribe.

---

## 5. Database Communication (Prisma + PostgreSQL)

**Prisma** turns the schema in `prisma/schema.prisma` into a fully typed client:
`prisma.task.findMany({where:{boardId}})` returns `Task[]`, and a typo in a field name is
a compile error. Migrations (`npm run db:migrate`) version-control the schema.

### How the models hang together

```
User ─┬─< WorkspaceMember >─ Workspace          (membership + role = the tenant gate)
      │                        ├─< Board ─< Column ─< Task
      │                        │            Task ─< TaskAssignee >─ User
      │                        │            Task ─< TaskLabel >─ Label
      │                        │            Task ─< Comment / Attachment
      │                        ├─< ChatChannel ─< ChatMessage ─< Reaction / ReadReceipt
      │                        ├─< DirectMessageThread ─< Participant / ChatMessage
      │                        ├─< ActivityLog / Notification / Invitation / Label
```

- A **task** belongs to a board *and* a column; assignees and labels are join tables
  (many-to-many); comments and attachments hang off the task.
- **Activity logs** are append-only rows: who (`actorId`), what (`type` enum), where
  (`workspaceId`/`boardId`/`taskId`), details (`meta` JSON).
- **Notifications** are rows per recipient with a `read` flag — that's all "unread"
  state is.

### Tenant isolation in practice

Every query starts from the membership row, not from client-supplied ids:

```ts
// lib/permissions/index.ts — the most important function in the project
const membership = await prisma.workspaceMember.findUnique({
  where: { workspaceId_userId: { workspaceId, userId } },
});
if (!membership) throw new PermissionError("Not a member");
```

For nested resources the chain is resolved server-side: task → its board → its workspace
→ *your* membership in that workspace. A crafted request with someone else's `taskId`
dies at this chain, because *your* membership lookup fails.

### Indexes and cascades

- Indexes exist on every foreign key used in lists (`workspaceId`, `boardId`,
  `columnId`, `taskId`, `recipientId+read`…). Without them, "load this board's tasks"
  would scan the whole tasks table.
- Deleting a workspace **cascades** to everything inside (intended: it's the tenant
  root). Deleting a *user* sets authored content to `null` instead (`SetNull`) so
  history survives, while their memberships cascade away.

---

## 6. Authentication and Authorization Flow

### Authentication — "who are you?"

```
register/login ─► verify credentials (bcrypt compare against passwordHash)
              ─► sign JWT {userId, email, name} with AUTH_SECRET (lib/auth/jwt.ts)
              ─► set httpOnly cookie "collabspace_session" (7 days)

every later request ─► cookie travels automatically
   ├─ middleware.ts: signature valid? (edge, no DB)
   ├─ API routes: requireAuth() → session payload
   └─ socket handshake: same cookie, same verification
```

`httpOnly` means JavaScript cannot read the cookie — even an XSS bug couldn't steal the
token. The JWT is *signed*, not encrypted: the server can trust its contents because any
tampering breaks the signature.

### Authorization — "what may you do?"

Roles live in the `WorkspaceMember` row, ordered VIEWER < MEMBER < ADMIN < OWNER:

| Capability | helper | minimum role |
|---|---|---|
| read boards/chat | `can.view` | VIEWER |
| create/edit tasks, comment, chat | `can.contribute` | MEMBER |
| manage boards/columns/members | `can.manage` | ADMIN |
| delete workspace, manage owners | `can.own` | OWNER |

Every mutating route states its requirement explicitly, e.g.
`requireBoardAccess(userId, boardId, "MEMBER")`. Special rules: admins can't touch
owners or fellow admins; `assertNotLastOwner()` blocks removing/demoting the final owner.

### Why client-side role data is never trusted

The UI hides buttons based on role (`lib/permissions-client.ts`) — but that's *UX only*.
Anyone can edit JavaScript in DevTools or replay requests with `curl`. Security only
exists where the attacker can't reach: on the server, against the database. That's why
every handler re-loads the membership row instead of believing anything in the request.

---

## 7. File Upload Flow

Files never pass through our server — the browser uploads **directly to S3**:

```
1. pick file ─► client checks type + size (UX)
2. POST /api/tasks/:id/attachments {fileName,fileType,fileSize}
      server: membership ≥ MEMBER, Zod validates type against an allow-list
              and size ≤ 10 MB, then asks S3 for a presigned POST
              (locked to this key, this content-type, this size range, 5-min expiry)
3. browser POSTs the file straight to S3 with those credentials
4. POST /api/tasks/:id/attachments {confirm:true, s3Key, …}
      server: key must start with workspaces/<ws>/tasks/<task>/ → metadata row in Postgres
5. downloads: GET /api/attachments/:id
      server: membership check → 302 redirect to a 5-minute signed GET URL
```

The bucket is fully private. Without a fresh signed URL — which only members can obtain —
nobody can read a file, even with the exact S3 key.

---

## 8. Notification Flow

1. **Created** by `lib/notifications.ts` whenever: you're assigned a task, mentioned in
   a comment, mentioned in chat, or your role changes. (Never for your own actions.)
2. **Stored** as a row: `recipientId`, `type`, `actorId`, `read:false`, `meta` JSON with
   enough context to build the message and the click-through link.
3. **Pushed live**: `emitToUser(recipientId, "notification:new", …)` targets the
   `user:<id>` room every socket auto-joins at connect. The bell badge animates in
   without any refresh.
4. **Read state**: clicking a notification PATCHes `{read:true}` and navigates to the
   task/channel; "mark all read" hits `/api/notifications/read-all`.

---

## 9. AWS Deployment Explained

| Piece | In plain words |
|---|---|
| **Docker** | freezes the app + Node + dependencies into an image that runs identically anywhere. |
| **ECR** | AWS's private registry where CI pushes each image, tagged with the git commit. |
| **ECS Fargate** | runs N copies ("tasks") of the image without managing servers. Scales up on CPU, restarts crashed containers. |
| **ALB** | the front door: terminates HTTPS, health-checks `/api/health`, spreads traffic. WebSockets pass through natively; *stickiness* keeps a polling client on one task. |
| **RDS PostgreSQL** | the managed database — the single source of truth. Private subnet, only the app's security group may connect. |
| **ElastiCache Redis** | the real-time backbone: socket adapter pub/sub, presence keys, rate-limit counters. |
| **S3** | file bytes (metadata stays in Postgres). |
| **Secrets Manager** | holds `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`… injected into containers at start; never in the image or repo. |
| **CloudWatch** | collects every container's stdout — the JSON request logs and errors. |
| **GitHub Actions** | on push to `main`: lint → typecheck → tests → build image → push to ECR → run a one-off migration task (`prisma migrate deploy`) → rolling ECS deploy. Auth via OIDC, so no AWS keys live in GitHub. |

Request flow:

```
Browser ─► Route 53 (DNS) ─► ALB (HTTPS/WSS, sticky) ─► ECS task (Next.js + Socket.io)
                                                          ├─► RDS (queries)
                                                          ├─► Redis (broadcast/presence)
                                                          └─► S3 (signed URLs)
```

---

## 10. File-by-File Communication Map

`server/index.ts`
- Entry point in dev (`npm run dev`) and in the Docker container.
- Boots Next.js, wraps it in a plain HTTP server, attaches Socket.io, logs requests.

`server/socket.ts`
- Authenticates every socket from the JWT cookie; rejects strangers.
- Plugs in the Redis adapter; registers `handlers/rooms.ts` + `handlers/presence.ts`.
- Calls `setIo()` so API routes can broadcast later.

`server/emitter.ts`
- `emitToBoard/Workspace/Channel/Dm/User` — imported by API routes and `lib/activity.ts`
  / `lib/notifications.ts`. The only doorway from REST code into Socket.io.

`lib/permissions/index.ts`
- `requireMembership`, `requireBoardAccess`, `requireTaskAccess`, `requireChannelAccess`,
  `requireDmAccess`, `assertNotLastOwner`.
- Called by **every** API route and **every** socket room join. If you read one security
  file, read this one.

`lib/db/prisma.ts`
- The single Prisma client. Every file that touches the database imports it.

`app/w/[workspaceSlug]/layout.tsx`
- Server component around all workspace pages: session → workspace by slug → *your*
  membership (404 if none) → renders `AppShell` with sidebar/topbar.

`app/w/[workspaceSlug]/boards/[boardId]/page.tsx`
- Server-side access check, then renders `BoardView` with your role.

`components/board/board-view.tsx`
- Loads the board via React Query into the Zustand store.
- Hosts the dnd-kit `DndContext`: computes drop positions, applies optimistic moves,
  calls the move API, re-syncs on failure.
- Mounts `useBoardRealtime` (live events) and the task detail sheet (via `?task=` URL).

`store/board-store.ts`
- The board's client-side state machine: add/update/move/remove tasks and columns.
  Both optimistic UI and socket events call the same actions — one code path.

`hooks/use-socket.ts`
- Singleton socket + `useSocketEvent` (auto-cleanup listener) + room join/leave hooks
  that re-join after reconnects.

`components/chat/conversation.tsx`
- One component powers channels *and* DMs: loads paginated history, joins the room,
  handles message/reaction/read/typing events, sends via the REST API.

`lib/activity.ts` / `lib/notifications.ts`
- Called by API routes after successful writes; persist a row, then broadcast it.

`.github/workflows/ci-cd.yml`
- Quality gate + build + push + migrate + deploy. Mirrors what you run locally:
  `npm run lint && npm run typecheck && npm test`.

---

## 11. Beginner Notes on the Big Concepts

**JWT (JSON Web Token)** — a signed string `{userId,…}` proving who you are. Needed
because HTTP is stateless. Created at login (`lib/auth/jwt.ts`), carried in a cookie,
verified by middleware, API routes and the socket handshake. Before: credentials check.
After: every request knows its user without a DB lookup.

**httpOnly cookie** — browser storage JavaScript can't read; the browser attaches it to
requests automatically. It's how the JWT travels safely.

**Server vs client components** — files without `"use client"` run on the server (can
use Prisma, read cookies); files with it run in the browser (can use state, clicks,
sockets). Pattern here: server component checks access and passes data → client
component handles interactivity.

**Optimistic UI** — apply the change locally *before* the server confirms, undo if it
fails. Used for drag-and-drop and column renames. Why: dragging must feel instant; a
200 ms round-trip feels broken.

**Socket room** — a named group of connections; broadcasting targets a room. Our room
names (`board:42`) are the tenant boundary for live data.

**Redis TTL** — keys that delete themselves. Presence uses 70-second TTLs refreshed by
pings, so crashed clients go offline automatically.

**Fractional positioning** — task order is a float; dropping between positions 1000 and
2000 writes 1500. One-row updates instead of renumbering a whole column.

**Rate limiting** — Redis counter per user per minute (`lib/redis/rate-limit.ts`);
HTTP 429 over the limit. Shared via Redis so it holds across all containers.

**Zod** — schema validation. One schema, two jobs: instant form errors in the browser,
hard input validation on the server.

**Prisma transaction** — several writes that succeed or fail together (workspace +
membership + board + channel at signup).

---

## 12. Text Diagrams

**App architecture**

```
┌────────────────────────── Browser ──────────────────────────┐
│ React UI ── React Query (server cache) ── Zustand (board)   │
│     │ HTTP (writes + loads)        ▲ socket events (live)   │
└─────┼──────────────────────────────┼────────────────────────┘
      ▼                              │
┌──────────────── one Node process (server/index.ts) ─────────┐
│ Next.js API routes ── emitter ──► Socket.io ◄── handlers    │
│   │        │                          │                     │
│   ▼        ▼                          ▼                     │
│ Zod    lib/permissions          Redis adapter + presence    │
│            │                          │                     │
│            ▼                          ▼                     │
│      Prisma → PostgreSQL           Redis                    │
└──────────────────────────────────────────────────────────────┘
```

**Auth & permission flow**

```
request ─► middleware (JWT valid?) ─► route: requireAuth()
                                         │
                                         ▼
                          requireMembership / requireBoardAccess
                          (load WorkspaceMember from DB, check role)
                                         │
                              allowed ───┴─── 403/404
                                 │
                          Zod parse body ─► Prisma write
                                 │
                    activity log + notifications + socket broadcast
```

**Real-time event flow** — see section 4. **Database relations** — see section 5.
**AWS flow** — see section 9.

---

## 13. Learning Checklist

Work through these in order; each builds on the last.

- [ ] **Folder structure** — open each top-level folder and match it to section 2.
- [ ] **Auth flow** — follow register → `lib/auth/jwt.ts` → `middleware.ts` → `requireAuth`.
- [ ] **Workspace membership** — read `lib/permissions/index.ts` end to end (~150 lines).
- [ ] **Task CRUD** — trace create-task from `create-task-inline.tsx` to its API route.
- [ ] **Drag-and-drop** — read `handleDragEnd` in `board-view.tsx`; understand fractional positions.
- [ ] **Socket rooms** — read `server/handlers/rooms.ts`; why is there a DB check in every join?
- [ ] **Redis presence** — read `lib/redis/presence.ts`; why TTLs instead of "offline" writes?
- [ ] **PostgreSQL relations** — read `prisma/schema.prisma`; sketch User→Workspace→Board→Task.
- [ ] **S3 uploads** — trace the 3 steps through `attachments-section.tsx` and the API route.
- [ ] **AWS deployment** — read [AWS_ARCHITECTURE.md](AWS_ARCHITECTURE.md); explain why Redis is mandatory with 2+ containers.
- [ ] **CI/CD** — read `.github/workflows/ci-cd.yml`; explain why migrations run as a separate task before deploy.

When you can answer the "why" for each box, you know this project well enough to defend
it in any interview.
