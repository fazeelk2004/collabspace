# CollabSpace — CV / Resume Material

## Project line

> **CollabSpace** — Real-time multi-tenant team collaboration SaaS (Kanban + chat + presence)
> *Next.js 15, TypeScript, Socket.io, PostgreSQL/Prisma, Redis, Tailwind, Docker, AWS ECS Fargate, GitHub Actions*

## Bullet points (pick 4–6 per application)

**Full-stack / architecture**
- Built a production-grade, multi-tenant collaboration platform (Kanban boards, team chat, live presence) with Next.js 15 App Router, TypeScript and PostgreSQL, enforcing tenant isolation through membership-scoped queries and role-based access control (Owner/Admin/Member/Viewer) on every API route and WebSocket room join.
- Designed a 20-model relational schema with Prisma — fractional ordering for O(1) drag-and-drop reordering, soft-deleted chat history, append-only audit logs and unread tracking via per-user read receipts.
- Implemented secure credential auth with bcrypt and stateless JWT sessions in httpOnly cookies, shared across HTTP middleware, REST handlers and the Socket.io handshake.

**Real-time systems**
- Engineered the real-time layer with Socket.io and the Redis pub/sub adapter so task updates, comments, chat, typing indicators and notifications broadcast correctly across horizontally scaled ECS containers.
- Modeled live presence (online status, board viewers, "user is editing") in Redis with TTL-based expiry, surviving container restarts and unclean disconnects without stale state.
- Applied optimistic UI with server reconciliation for drag-and-drop and chat, keeping a single authenticated write path (REST) while sockets remain broadcast-only.

**AWS / DevOps**
- Deployed to AWS ECS Fargate behind a WebSocket-aware Application Load Balancer with target-group stickiness, RDS PostgreSQL and ElastiCache Redis in private subnets, and secrets injected from AWS Secrets Manager.
- Built a zero-downtime GitHub Actions pipeline (OIDC, no stored AWS keys): lint → typecheck → tests → Docker build → ECR push → one-off Fargate migration task → rolling ECS deploy.
- Implemented direct-to-S3 file uploads with presigned POST policies (type/size constrained) and 5-minute signed download URLs gated by workspace membership — file bytes never transit the app servers.

**Quality / security**
- Validated every input with shared Zod schemas (client forms + server re-validation), added Redis-backed rate limiting, account-enumeration-safe auth errors, and unit tests covering the permission matrix and all validation schemas.

## Interview talking points

1. **Why Redis is mandatory:** with 2+ containers, a broadcast from one process can't reach sockets on another — the Redis adapter fans out via pub/sub; presence/rate-limit state must also live outside process memory.
2. **Why writes go over REST, not sockets:** one write path = one set of Zod validation + permission checks; sockets only deliver.
3. **Tenant isolation in depth:** membership row loaded fresh per request; resource chains resolved server-side (task→board→workspace→membership); socket rooms joinable only after a DB check.
4. **Fractional positioning trade-off:** O(1) writes per drag vs. eventual precision exhaustion — and how you'd rebalance.
5. **Migration strategy:** a separate one-off Fargate task runs `prisma migrate deploy` before the service rollout, so app containers never race to migrate.
