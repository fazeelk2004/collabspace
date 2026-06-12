"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Trash2, CheckIcon } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { cn, getInitials, PRIORITY_META } from "@/lib/utils";
import type { TaskDetail, Member, Role } from "@/types";
import { can } from "@/lib/permissions-client";
import { useBoardStore } from "@/store/board-store";
import { getSocket, useSocketEvent } from "@/hooks/use-socket";
import { EVENTS } from "@/server/events";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CommentsSection } from "@/components/comments/comments-section";
import { ChecklistSection } from "./checklist-section";
import { AttachmentsSection } from "./attachments-section";
import { ActivityList } from "@/components/activity/activity-list";

export function TaskDetailSheet({
  taskId,
  boardId,
  role,
  members,
  currentUserId,
  onClose,
}: {
  taskId: string;
  boardId: string;
  role: Role;
  members: Member[];
  currentUserId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const updateTaskInStore = useBoardStore((s) => s.updateTask);
  const removeTaskFromStore = useBoardStore((s) => s.removeTask);

  const { data, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api<{ task: TaskDetail }>(`/api/tasks/${taskId}`),
  });
  const task = data?.task;

  const editable = can.contribute(role);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const editingSignalSent = useRef(false);

  // Live "who else has this task open" presence.
  useEffect(() => {
    const socket = getSocket();
    const join = () => socket.emit(EVENTS.TASK_VIEW_JOIN, { boardId, taskId });
    join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      socket.emit(EVENTS.TASK_VIEW_LEAVE, { boardId, taskId });
    };
  }, [boardId, taskId]);

  useSocketEvent<{ taskId: string; viewers: string[] }>(EVENTS.TASK_VIEWERS, (p) => {
    if (p.taskId === taskId) setViewerIds(p.viewers);
  });

  const otherViewers = members.filter(
    (m) => m.userId !== currentUserId && viewerIds.includes(m.userId)
  );

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
    }
  }, [task]);

  // Broadcast "user is editing this task" while the sheet has unsaved edits.
  function signalEditing(editing: boolean) {
    if (editing === editingSignalSent.current) return;
    editingSignalSent.current = editing;
    getSocket().emit(EVENTS.TASK_EDITING, { boardId, taskId, editing });
  }
  useEffect(() => () => signalEditing(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(body: Record<string, unknown>) {
    try {
      const { task: updated } = await api<{ task: TaskDetail }>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body,
      });
      updateTaskInStore(updated);
      queryClient.setQueryData(["task", taskId], (old: { task: TaskDetail } | undefined) =>
        old ? { task: { ...old.task, ...updated } } : old
      );
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Update failed");
    } finally {
      signalEditing(false);
    }
  }

  async function deleteTask() {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try {
      await api(`/api/tasks/${taskId}`, { method: "DELETE" });
      removeTaskFromStore(taskId);
      onClose();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : "Delete failed");
    }
  }

  async function toggleAssignee(userId: string) {
    if (!task) return;
    const current = task.assignees.map((a) => a.user.id);
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    await patch({ assigneeIds: next });
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col gap-0 overflow-hidden p-0">
        {isLoading || !task ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b p-5 pr-12">
              {editable ? (
                <Input
                  value={title}
                  className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                  onChange={(e) => {
                    setTitle(e.target.value);
                    signalEditing(true);
                  }}
                  onBlur={() => title.trim() && title !== task.title && patch({ title: title.trim() })}
                  aria-label="Task title"
                />
              ) : (
                <SheetTitle>{task.title}</SheetTitle>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{task.column.name}</Badge>
                <span>
                  updated {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                  {task.updatedBy && <> by {task.updatedBy.name}</>}
                </span>
                {otherViewers.length > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="flex -space-x-1.5">
                      {otherViewers.slice(0, 4).map((m) => (
                        <Avatar key={m.userId} className="h-5 w-5 border border-background">
                          {m.user.image && <AvatarImage src={m.user.image} alt="" />}
                          <AvatarFallback className="text-[8px]">
                            {getInitials(m.user.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </span>
                    {otherViewers.length === 1
                      ? `${otherViewers[0].user.name} is viewing`
                      : `${otherViewers.length} viewing`}
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {/* Properties */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Priority</p>
                  <Select
                    value={task.priority}
                    disabled={!editable}
                    onValueChange={(v) => patch({ priority: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_META) as (keyof typeof PRIORITY_META)[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: PRIORITY_META[p].color }}
                            />
                            {PRIORITY_META[p].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Due date</p>
                  <Input
                    type="date"
                    className="h-8"
                    disabled={!editable}
                    value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                    onChange={(e) =>
                      patch({ dueDate: e.target.value ? new Date(e.target.value) : null })
                    }
                  />
                </div>
              </div>

              {/* Assignees */}
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Assignees</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {task.assignees.map(({ user }) => (
                    <Badge key={user.id} variant="secondary" className="gap-1.5 py-1">
                      <Avatar className="h-4 w-4">
                        {user.image && <AvatarImage src={user.image} alt="" />}
                        <AvatarFallback className="text-[8px]">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      {user.name}
                    </Badge>
                  ))}
                  {editable && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          {task.assignees.length ? "Edit" : "Assign"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-1" align="start">
                        {members.map((m) => {
                          const assigned = task.assignees.some((a) => a.user.id === m.userId);
                          return (
                            <button
                              key={m.userId}
                              onClick={() => toggleAssignee(m.userId)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                            >
                              <Avatar className="h-6 w-6">
                                {m.user.image && <AvatarImage src={m.user.image} alt="" />}
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(m.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1 truncate text-left">{m.user.name}</span>
                              {assigned && <CheckIcon className="h-4 w-4 text-primary" />}
                            </button>
                          );
                        })}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Description</p>
                {editable ? (
                  <Textarea
                    value={description}
                    placeholder="Add a description…"
                    className="min-h-24"
                    onChange={(e) => {
                      setDescription(e.target.value);
                      signalEditing(true);
                    }}
                    onBlur={() =>
                      description !== (task.description ?? "") &&
                      patch({ description: description || null })
                    }
                  />
                ) : (
                  <p
                    className={cn(
                      "whitespace-pre-wrap text-sm",
                      !task.description && "italic text-muted-foreground"
                    )}
                  >
                    {task.description || "No description"}
                  </p>
                )}
              </div>

              {/* Checklist */}
              <ChecklistSection taskId={taskId} canEdit={editable} />

              {/* Tabs: comments / attachments / activity */}
              <Tabs defaultValue="comments" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="comments" className="flex-1">
                    Comments ({task.comments.length})
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className="flex-1">
                    Files ({task.attachments.length})
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1">
                    Activity
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="comments">
                  <CommentsSection
                    taskId={taskId}
                    boardId={boardId}
                    members={members}
                    canComment={editable}
                    currentUserId={currentUserId}
                    canModerate={can.manage(role)}
                  />
                </TabsContent>
                <TabsContent value="attachments">
                  <AttachmentsSection taskId={taskId} canUpload={editable} />
                </TabsContent>
                <TabsContent value="activity">
                  <ActivityList activities={task.activities} compact />
                </TabsContent>
              </Tabs>
            </div>

            {editable && (
              <div className="border-t p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={deleteTask}
                >
                  <Trash2 /> Delete task
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
