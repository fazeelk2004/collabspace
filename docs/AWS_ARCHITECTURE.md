# CollabSpace — AWS Architecture

## Diagram

```
                        ┌──────────────────────────────────────────────────────┐
                        │                      AWS VPC                          │
 Internet               │  ┌────────────── public subnets ──────────────┐      │
    │                   │  │                                            │      │
 Route 53 ──► ┌──────┐  │  │   ┌──────────────────────────────┐         │      │
 (domain)     │ ACM  │  │  │   │  Application Load Balancer   │         │      │
              │ TLS  │──┼──┼──►│  HTTPS :443, WebSocket-aware │         │      │
              └──────┘  │  │   │  sticky sessions (lb_cookie) │         │      │
                        │  │   └──────────────┬───────────────┘         │      │
                        │  └─────────────────┬┴────────────────────────┘      │
                        │  ┌─ private subnets┴──────────────────────────┐      │
                        │  │      ┌──────────────────────────┐          │      │
                        │  │      │   ECS Fargate Service    │          │      │
                        │  │      │  ┌────────┐  ┌────────┐  │          │      │
                        │  │      │  │ task 1 │  │ task 2 │ ◄── auto-scaling   │
                        │  │      │  │ Next + │  │ Next + │  │          │      │
                        │  │      │  │ Socket │  │ Socket │  │          │      │
                        │  │      │  └──┬──┬──┘  └──┬──┬──┘  │          │      │
                        │  │      └─────┼──┼────────┼──┼─────┘          │      │
                        │  │            │  └───┬────┘  │                │      │
                        │  │   ┌────────▼──┐ ┌─▼───────▼─────┐          │      │
                        │  │   │ RDS       │ │ ElastiCache   │          │      │
                        │  │   │ PostgreSQL│ │ Redis         │          │      │
                        │  │   │ (private) │ │ (adapter +    │          │      │
                        │  │   └───────────┘ │  presence +   │          │      │
                        │  │                 │  rate limit)  │          │      │
                        │  │                 └───────────────┘          │      │
                        │  └────────────────────────────────────────────┘      │
                        └──────────────────────────────────────────────────────┘
                                   │                    │
                          ┌────────▼───────┐   ┌────────▼─────────┐
                          │  Amazon S3     │   │ Secrets Manager  │
                          │  (attachments, │   │ DATABASE_URL,    │
                          │  private +     │   │ REDIS_URL,       │
                          │  signed URLs)  │   │ AUTH_SECRET …    │
                          └────────────────┘   └──────────────────┘

 GitHub ─► GitHub Actions ─► lint/typecheck/test ─► docker build ─► ECR push
                                      └─► render task def ─► ECS deploy (rolling)
 ECS tasks ─► stdout/stderr ─► CloudWatch Logs (awslogs driver)
```

## Component responsibilities

| Component | Role |
|---|---|
| **ALB** | TLS termination, health checks on `/api/health`, WebSocket upgrade support (HTTP/1.1), target group with **stickiness enabled** so Socket.io HTTP long-polling fallback hits the same task. |
| **ECS Fargate** | Runs the single container image (Next.js + Socket.io on one port). No EC2 to manage. Service auto-scales on CPU. |
| **ECR** | Stores versioned Docker images, tagged with the git SHA. |
| **RDS PostgreSQL** | System of record. Private subnets, security group only allows the ECS task SG on 5432. Prisma migrations run as a one-off ECS task before each deploy. |
| **ElastiCache Redis** | Socket.io adapter pub/sub, presence keys, rate-limit counters, hot caches. Private subnets, SG-restricted. |
| **S3** | Attachment bytes. Bucket fully private; browser uploads use presigned POST, downloads use 5-minute signed GET URLs. |
| **Secrets Manager** | `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, S3 bucket name — injected into the task definition as `secrets`, never baked into the image. |
| **CloudWatch Logs** | All container stdout/stderr via the `awslogs` log driver; structured request logging from the app. |
| **IAM task role** | Grants the running container `s3:PutObject/GetObject` on the attachments bucket — no AWS keys in env vars in production. |

## Key decisions

1. **One container, one port** — Next.js and Socket.io share a single HTTP server
   (`server/index.ts`), so the ALB needs only one target group and WebSocket
   upgrades work without path-based routing tricks.
2. **ALB stickiness + Redis adapter together** — stickiness keeps a client's
   polling fallback on one task; the Redis adapter makes broadcasts reach every
   task regardless of where the sender is connected.
3. **Migrations as a separate task** — `npx prisma migrate deploy` runs as a
   one-off Fargate task in CI before the service update, so app containers never
   race to migrate.
4. **Stateless containers** — sessions are JWT cookies, presence is in Redis,
   files are in S3. Any task can be killed and replaced at any time.

See [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) for the step-by-step deployment guide.
