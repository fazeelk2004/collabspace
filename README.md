# CollabSpace

**Real-time team collaboration platform** — Kanban boards, team chat, live presence and
analytics in a multi-tenant SaaS, built for production deployment on AWS.

> Next.js 15 · React 19 · TypeScript · Socket.io · PostgreSQL/Prisma · Redis · Tailwind v4 ·
> Docker · AWS ECS Fargate · GitHub Actions

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
  ECS containers.
- **Team chat** — workspace channels, per-board discussion channels, direct messages,
  reactions, edit/delete, read receipts, @mentions, unread counts.
- **Live presence** — online members, "currently viewing board", "editing this task",
  typing dots. State lives in Redis with TTLs so it survives container restarts.
- **Notifications** — assigned / mentioned / role-changed, pushed live to the recipient's
  personal socket room, with unread badge and mark-all-read.
- **Activity log** — append-only audit trail shown on the board, in the task panel and on a
  workspace-wide live feed.
- **Attachments** — browser uploads straight to a private S3 bucket via presigned POST;
  downloads via short-lived signed URLs, gated by workspace membership.
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
Browser ── HTTPS/WSS ──► ALB (sticky) ──► ECS Fargate tasks (Next.js + Socket.io, one port)
                                              │            │
                                              ▼            ▼
                                      RDS PostgreSQL   ElastiCache Redis
                                      (system of       (socket adapter, presence,
                                       record)          rate limiting)
                                              │
                                              ▼
                                          S3 (private attachments, signed URLs)
```

- One container image serves both HTTP and WebSocket traffic (custom server in
  [server/index.ts](server/index.ts)).
- The **Socket.io Redis adapter** fans broadcasts out across all running containers.
- All writes go through REST API routes (Zod validation + permission checks), which then
  broadcast to socket rooms — one write path, one set of security checks.
- Detailed docs: [docs/AWS_ARCHITECTURE.md](docs/AWS_ARCHITECTURE.md) ·
  [docs/SOCKET_EVENTS.md](docs/SOCKET_EVENTS.md) · [docs/DATABASE.md](docs/DATABASE.md) ·
  [docs/API.md](docs/API.md) · [docs/PROJECT_WORKING_EXPLAINED.md](docs/PROJECT_WORKING_EXPLAINED.md)

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
npm run db:migrate            # or: npm run db:push

# 5. (optional) Seed demo data
npm run db:seed               # demo@collabspace.dev / demo1234

# 6. Run the app (Next.js + Socket.io on one port)
npm run dev                   # → http://localhost:3000
```

To test the **production container** locally (same image ECS runs):

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

See [.env.example](.env.example). In production these come from **AWS Secrets Manager**,
injected into the ECS task definition — never baked into the image.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (RDS in prod) |
| `REDIS_URL` | Redis connection string (ElastiCache in prod) |
| `AUTH_SECRET` | HMAC secret for session JWTs |
| `S3_BUCKET_NAME`, `AWS_REGION` | attachment storage (task IAM role provides credentials in prod) |
| `NEXT_PUBLIC_APP_URL` | public URL, used for invite links and socket CORS |

## ☁️ AWS deployment

The full step-by-step guide lives in [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md):
ECR → RDS → ElastiCache → S3 → Secrets Manager → ECS Fargate + ALB (WebSocket-aware,
sticky sessions) → GitHub Actions (OIDC, no stored AWS keys) with a one-off Fargate task
running `prisma migrate deploy` before each rolling deploy.

## 🧪 Testing

```bash
npm test
```

Unit tests cover the permission matrix, every Zod validation schema (auth, tasks, uploads,
chat) and utility logic (slugs, mention parsing). The CI pipeline runs lint, typecheck and
tests before any image is built.

## 🔮 Future improvements

- Email notifications via AWS SES (invitation + mention digests)
- Command palette (⌘K) with cross-workspace search
- Playwright E2E suite for the core flows
- Column drag-reordering and swimlanes
- Message threads and file sharing in chat
- Terraform/CDK templates for one-command infrastructure