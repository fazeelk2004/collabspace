// Client-side DTO types mirroring API responses.

export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type UserLite = {
  id: string;
  name: string;
  image: string | null;
};

export type SessionUser = UserLite & { email: string };

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  role: Role;
  _count: { members: number; boards: number };
};

export type Member = {
  id: string;
  role: Role;
  userId: string;
  createdAt: string;
  user: UserLite & { email: string; lastActiveAt: string };
};

export type Invitation = {
  id: string;
  email: string;
  role: Role;
  token: string;
  createdAt: string;
  invitedBy: { id: string; name: string } | null;
};

export type Label = {
  id: string;
  name: string;
  color: string;
};

export type BoardSummary = {
  id: string;
  name: string;
  description: string | null;
  visibility: "WORKSPACE" | "PRIVATE";
  createdAt: string;
  createdBy: UserLite | null;
  _count: { tasks: number };
};

export type Task = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  assignees: { user: UserLite }[];
  labels: { label: Label }[];
  createdBy?: UserLite | null;
  _count: { comments: number; attachments: number; checklist?: number };
};

export type Column = {
  id: string;
  boardId: string;
  name: string;
  position: number;
  tasks: Task[];
};

export type BoardDetail = {
  id: string;
  name: string;
  description: string | null;
  visibility: "WORKSPACE" | "PRIVATE";
  workspaceId: string;
  columns: Column[];
  channel: { id: string } | null;
  workspace: { id: string; slug: string; name: string };
};

export type Comment = {
  id: string;
  taskId?: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
  author: UserLite | null;
};

export type Attachment = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  uploader: UserLite | null;
};

export type Activity = {
  id: string;
  type: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
  actor: UserLite | null;
  board?: { id: string; name: string } | null;
  task?: { id: string; title: string } | null;
};

export type Notification = {
  id: string;
  type:
    | "TASK_ASSIGNED"
    | "MENTIONED_COMMENT"
    | "MENTIONED_CHAT"
    | "INVITED"
    | "ROLE_CHANGED"
    | "TASK_DUE_SOON";
  read: boolean;
  createdAt: string;
  taskId: string | null;
  meta: Record<string, unknown> | null;
  actor: UserLite | null;
  workspace: { id: string; name: string; slug: string };
};

export type Channel = {
  id: string;
  name: string;
  type: "WORKSPACE" | "BOARD";
  boardId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  channelId?: string | null;
  dmThreadId?: string | null;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  author: UserLite | null;
  reactions: { emoji: string; userId: string }[];
  parent?: {
    id: string;
    body: string;
    deletedAt: string | null;
    author: { id: string; name: string } | null;
  } | null;
};

export type ChecklistItem = {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  position: number;
};

export type DmThread = {
  id: string;
  other: UserLite | null;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    authorId: string | null;
    deletedAt: string | null;
  } | null;
  unreadCount: number;
};

export type TaskDetail = Task & {
  column: { id: string; name: string };
  updatedBy: UserLite | null;
  comments: Comment[];
  attachments: Attachment[];
  activities: Activity[];
};

export type AnalyticsData = {
  totals: { total: number; completed: number; overdue: number; completionRate: number };
  byPriority: { priority: Priority; count: number }[];
  byMember: { userId: string; name: string; count: number }[];
  trend: { date: string; completed: number }[];
};
