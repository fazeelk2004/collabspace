/**
 * Custom HTTP server: Next.js request handler + Socket.io on one port.
 * One container, one port — the ALB needs a single target group and
 * WebSocket upgrades work without extra routing.
 */
import { createServer } from "node:http";
import next from "next";
import { createSocketServer } from "./socket";
import { startReminderCron } from "./reminders";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const httpServer = createServer((req, res) => {
    // Lightweight request log (CloudWatch picks up stdout).
    const start = Date.now();
    res.on("finish", () => {
      if (req.url?.startsWith("/_next")) return; // skip asset noise
      console.log(
        JSON.stringify({
          t: new Date().toISOString(),
          method: req.method,
          url: req.url,
          status: res.statusCode,
          ms: Date.now() - start,
        })
      );
    });
    handle(req, res);
  });

  createSocketServer(httpServer);
  startReminderCron();

  httpServer.listen(port, hostname, () => {
    console.log(`[server] ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
  });

  // Graceful shutdown so ECS task draining doesn't drop in-flight requests.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      console.log(`[server] ${signal} received, shutting down`);
      httpServer.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
