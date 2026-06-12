# CollabSpace — Database Schema Plan

PostgreSQL via Prisma. Every tenant-scoped table carries `workspaceId` (directly or
through its parent) and is indexed on it. All tables have `createdAt` / `updatedAt`.

## Entity-relationship overview

```
User ─┬─< WorkspaceMember >─ Workspace
      │                        │
      │                        ├─< Invitation
      │                        ├─< Label
      │                        ├─< Board ─< Column ─< Task
      │                        │              Task ─< TaskAssignee >─ User
      │                        │              Task ─< TaskLabel    >─ Label
      │                        │              Task ─< Comment      >─ User
      │                        │              Task ─< Attachment
      │                        ├─< ActivityLog
      │                        ├─< Notification (recipient: User)
      │                        ├─< ChatChannel ─< ChatMessage ─< ChatMessageReaction
      │                        │                  ChatMessage ─< ChatReadReceipt
      │                        └─< DirectMessageThread ─< DirectMessageParticipant
      │                                                  (messages reuse ChatMessage)
      └─ owns sessions implicitly via JWT (no session table)
```

## Models

| Model | Key fields | Notes |
|---|---|---|
| `User` | email (unique), passwordHash, name, image, lastActiveAt | |
| `Workspace` | name, slug (unique), imageUrl | Deleting cascades everything inside. |
| `WorkspaceMember` | role enum, @@unique([workspaceId,userId]) | Tenant gate for every query. |
| `Invitation` | email, role, token (unique), status enum, expiresAt | |
| `Board` | name, visibility enum, createdById | |
| `Column` | name, position (float) | Fractional ordering. |
| `Task` | title, description, priority enum, dueDate, position (float), createdById, updatedById | Indexed on columnId, boardId. |
| `TaskAssignee` | @@unique([taskId,userId]) | Multi-assignee. |
| `Label` | name, color, per-workspace | |
| `TaskLabel` | @@unique([taskId,labelId]) | |
| `Comment` | body, authorId, taskId, editedAt | Mentions parsed server-side. |
| `Attachment` | fileName, fileType, fileSize, s3Key, uploaderId | Only metadata; bytes live in S3. |
| `ActivityLog` | type enum, actorId, workspaceId, boardId?, taskId?, meta Json | Append-only. |
| `Notification` | type enum, recipientId, actorId, read, workspaceId, taskId?, meta Json | |
| `ChatChannel` | type enum (WORKSPACE/BOARD), name, workspaceId, boardId? | `#general` auto-created. |
| `ChatMessage` | body, authorId, channelId? XOR dmThreadId?, editedAt, deletedAt | Soft-delete keeps thread continuity. |
| `ChatMessageReaction` | emoji, @@unique([messageId,userId,emoji]) | |
| `ChatReadReceipt` | @@unique([channelId/dmThreadId, userId]) lastReadAt | One row per user per room. |
| `DirectMessageThread` | workspaceId | |
| `DirectMessageParticipant` | @@unique([threadId,userId]) | Exactly two per thread. |

## Enums

- `WorkspaceRole`: OWNER, ADMIN, MEMBER, VIEWER
- `BoardVisibility`: WORKSPACE, PRIVATE
- `TaskPriority`: LOW, MEDIUM, HIGH, URGENT
- `InvitationStatus`: PENDING, ACCEPTED, DECLINED, EXPIRED
- `NotificationType`: TASK_ASSIGNED, MENTIONED_COMMENT, MENTIONED_CHAT, INVITED, ROLE_CHANGED, TASK_DUE_SOON
- `ActivityType`: TASK_CREATED, TASK_UPDATED, TASK_MOVED, TASK_DELETED, TASK_ASSIGNED, TASK_PRIORITY_CHANGED, COMMENT_ADDED, MEMBER_INVITED, MEMBER_JOINED, MEMBER_ROLE_CHANGED, MEMBER_REMOVED, BOARD_CREATED, BOARD_DELETED, COLUMN_CREATED, COLUMN_DELETED, ATTACHMENT_ADDED
- `ChannelType`: WORKSPACE, BOARD

## Design decisions

1. **Fractional positions** (`Float`) for columns and tasks: a drag writes one row
   (`position = (prev + next) / 2`) instead of renumbering siblings; positions are
   rebalanced when gaps get too small.
2. **Cascade rules**: workspace deletion cascades to all children; user deletion
   sets `SetNull` on authored content (preserves history) but cascades memberships.
3. **Tenant isolation**: queries never filter by ids from the client alone — the
   membership row is loaded first and the workspaceId from *it* scopes everything.
4. **Soft-delete for chat messages** (`deletedAt`) so "message deleted" placeholders
   keep conversations coherent; hard delete for tasks/boards.
5. **Indexes** on every foreign key used in list queries: `workspaceId`, `boardId`,
   `columnId`, `taskId`, `channelId`, `recipientId + read`, etc.
