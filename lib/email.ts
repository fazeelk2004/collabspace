/**
 * Transactional email via the Resend HTTP API — no SDK dependency.
 * Silently no-ops when RESEND_API_KEY is unset (local dev, CI) so callers
 * never need to guard. Failures are logged, never thrown: email is
 * best-effort and must not break the triggering request.
 */

const FROM = process.env.EMAIL_FROM ?? "CollabSpace <onboarding@resend.dev>";

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!emailEnabled()) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!res.ok) {
      console.error("[email] send failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}

/** Shared shell so every email looks like the product. */
function layout(title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `
  <div style="background:#0f1222;padding:40px 16px;font-family:Inter,system-ui,sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#181c30;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px">
      <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#a5b4fc">CollabSpace</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#ffffff">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#cbd5e1">${bodyHtml}</div>
      <a href="${ctaUrl}" style="display:inline-block;margin-top:24px;padding:10px 24px;border-radius:9999px;background:linear-gradient(to right,#6366f1,#8b5cf6);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${ctaLabel}</a>
    </div>
    <p style="max-width:480px;margin:16px auto 0;font-size:11px;color:#64748b;text-align:center">
      You received this because of activity in your CollabSpace workspace.
    </p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendInviteEmail(input: {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  token: string;
}): Promise<void> {
  await sendEmail(
    input.to,
    `${input.inviterName} invited you to ${input.workspaceName}`,
    layout(
      `Join ${escapeHtml(input.workspaceName)}`,
      `<p>${escapeHtml(input.inviterName)} invited you to collaborate as
        <strong>${escapeHtml(input.role.toLowerCase())}</strong>.</p>`,
      "Accept invitation",
      appUrl(`/invite/${input.token}`)
    )
  );
}

export async function sendTaskAssignedEmail(input: {
  to: string;
  actorName: string;
  taskTitle: string;
  workspaceSlug: string;
  boardId: string;
  taskId: string;
}): Promise<void> {
  await sendEmail(
    input.to,
    `${input.actorName} assigned you a task`,
    layout(
      "You have a new task",
      `<p>${escapeHtml(input.actorName)} assigned you
        <strong>${escapeHtml(input.taskTitle)}</strong>.</p>`,
      "Open task",
      appUrl(`/w/${input.workspaceSlug}/boards/${input.boardId}?task=${input.taskId}`)
    )
  );
}

export async function sendMentionEmail(input: {
  to: string;
  actorName: string;
  context: "comment" | "chat";
  snippet: string;
  url: string;
}): Promise<void> {
  await sendEmail(
    input.to,
    `${input.actorName} mentioned you`,
    layout(
      `${escapeHtml(input.actorName)} mentioned you in a ${input.context === "comment" ? "comment" : "message"}`,
      `<p style="border-left:3px solid #6366f1;padding-left:12px;color:#94a3b8">
        ${escapeHtml(input.snippet.slice(0, 200))}</p>`,
      "View it",
      appUrl(input.url)
    )
  );
}

export async function sendDueSoonEmail(input: {
  to: string;
  taskTitle: string;
  dueDate: Date;
  workspaceSlug: string;
  boardId: string;
  taskId: string;
}): Promise<void> {
  await sendEmail(
    input.to,
    `"${input.taskTitle}" is due soon`,
    layout(
      "Task due soon",
      `<p><strong>${escapeHtml(input.taskTitle)}</strong> is due
        ${input.dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}.</p>`,
      "Open task",
      appUrl(`/w/${input.workspaceSlug}/boards/${input.boardId}?task=${input.taskId}`)
    )
  );
}
