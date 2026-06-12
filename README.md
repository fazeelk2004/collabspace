# CollabSpace

**Real-time team collaboration platform** — Kanban boards, team chat, live presence and
analytics in a multi-tenant SaaS, deployable for free on Render.

> Next.js 15 · React 19 · TypeScript · Socket.io · PostgreSQL/Prisma · Redis · Tailwind v4 ·
> Docker · Render

---

## ✨ Features

- **Workspaces (multi-tenant)** — every board, task, chat message and file is isolated per
  workspace; users only ever see workspaces they are members of.
- **Roles & permissions** — Owner / Admin / Member / Viewer with server-enforced checks on
  every API route *and* every socket room join. Last-owner protection included.
- **Kanban boards** — drag-and-drop tasks (dnd-kit) with fractional ordering, priorities,
  labels, due dates, multi-assignees, filters and search. Optimistic UI with server re-sync.
- **Real-time everything** — task moves, comments, presence, typing indicators and
  notifications broadcast over Socket.io with the Redis adapter, so it works across multiple
  app instances.
- **Team chat** — workspace channels, per-board discussion channels, direct messages,
  reactions, edit/delete, read receipts, @mentions, unread counts.
- **Live presence** — online members, "currently viewing board", "editing this task",
  typing dots. State lives in Redis with TTLs so it survives container restarts.
- **Notifications** — assigned / mentioned / role-changed, pushed live to the recipient's
  personal socket room, with unread badge and mark-all-read.
- **Activity log** — append-only audit trail shown on the board, in the task panel and on a
  workspace-wide live feed.
- **Attachments & avatars** — uploaded straight to the app and stored as bytes in
  PostgreSQL; downloads are streamed back through the API, gated by workspace membership.
- **Analytics** — completion trend, tasks by priority/member, overdue counts (Recharts).
- **Polished UI** — Tailwind v4 + shadcn-style design system, dark/light themes,
  Framer Motion animations, skeleton loading, empty states, responsive down to mobile.

## 📸 Screenshots

> _Add screenshots here after running locally — the board view, chat, analytics dashboard
> and dark mode make the best shots._

| Board | Chat | Analytics |
|---|---|---|
| _screenshot_ | _screenshot_ | _screenshot_ |

## 🏗 Architecture

```
Browser ── HTTPS/WSS ──► Render Web Service (Next.js + Socket.io, one port)
                                  │            │
                                  ▼            ▼
                            PostgreSQL      Redis (Key Value)
                            (system of      (socket adapter, presence,
                             record +        rate limiting)
                             file bytes)
```

- One process serves both HTTP and WebSocket traffic (custom server in
  [server/index.ts](server/index.ts)).
- The **Socket.io Redis adapter** fans broadcasts out across all running instances.
- All writes go through REST API routes (Zod validation + permission checks), which then
  broadcast to socket rooms — one write path, one set of security checks.
- Avatars and task attachments are stored as `bytea` in PostgreSQL — no external object
  store needed.
- Detailed docs: [docs/SOCKET_EVENTS.md](docs/SOCKET_EVENTS.md) ·
  [docs/DATABASE.md](docs/DATABASE.md) · [docs/API.md](docs/API.md) ·
  [docs/PROJECT_WORKING_EXPLAINED.md](docs/PROJECT_WORKING_EXPLAINED.md)

## 🚀 Local setup

Prerequisites: Node 20+, Docker Desktop.

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL + Redis
docker compose up -d postgres redis

# 3. Configure environment
cp .env.example .env          # defaults already match docker-compose
#    set AUTH_SECRET to any long random string

# 4. Create the database schema
npm run db:push               # syncs prisma/schema.prisma to the database

# 5. (optional) Seed demo data
npm run db:seed               # demo@collabspace.dev / demo1234

# 6. Run the app (Next.js + Socket.io on one port)
npm run dev                   # → http://localhost:3000
```

To test the **production container** locally (the full stack in Docker):

```bash
docker compose --profile full up --build
```

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | dev server with HMR (custom server + Socket.io) |
| `npm run build` / `npm start` | production build / production server |
| `npm run lint` / `npm run typecheck` / `npm test` | the CI quality gate |
| `npm run db:migrate` / `db:deploy` / `db:studio` / `db:seed` | Prisma workflows |

### Environment variables

See [.env.example](.env.example). In production on Render these are set per service
(`render.yaml` wires most of them automatically) — never baked into the image.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (also stores file/avatar bytes) |
| `REDIS_URL` | Redis connection string |
| `AUTH_SECRET` | HMAC secret for session JWTs |
| `NEXT_PUBLIC_APP_URL` | public URL, used for invite links and socket CORS |

## ☁️ Deployment (Render, free)

The full step-by-step guide lives in [docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md).
In short: push to GitHub, then **New → Blueprint** in Render — [`render.yaml`](render.yaml)
provisions the web service, PostgreSQL, and Redis (Key Value), runs `prisma db push` on
build, and starts the custom Socket.io server. Set `NEXT_PUBLIC_APP_URL` to your live URL
afterwards and you're done.

## 🧪 Testing

```bash
npm test
```

Unit tests cover the permission matrix, every Zod validation schema (auth, tasks, uploads,
chat) and utility logic (slugs, mention parsing). The CI pipeline runs lint, typecheck and
tests before any image is built.

## 🔮 Future improvements

- Email notifications (invitation + mention digests)
- Command palette (⌘K) with cross-workspace search
- Playwright E2E suite for the core flows
- Column drag-reordering and swimlanes
- Message threads and file sharing in chat
- Terraform/CDK templates for one-command infrastructure