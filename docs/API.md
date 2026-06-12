# CollabSpace — REST API Reference

All endpoints are JSON. Authentication is a `collabspace_session` httpOnly JWT cookie set
by login/register. Errors return `{ "error": string }` (validation errors also include
`issues`). Mutations are rate-limited per user via Redis (HTTP 429 when exceeded).

Role requirements are the *minimum* role in the target workspace.

## Auth

| Method & path | Role | Body | Notes |
|---|---|---|---|
| `POST /api/auth/register` | — | `{name,email,password}` | sets session cookie |
| `POST /api/auth/login` | — | `{email,password}` | sets session cookie |
| `POST /api/auth/logout` | — | — | clears cookie |
| `GET /api/auth/me` | auth | — | current user |
| `PATCH /api/auth/me` | auth | `{name?,image?}` | update profile |

## Workspaces

| Method & path | Role | Body |
|---|---|---|
| `GET /api/workspaces` | auth | — (lists own memberships) |
| `POST /api/workspaces` | auth | `{name}` — creates default board, columns, #general, labels |
| `GET /api/workspaces/:id` | Viewer | — |
| `PATCH /api/workspaces/:id` | Admin | `{name?,imageUrl?}` |
| `DELETE /api/workspaces/:id` | Owner | — (cascades everything) |

## Members & invitations

| Method & path | Role | Body |
|---|---|---|
| `GET /api/workspaces/:id/members` | Viewer | — |
| `PATCH /api/workspaces/:id/members/:memberId` | Admin¹ | `{role}` |
| `DELETE /api/workspaces/:id/members/:memberId` | Admin¹ (or self) | — |
| `GET /api/workspaces/:id/invitations` | Admin | — (pending only) |
| `POST /api/workspaces/:id/invitations` | Admin | `{email,role}` → returns `inviteUrl` |
| `DELETE /api/workspaces/:id/invitations/:invitationId` | Admin | — |
| `POST /api/invitations/:token/accept` | auth | — (email must match) |

¹ Admins cannot touch owners or peers; the last owner can never be removed/demoted.

## Boards, columns, tasks

| Method & path | Role | Body |
|---|---|---|
| `GET /api/workspaces/:id/boards` | Viewer | — (private boards filtered) |
| `POST /api/workspaces/:id/boards` | Admin | `{name,description?,visibility}` |
| `GET /api/boards/:boardId` | Viewer | — (full board: columns + tasks) |
| `PATCH /api/boards/:boardId` | Admin | `{name?,description?,visibility?}` |
| `DELETE /api/boards/:boardId` | Admin | — |
| `POST /api/boards/:boardId/columns` | Admin | `{name}` |
| `PATCH /api/columns/:columnId` | Admin | `{name?,position?}` |
| `DELETE /api/columns/:columnId` | Admin | — |
| `POST /api/boards/:boardId/tasks` | Member | `{columnId,title,description?,priority?,dueDate?,assigneeIds?,labelIds?}` |
| `GET /api/tasks/:taskId` | Viewer | — (detail incl. comments, files, activity) |
| `PATCH /api/tasks/:taskId` | Member | any subset of task fields |
| `PATCH /api/tasks/:taskId/move` | Member | `{columnId,position}` |
| `DELETE /api/tasks/:taskId` | Member | — |
| `GET /api/workspaces/:id/labels` | Viewer | — |
| `POST /api/workspaces/:id/labels` | Member | `{name,color}` |

## Comments

| Method & path | Role | Body |
|---|---|---|
| `GET /api/tasks/:taskId/comments` | Viewer | — |
| `POST /api/tasks/:taskId/comments` | Member | `{body}` — `@[Name](userId)` tokens create mention notifications |
| `PATCH /api/comments/:commentId` | author | `{body}` |
| `DELETE /api/comments/:commentId` | author or Admin | — |

## Chat

| Method & path | Role | Body |
|---|---|---|
| `GET /api/workspaces/:id/channels` | Viewer | — (with unread counts) |
| `POST /api/workspaces/:id/channels` | Admin | `{name}` |
| `GET /api/channels/:channelId/messages?cursor=` | Viewer | — (50/page, newest first) |
| `POST /api/channels/:channelId/messages` | Member | `{body}` |
| `POST /api/channels/:channelId/read` | Viewer | — (read receipt) |
| `GET /api/workspaces/:id/dms` | Viewer | — (own threads) |
| `POST /api/workspaces/:id/dms` | Viewer | `{userId}` — creates or reuses thread |
| `GET /api/dms/:threadId/messages?cursor=` | participant | — |
| `POST /api/dms/:threadId/messages` | participant | `{body}` |
| `POST /api/dms/:threadId/read` | participant | — |
| `PATCH /api/messages/:messageId` | author | `{body}` |
| `DELETE /api/messages/:messageId` | author or Admin (channels) | — (soft delete) |
| `POST /api/messages/:messageId/reactions` | room access | `{emoji}` — toggles |

## Notifications, activity, analytics

| Method & path | Role | Notes |
|---|---|---|
| `GET /api/notifications?unread=1` | auth | latest 30 + unread count |
| `PATCH /api/notifications/:id` | recipient | `{read}` |
| `POST /api/notifications/read-all` | auth | — |
| `GET /api/workspaces/:id/activity?boardId=&cursor=` | Viewer | paginated feed |
| `GET /api/workspaces/:id/analytics` | Viewer | totals, by-priority, by-member, 14-day trend |

## Attachments

| Method & path | Role | Body |
|---|---|---|
| `POST /api/tasks/:taskId/attachments` | Member | step 1: `{fileName,fileType,fileSize}` → presigned S3 POST; step 2: `{confirm:true,s3Key,...}` → metadata row |
| `GET /api/attachments/:attachmentId` | Viewer | 302 → 5-minute signed S3 URL |
| `DELETE /api/attachments/:attachmentId` | uploader or Admin | — |

## Health

| Method & path | Notes |
|---|---|
| `GET /api/health` | ALB health check — verifies DB + Redis, 503 when degraded |
