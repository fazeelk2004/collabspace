import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { parse as parseCookies } from "./cookie";
import { verifySession } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/auth/jwt";
import { createRedisClient } from "@/lib/redis/client";
import { setIo } from "./emitter";
import { registerRoomHandlers } from "./handlers/rooms";
import { registerPresenceHandlers } from "./handlers/presence";

export type AuthedSocket = Socket & {
  data: {
    userId: string;
    name: string;
    viewingTask?: { taskId: string; boardId: string };
  };
};

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      credentials: true,
    },
    // Long-polling stays enabled as an ALB-friendly fallback; stickiness
    // on the target group keeps a polling client pinned to one task.
    transports: ["websocket", "polling"],
  });

  // Redis adapter: fans broadcasts out across every ECS task.
  const pubClient = createRedisClient();
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // Auth middleware: verify the JWT from the httpOnly cookie before any
  // handler runs. Unauthenticated sockets never get past this point.
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? "";
      const token = parseCookies(cookieHeader)[SESSION_COOKIE];
      if (!token) return next(new Error("unauthorized"));
      const session = await verifySession(token);
      if (!session) return next(new Error("unauthorized"));
      socket.data.userId = session.userId;
      socket.data.name = session.name;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const s = socket as AuthedSocket;
    // Personal room for notifications and DM alerts.
    s.join(`user:${s.data.userId}`);

    registerRoomHandlers(io, s);
    registerPresenceHandlers(io, s);
  });

  setIo(io);
  return io;
}
