/**
 * Due-date reminders: hourly sweep for tasks due within 24 hours that
 * haven't been reminded yet. Notifies (and emails) every assignee, then
 * stamps reminderSentAt so a task is only ever reminded once.
 *
 * A short Redis lock makes the sweep single-flight across ECS instances.
 */
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/redis/client";
import { emitToUser } from "./emitter";
import { EVENTS } from "./events";
import { sendDueSoonEmail } from "@/lib/email";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
const LOCK_KEY = "cron:due-reminders:lock";
const LOCK_TTL_S = 10 * 60;

async function sweepDueReminders(): Promise<void> {
  // Only one instance runs the sweep per interval.
  const locked = await redis.set(LOCK_KEY, "1", "EX", LOCK_TTL_S, "NX");
  if (!locked) return;

  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { gte: now, lte: cutoff },
      reminderSentAt: null,
      assignees: { some: {} },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      boardId: true,
      board: { select: { workspaceId: true, workspace: { select: { slug: true } } } },
      assignees: { select: { userId: true, user: { select: { email: true } } } },
    },
    take: 200,
  });

  for (const task of tasks) {
    try {
      for (const assignee of task.assignees) {
        // System notification — no actor, so write directly instead of
        // going through createNotification (which models user actions).
        const notification = await prisma.notification.create({
          data: {
            workspaceId: task.board.workspaceId,
            recipientId: assignee.userId,
            type: "TASK_DUE_SOON",
            taskId: task.id,
            meta: { taskTitle: task.title, boardId: task.boardId, dueDate: task.dueDate?.toISOString() },
          },
          include: {
            actor: { select: { id: true, name: true, image: true } },
            workspace: { select: { id: true, name: true, slug: true } },
          },
        });
        emitToUser(assignee.userId, EVENTS.NOTIFICATION_NEW, notification);
        await sendDueSoonEmail({
          to: assignee.user.email,
          taskTitle: task.title,
          dueDate: task.dueDate!,
          workspaceSlug: task.board.workspace.slug,
          boardId: task.boardId,
          taskId: task.id,
        });
      }
      await prisma.task.update({
        where: { id: task.id },
        data: { reminderSentAt: now },
      });
    } catch (err) {
      console.error("[reminders] failed for task", task.id, err);
    }
  }

  if (tasks.length) console.log(`[reminders] sent reminders for ${tasks.length} task(s)`);
}

export function startReminderCron(): void {
  // First sweep shortly after boot, then hourly.
  setTimeout(() => sweepDueReminders().catch((e) => console.error("[reminders]", e)), 30_000);
  setInterval(
    () => sweepDueReminders().catch((e) => console.error("[reminders]", e)),
    SWEEP_INTERVAL_MS
  ).unref();
}
