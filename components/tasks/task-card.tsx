"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast } from "date-fns";
import { Calendar, MessageSquare, Paperclip, Pencil, CheckSquare } from "lucide-react";
import { cn, getInitials, PRIORITY_META } from "@/lib/utils";
import type { Task } from "@/types";
import { useBoardStore } from "@/store/board-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TaskCard({
  task,
  overlay,
  onOpen,
}: {
  task: Task;
  overlay?: boolean;
  onOpen?: () => void;
}) {
  const editingBy = useBoardStore((s) => s.editingTasks[task.id]);
  const priority = PRIORITY_META[task.priority];
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due ? isPast(due) : false;

  return (
    <div
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group cursor-pointer rounded-lg border bg-card p-3 shadow-sm outline-none transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        overlay && "shadow-xl"
      )}
    >
      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.map(({ label }) => (
            <span
              key={label.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${label.color}22`, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: priority.color }}
          title={`${priority.label} priority`}
        />
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{task.title}</p>
      </div>

      {/* Live "someone is editing" indicator */}
      {editingBy && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
          <Pencil className="h-3 w-3 animate-pulse" />
          {editingBy.name} is editing…
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        {due && (
          <span
            className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}
          >
            <Calendar className="h-3 w-3" />
            {format(due, "MMM d")}
          </span>
        )}
        {task._count.comments > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> {task._count.comments}
          </span>
        )}
        {task._count.attachments > 0 && (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3" /> {task._count.attachments}
          </span>
        )}
        {(task._count.checklist ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="h-3 w-3" /> {task._count.checklist}
          </span>
        )}
        {task.assignees.length > 0 && (
          <div className="ml-auto flex -space-x-1.5">
            {task.assignees.slice(0, 3).map(({ user }) => (
              <Tooltip key={user.id}>
                <TooltipTrigger asChild>
                  <Avatar className="h-5 w-5 border border-background">
                    {user.image && <AvatarImage src={user.image} alt="" />}
                    <AvatarFallback className="text-[9px]">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{user.name}</TooltipContent>
              </Tooltip>
            ))}
            {task.assignees.length > 3 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted text-[9px]">
                +{task.assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** dnd-kit sortable wrapper around the card. */
export function SortableTaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  );
}
