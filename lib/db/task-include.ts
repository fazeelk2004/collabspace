/** Shared Prisma include for task DTOs so every endpoint returns the same shape. */
export const TASK_INCLUDE = {
  assignees: { include: { user: { select: { id: true, name: true, image: true } } } },
  labels: { include: { label: true } },
  createdBy: { select: { id: true, name: true, image: true } },
  _count: { select: { comments: true, attachments: true, checklist: true } },
} as const;
