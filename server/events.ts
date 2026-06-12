/**
 * Single source of truth for every Socket.io event name.
 * Imported by both the server handlers and the client hooks so the
 * contract can never drift apart silently.
 */
export const EVENTS = {
  // client → server: room management
  WORKSPACE_JOIN: "workspace:join",
  WORKSPACE_LEAVE: "workspace:leave",
  BOARD_JOIN: "board:join",
  BOARD_LEAVE: "board:leave",
  CHANNEL_JOIN: "channel:join",
  CHANNEL_LEAVE: "channel:leave",
  DM_JOIN: "dm:join",

  // client → server: ephemeral signals
  TYPING: "typing",
  TASK_EDITING: "task:editing",
  TASK_VIEW_JOIN: "task:view:join",
  TASK_VIEW_LEAVE: "task:view:leave",
  PRESENCE_PING: "presence:ping",

  // server → client: tasks & columns
  TASK_CREATED: "task:created",
  TASK_UPDATED: "task:updated",
  TASK_MOVED: "task:moved",
  TASK_DELETED: "task:deleted",
  COLUMN_CREATED: "column:created",
  COLUMN_UPDATED: "column:updated",
  COLUMN_DELETED: "column:deleted",

  // server → client: boards & workspace
  BOARD_CREATED: "board:created",
  BOARD_UPDATED: "board:updated",
  BOARD_DELETED: "board:deleted",
  MEMBER_UPDATED: "member:updated",
  MEMBER_REMOVED: "member:removed",

  // server → client: comments
  COMMENT_ADDED: "comment:added",
  COMMENT_UPDATED: "comment:updated",
  COMMENT_DELETED: "comment:deleted",

  // server → client: presence
  PRESENCE_STATE: "presence:state",
  PRESENCE_ONLINE: "presence:online",
  PRESENCE_OFFLINE: "presence:offline",
  BOARD_VIEWERS: "board:viewers",
  TASK_VIEWERS: "task:viewers",

  // server → client: chat
  CHAT_MESSAGE: "chat:message",
  CHAT_MESSAGE_UPDATED: "chat:message:updated",
  CHAT_MESSAGE_DELETED: "chat:message:deleted",
  CHAT_REACTION: "chat:reaction",
  CHAT_READ: "chat:read",

  // server → client: misc
  NOTIFICATION_NEW: "notification:new",
  ACTIVITY_NEW: "activity:new",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  board: (boardId: string) => `board:${boardId}`,
  channel: (channelId: string) => `channel:${channelId}`,
  dm: (threadId: string) => `dm:${threadId}`,
} as const;
