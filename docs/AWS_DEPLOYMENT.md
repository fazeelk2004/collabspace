# CollabSpace — AWS Deployment Guide

Step-by-step from zero to a running production deployment. Region used throughout:
`us-east-1` — change consistently if you pick another.

## 0. Prerequisites

- AWS account + AWS CLI v2 configured (`aws configure`)
- Docker Desktop
- A GitHub repository with this code pushed

## 1. VPC & networking

Use the default VPC to start, or create one with:
- 2 public subnets (ALB)
- 2 private subnets (ECS tasks, RDS, Redis)
- A NAT gateway so private tasks can reach ECR/S3 (or add VPC endpoints for ECR, S3,
  Secrets Manager and CloudWatch to avoid NAT cost).

Security groups:

| SG | Inbound |
|---|---|
| `alb-sg` | 443/80 from `0.0.0.0/0` |
| `app-sg` | 3000 from `alb-sg` |
| `db-sg` | 5432 from `app-sg` |
| `redis-sg` | 6379 from `app-sg` |

## 2. ECR — container registry

```bash
aws ecr create-repository --repository-name collabspace \
  --image-scanning-configuration scanOnPush=true
```

First manual push (CI does this afterwards):

```bash
aws ecr get-login-password | docker login --username AWS \
  --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
docker build -t <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/collabspace:latest .
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/collabspace:latest
```

## 3. RDS PostgreSQL

- Engine: PostgreSQL 16, instance `db.t4g.micro` (free-tier eligible) to start
- Private subnets, security group `db-sg`, no public access
- Note the endpoint and build:
  `postgresql://USER:PASSWORD@ENDPOINT:5432/collabspace?schema=public`

## 4. ElastiCache Redis

- Redis OSS, `cache.t4g.micro`, 1 node (no cluster mode)
- Private subnets, security group `redis-sg`
- URL: `redis://ENDPOINT:6379`

## 5. S3 — attachments bucket

```bash
aws s3api create-bucket --bucket collabspace-attachments-<unique>
aws s3api put-public-access-block --bucket collabspace-attachments-<unique> \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Add a CORS rule so browsers can POST uploads:

```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["POST", "GET"],
  "AllowedOrigins": ["https://your-domain.com", "http://localhost:3000"],
  "MaxAgeSeconds": 3000
}]
```

## 6. Secrets Manager

```bash
aws secretsmanager create-secret --name collabspace/DATABASE_URL --secret-string "postgresql://..."
aws secretsmanager create-secret --name collabspace/REDIS_URL    --secret-string "redis://..."
aws secretsmanager create-secret --name collabspace/AUTH_SECRET  --secret-string "$(openssl rand -base64 48)"
aws secretsmanager create-secret --name collabspace/S3_BUCKET_NAME --secret-string "collabspace-attachments-<unique>"
```

## 7. IAM roles

1. **Execution role** (`collabspace-execution-role`) — managed policy
   `AmazonECSTaskExecutionRolePolicy` **plus** `secretsmanager:GetSecretValue` on the
   `collabspace/*` secrets. ECS uses it to pull the image and inject secrets.
2. **Task role** (`collabspace-task-role`) — what the *running app* can do:
   `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on
   `arn:aws:s3:::collabspace-attachments-<unique>/*`. No AWS keys in env vars.
3. **GitHub deploy role** (`collabspace-github-deploy`) — trusted via the GitHub OIDC
   provider (`token.actions.githubusercontent.com`, condition on your repo). Permissions:
   ECR push, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:RunTask`,
   `ecs:Describe*`, `iam:PassRole` on the two roles above.

## 8. CloudWatch logs

```bash
aws logs create-log-group --log-group-name /ecs/collabspace
```

## 9. ECS cluster, task definitions, service

```bash
aws ecs create-cluster --cluster-name collabspace-cluster
```

Register both task definitions (fill in account id / ARNs first):

```bash
aws ecs register-task-definition --cli-input-json file://docker/ecs-task-definition.example.json
aws ecs register-task-definition --cli-input-json file://docker/ecs-migration-task.example.json
```

Run the first migration manually:

```bash
aws ecs run-task --cluster collabspace-cluster --task-definition collabspace-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<private-subnets>],securityGroups=[<app-sg>],assignPublicIp=DISABLED}"
```

## 10. ALB — load balancer (WebSocket-aware)

1. Target group `collabspace-tg`: type **IP**, port 3000, health check path
   `/api/health`, healthy threshold 2.
2. **Enable stickiness** on the target group (`lb_cookie`, 1 day) — keeps Socket.io's
   HTTP long-polling fallback pinned to one task. WebSockets upgrade over HTTP/1.1 and
   the ALB supports them natively; no special configuration needed.
3. ALB in the public subnets with `alb-sg`; HTTPS :443 listener with an ACM certificate
   forwarding to `collabspace-tg` (+ :80 → :443 redirect).
4. Create the ECS service:

```bash
aws ecs create-service --cluster collabspace-cluster --service-name collabspace-service \
  --task-definition collabspace-task --desired-count 2 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<private-subnets>],securityGroups=[<app-sg>],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=<tg-arn>,containerName=collabspace,containerPort=3000" \
  --health-check-grace-period-seconds 60
```

5. Auto-scaling (optional but recommended):

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs --resource-id service/collabspace-cluster/collabspace-service \
  --scalable-dimension ecs:service:DesiredCount --min-capacity 2 --max-capacity 6
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs --resource-id service/collabspace-cluster/collabspace-service \
  --scalable-dimension ecs:service:DesiredCount --policy-name cpu-70 \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{"TargetValue":70,"PredefinedMetricSpecification":{"PredefinedMetricType":"ECSServiceAverageCPUUtilization"}}'
```

6. Point your domain at the ALB (Route 53 alias record) and set
   `NEXT_PUBLIC_APP_URL=https://your-domain.com` in the task definition.

## 11. GitHub Actions

Repository secrets:

| Secret | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | the GitHub OIDC deploy role ARN |
| `PRIVATE_SUBNET_IDS` | `subnet-aaa,subnet-bbb` |
| `APP_SECURITY_GROUP_ID` | the `app-sg` id |

Every push to `main` then runs: lint → typecheck → tests → docker build → ECR push →
migration task → rolling ECS deploy ([.github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml)).

## 12. Verify

- `https://your-domain.com/api/health` → `{"status":"ok","checks":{"db":true,"redis":true}}`
- Open the app in two browsers, drag a task — it moves instantly in both.
- `aws logs tail /ecs/collabspace --follow` shows structured request logs.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sockets connect then fall back to polling errors | Target group stickiness not enabled |
| Tasks unhealthy on startup | Health check grace period too short, or DB/Redis SG rules wrong |
| `prisma migrate` task fails | Migration SG can't reach RDS:5432, or DATABASE_URL secret wrong |
| Real-time works on one container only | REDIS_URL wrong → adapter silently degraded; check logs |
