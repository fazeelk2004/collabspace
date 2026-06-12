import { redis } from "./client";

// Presence lives in Redis so it works across multiple ECS containers and
// expires automatically if a container dies without cleaning up.

const ONLINE_TTL_S = 70; // refreshed every ~30s by presence:ping

const onlineKey = (workspaceId: string, userId: string) =>
  `presence:online:${workspaceId}:${userId}`;
const viewersKey = (boardId: string) => `presence:viewers:${boardId}`;

export async function markOnline(workspaceId: string, userId: string): Promise<void> {
  await redis.set(onlineKey(workspaceId, userId), "1", "EX", ONLINE_TTL_S);
}

export async function markOffline(workspaceId: string, userId: string): Promise<void> {
  await redis.del(onlineKey(workspaceId, userId));
}

export async function refreshOnline(workspaceId: string, userId: string): Promise<void> {
  await redis.expire(onlineKey(workspaceId, userId), ONLINE_TTL_S);
}

export async function getOnlineUserIds(workspaceId: string): Promise<string[]> {
  const prefix = `presence:online:${workspaceId}:`;
  const ids: string[] = [];
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
    cursor = next;
    for (const key of keys) ids.push(key.slice(prefix.length));
  } while (cursor !== "0");
  return ids;
}

export async function addBoardViewer(boardId: string, userId: string): Promise<void> {
  await redis.sadd(viewersKey(boardId), userId);
  await redis.expire(viewersKey(boardId), 60 * 60 * 12);
}

export async function removeBoardViewer(boardId: string, userId: string): Promise<void> {
  await redis.srem(viewersKey(boardId), userId);
}

export async function getBoardViewers(boardId: string): Promise<string[]> {
  return redis.smembers(viewersKey(boardId));
}

// "Who has this task open" — same pattern as board viewers, keyed per task.
const taskViewersKey = (taskId: string) => `presence:task-viewers:${taskId}`;

export async function addTaskViewer(taskId: string, userId: string): Promise<void> {
  await redis.sadd(taskViewersKey(taskId), userId);
  await redis.expire(taskViewersKey(taskId), 60 * 60 * 2);
}

export async function removeTaskViewer(taskId: string, userId: string): Promise<void> {
  await redis.srem(taskViewersKey(taskId), userId);
}

export async function getTaskViewers(taskId: string): Promise<string[]> {
  return redis.smembers(taskViewersKey(taskId));
}
