# CollabSpace — Technical Specification

Real-time, multi-tenant team collaboration platform: Kanban boards, live presence,
team chat and direct messages, activity tracking and analytics. Built to production
standards and deployable on AWS ECS Fargate.

---

## 1. Product Specification

### 1.1 Core domain

| Concept | Description |
|---|---|
| **User** | A registered account. Can belong to many workspaces. |
| **Workspace** | The tenant boundary. Everything (boards, chat, files, activity) lives inside a workspace. Users only see workspaces they are members of. |
| **WorkspaceMember** | Join table between User and Workspace, carries the member's **role**. |
| **Board** | A Kanban board inside a workspace. Visibility: `WORKSPACE` (all members) or `PRIVATE` (creator + admins/owners). |
| **Column** | Ordered list inside a board (To Do / In Progress / Review / Done by default). |
| **Task** | A card. Has title, description, priority, due date, assignees, labels, attachments, comments, position. |
| **ChatChannel** | Workspace-level or board-level chat room. A default `#general` channel is created with each workspace. |
| **DirectMessageThread** | 1-on-1 conversation between two workspace members. |
| **Notification** | In-app notification (assigned, mentioned, invited, etc.). |
| **ActivityLog** | Audit trail of every significant mutation, scoped to workspace/board/task. |

### 1.2 Roles & permission matrix

| Action | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| View boards/tasks/comments/chat | ✅ | ✅ | ✅ | ✅ |
| Create/edit tasks, comment, chat | ✅ | ✅ | ✅ | ❌ |
| Create/rename/delete boards & columns | ✅ | ✅ | ❌ | ❌ |
| Invite members, change roles (below own) | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ (not owners) | ❌ | ❌ |
| Rename workspace, workspace settings | ✅ | ✅ | ❌ | ❌ |
| Delete workspace, transfer ownership | ✅ | ❌ | ❌ | ❌ |

Invariants enforced server-side:
- The last **Owner** can never be removed or demoted.
- Role checks happen in API routes **and** Socket.io handlers — client role data is never trusted.
- Every query is filtered by `workspaceId` derived from the authenticated membership, never from client input alone.

### 1.3 Feature list

**Auth** — credential register/login (bcrypt), JWT session in httpOnly cookie (jose),
middleware-protected routes, profile editing.

