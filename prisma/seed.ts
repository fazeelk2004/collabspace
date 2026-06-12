/**
 * Demo seed: two users, one workspace, a board with tasks, chat history.
 * Run with: npm run db:seed
 * Sign in as demo@collabspace.dev / demo1234 (or alex@collabspace.dev / demo1234)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const demo = await prisma.user.upsert({
    where: { email: "demo@collabspace.dev" },
    update: {},
    create: { email: "demo@collabspace.dev", name: "Demo User", passwordHash },
  });
  const alex = await prisma.user.upsert({
    where: { email: "alex@collabspace.dev" },
    update: {},
    create: { email: "alex@collabspace.dev", name: "Alex Rivera", passwordHash },
  });

  const existing = await prisma.workspace.findUnique({ where: { slug: "acme-demo" } });
  if (existing) {
    console.log("Seed workspace already exists — skipping.");
    return;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: "Acme Inc.",
      slug: "acme-demo",
      createdById: demo.id,
      members: {
        createMany: {
          data: [
            { userId: demo.id, role: "OWNER" },
            { userId: alex.id, role: "MEMBER" },
          ],
        },
      },
      channels: { create: { name: "general", type: "WORKSPACE" } },
      labels: {
        createMany: {
          data: [
            { name: "Bug", color: "#ef4444" },
            { name: "Feature", color: "#8b5cf6" },
            { name: "Improvement", color: "#06b6d4" },
          ],
        },
      },
    },
    include: { labels: true, channels: true },
  });

  const board = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      name: "Product Launch",
      createdById: demo.id,
      channel: { create: { workspaceId: workspace.id, name: "product-launch", type: "BOARD" } },
      columns: {
        createMany: {
          data: [
            { name: "To Do", position: 1000 },
            { name: "In Progress", position: 2000 },
            { name: "Review", position: 3000 },
            { name: "Done", position: 4000 },
          ],
        },
      },
    },
    include: { columns: true },
  });

  const [todo, inProgress, , done] = board.columns;
  const featureLabel = workspace.labels.find((l) => l.name === "Feature")!;
  const bugLabel = workspace.labels.find((l) => l.name === "Bug")!;

  const tasks = [
    {
      columnId: todo.id, title: "Design landing page hero", priority: "HIGH" as const,
      position: 1000, labelId: featureLabel.id, assigneeId: alex.id,
      description: "New hero section with product screenshot and CTA.",
    },
    {
      columnId: todo.id, title: "Set up error tracking", priority: "MEDIUM" as const,
      position: 2000, labelId: null, assigneeId: null, description: null,
    },
    {
      columnId: inProgress.id, title: "Fix login redirect loop", priority: "URGENT" as const,
      position: 1000, labelId: bugLabel.id, assigneeId: demo.id,
      description: "Users get bounced between /login and /dashboard when the cookie expires.",
    },
    {
      columnId: done.id, title: "Migrate database to Prisma 6", priority: "LOW" as const,
      position: 1000, labelId: null, assigneeId: alex.id, description: null,
    },
  ];

  for (const t of tasks) {
    await prisma.task.create({
      data: {
        boardId: board.id,
        columnId: t.columnId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        position: t.position,
        createdById: demo.id,
        updatedById: demo.id,
        dueDate: t.priority === "URGENT" ? new Date(Date.now() + 2 * 86400_000) : null,
        ...(t.assigneeId && { assignees: { create: { userId: t.assigneeId } } }),
        ...(t.labelId && { labels: { create: { labelId: t.labelId } } }),
      },
    });
  }

  const general = workspace.channels[0];
  await prisma.chatMessage.createMany({
    data: [
      { channelId: general.id, authorId: demo.id, body: "Welcome to Acme! 🎉" },
      { channelId: general.id, authorId: alex.id, body: "Hey! Excited to get started on the launch board." },
    ],
  });

  console.log("Seeded demo workspace: http://localhost:3000/w/acme-demo");
  console.log("Logins: demo@collabspace.dev / demo1234 · alex@collabspace.dev / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
