import { z } from "zod";

// Shared Zod schemas — used by React Hook Form on the client and re-validated
// in every API route on the server.

// ── Auth ──────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().email("Enter a valid email").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[a-zA-Z]/, "Must contain a letter")
    .regex(/[0-9]/, "Must contain a number"),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  image: z.string().url().nullable().optional(),
});

// ── Workspace ─────────────────────────────────────────────────────────
export const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters").max(50),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  imageUrl: z.string().url().nullable().optional(),
});

// ── Members & invitations ─────────────────────────────────────────────
export const inviteMemberSchema = z.object({
  email: z.string().email("Enter a valid email").max(254),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});

// ── Boards & columns ──────────────────────────────────────────────────
export const BOARD_TEMPLATES = {
  blank: { label: "Blank", columns: ["To Do", "In Progress", "Review", "Done"] },
  sprint: {
    label: "Sprint",
    columns: ["Backlog", "Sprint", "In Progress", "In Review", "Done"],
  },
  bugs: {
    label: "Bug triage",
    columns: ["Reported", "Confirmed", "Fixing", "Verifying", "Closed"],
  },
  roadmap: {
    label: "Roadmap",
    columns: ["Ideas", "Planned", "This Quarter", "Building", "Shipped"],
  },
} as const;

export type BoardTemplate = keyof typeof BOARD_TEMPLATES;

export const createBoardSchema = z.object({
  name: z.string().min(1, "Board name is required").max(60),
  description: z.string().max(500).optional(),
  visibility: z.enum(["WORKSPACE", "PRIVATE"]).default("WORKSPACE"),
  template: z.enum(["blank", "sprint", "bugs", "roadmap"]).default("blank"),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(500).nullable().optional(),
  visibility: z.enum(["WORKSPACE", "PRIVATE"]).optional(),
});

export const createColumnSchema = z.object({
  name: z.string().min(1, "Column name is required").max(40),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  position: z.number().finite().optional(),
});

// ── Tasks ─────────────────────────────────────────────────────────────
export const createTaskSchema = z.object({
  columnId: z.string().min(1),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(10_000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.coerce.date().nullable().optional(),
  assigneeIds: z.array(z.string()).max(20).optional(),
  labelIds: z.array(z.string()).max(20).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  assigneeIds: z.array(z.string()).max(20).optional(),
  labelIds: z.array(z.string()).max(20).optional(),
});

export const moveTaskSchema = z.object({
  columnId: z.string().min(1),
  position: z.number().finite(),
});

// ── Labels ────────────────────────────────────────────────────────────
export const createLabelSchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color"),
});

// ── Checklist ─────────────────────────────────────────────────────────
export const checklistItemSchema = z.object({
  text: z.string().min(1, "Item cannot be empty").max(300),
});

export const updateChecklistItemSchema = z.object({
  text: z.string().min(1).max(300).optional(),
  done: z.boolean().optional(),
  position: z.number().finite().optional(),
});

// ── Comments ──────────────────────────────────────────────────────────
export const commentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(5_000),
});

// ── Chat ──────────────────────────────────────────────────────────────
export const chatMessageSchema = z.object({
  body: z.string().min(1, "Message cannot be empty").max(5_000),
  parentId: z.string().optional(),
});

export const createChannelSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export const createDmSchema = z.object({
  userId: z.string().min(1),
});

// ── Attachments ───────────────────────────────────────────────────────
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const requestUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().refine((t) => ALLOWED_FILE_TYPES.includes(t), {
    message: "File type not allowed",
  }),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE, "File must be 10 MB or smaller"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