**Workspaces** — create (auto-slug, default board + #general channel), rename, delete,
settings page, workspace switcher.

**Members** — invite by email (tokenized link), accept/decline, change role, remove,
last-owner protection.

**Boards/Columns/Tasks** — full CRUD, drag-and-drop with fractional ordering
(`position: float`, periodic rebalance), priorities, due dates, labels,
multi-assignee, filters (assignee/priority/label/due/search).

**Real-time (Socket.io + Redis adapter)** — board rooms, workspace rooms, channel
rooms, DM rooms. Task/column/comment/chat/notification/presence events. Permission
re-validated on every socket action.

**Presence** — Redis-backed online status, per-board viewers, typing indicators,
"editing task" indicator, last-active timestamps.

**Chat** — workspace channels, board discussion channels, DMs, reactions, edit/delete,
read receipts, @mentions, typing indicators.

**Comments** — threaded under tasks, @mentions create notifications, real-time.

**Notifications** — dropdown, unread badge, mark read/all-read, real-time push.

**Activity log** — recorded on every significant mutation, shown in board sidebar,
task panel, and workspace activity page.

**Attachments** — uploaded via presigned S3 POST, metadata in Postgres, downloads
via short-lived signed GET URLs, membership-gated.

**Analytics** — totals, completion %, overdue, by-priority, by-member, 14-day
completion trend (Recharts).

### 1.4 Non-functional requirements

- **Multi-tenancy**: workspace-scoped queries + room-scoped broadcasts. No
  cross-tenant data can leak via API or sockets.
- **Horizontal scale**: stateless containers; Socket.io Redis adapter fans out
  events across ECS tasks; presence lives in Redis, not process memory.
- **Security**: Zod validation on every input, rate limiting (Redis token bucket),
  httpOnly+secure cookies, signed S3 URLs, secrets via Secrets Manager.
- **Quality**: TypeScript strict, no `any`, optimistic UI for drag-and-drop and
  chat, skeleton loading states, empty states, dark/light themes, responsive.

---

## 2. Development Roadmap

| Phase | Deliverable |
|---|---|
| 1 | Project setup, Prisma schema + migrations, JWT auth, workspace CRUD |
| 2 | Boards, columns, tasks, drag-and-drop Kanban |
| 3 | Socket.io server, board rooms, real-time tasks + comments |
| 4 | Redis adapter, presence, typing indicators |
| 5 | Roles/permissions hardening, invitations, notifications |
| 6 | S3 uploads, activity log, analytics dashboard, chat system |
| 7 | Docker, tests, GitHub Actions CI/CD, AWS deployment config + docs |

---

## 3. Folder Structure

```
collabspace/
├── app/
│   ├── (auth)/                  # login, register (centered card layout)
│   ├── (dashboard)/             # authenticated app shell (sidebar + topbar)
│   │   └── [workspaceSlug]/     # workspace-scoped pages
│   │       ├── page.tsx         # workspace overview / analytics
│   │       ├── boards/[boardId] # kanban board page
│   │       ├── chat/            # channels + DMs
│   │       ├── members/         # member management
│   │       ├── activity/        # workspace activity feed
│   │       └── settings/        # workspace settings
│   ├── api/                     # REST API route handlers
│   ├── invite/[token]/          # invitation accept page
│   ├── layout.tsx               # root layout (theme, providers)
│   └── globals.css              # Tailwind v4 theme tokens
├── components/
│   ├── ui/                      # design-system primitives (shadcn-style)
│   ├── layout/                  # sidebar, topbar, workspace switcher, command menu
│   ├── workspace/               # workspace forms, settings
│   ├── board/                   # kanban board, columns, dnd
│   ├── tasks/                   # task card, task detail panel, filters
│   ├── comments/                # comment list/composer
│   ├── chat/                    # channel list, message list, composer
│   ├── members/                 # member rows, invite dialog
│   ├── notifications/           # notification dropdown
│   └── analytics/               # recharts widgets
├── lib/
│   ├── auth/                    # jwt sign/verify, password hash, session helpers
│   ├── db/                      # prisma client singleton
│   ├── redis/                   # redis clients, presence, rate limiting
│   ├── permissions/             # role matrix + assertion helpers (shared API/socket)
│   ├── validations/             # zod schemas (shared client/server)
│   ├── s3/                      # presigned upload/download URLs
│   ├── activity.ts              # activity log writer
│   ├── notifications.ts         # notification creator (+ socket push)
│   ├── api-utils.ts             # auth/validation/error helpers for route handlers
│   └── utils.ts                 # cn() and misc
├── server/
│   ├── index.ts                 # custom HTTP server: Next handler + Socket.io
│   ├── socket.ts                # io setup, auth middleware, redis adapter
│   ├── events.ts                # socket event names (single source of truth)
│   └── handlers/                # per-domain socket handlers (rooms, presence, chat…)
├── hooks/                       # useSocket, useBoardRealtime, usePresence…
├── store/                       # zustand stores (board, presence, ui)
├── types/                       # shared TS types & socket payload types
├── prisma/                      # schema.prisma, migrations, seed.ts
├── tests/                       # vitest unit tests
├── docker/                      # Dockerfile, compose
├── .github/workflows/           # CI/CD
└── docs/                        # this folder
```

Companion docs:
- [DATABASE.md](./DATABASE.md) — schema plan & relations
- [SOCKET_EVENTS.md](./SOCKET_EVENTS.md) — full real-time event contract
- [AWS_ARCHITECTURE.md](./AWS_ARCHITECTURE.md) — cloud architecture
- [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) — step-by-step deploy guide
- [API.md](./API.md) — REST endpoint reference
- [PROJECT_WORKING_EXPLAINED.md](./PROJECT_WORKING_EXPLAINED.md) — beginner walkthrough
