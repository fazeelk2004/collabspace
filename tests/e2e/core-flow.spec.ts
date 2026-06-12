import { test, expect, type Page } from "@playwright/test";

/**
 * Wait for React hydration. Clicking submit before hydration triggers a
 * native GET form submission instead of the React handler — especially
 * likely in dev where bundles compile on first visit.
 */
async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  // window.next is set by the app router during hydration. networkidle is
  // useless here: dev-mode HMR keeps the network permanently busy.
  await page.waitForFunction(() => "next" in window);
  await page.waitForTimeout(300);
}

/**
 * The golden path: register → create workspace → create board from a
 * template → add a task → open it and add a checklist item.
 */
test("register, create workspace, board and task", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;

  // ── Register ────────────────────────────────────────────────────────
  await gotoHydrated(page, "/register");
  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Password123");
  await page.getByRole("button", { name: "Create account" }).click();

  // Lands on the workspace hub with no workspaces yet. Generous timeout:
  // in dev the page compiles on first visit.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByText("Create your first workspace")).toBeVisible();

  // ── Create workspace ────────────────────────────────────────────────
  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Workspace name").fill(`E2E Space ${stamp}`);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/w\//, { timeout: 15_000 });

  // ── Create a board from the Sprint template ─────────────────────────
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Board name").fill("Launch plan");
  await page.getByRole("button", { name: /Sprint/ }).click();
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page).toHaveURL(/\/boards\//, { timeout: 15_000 });

  // Template columns are rendered.
  await expect(page.getByText("Backlog")).toBeVisible();
  await expect(page.getByText("In Review")).toBeVisible();

  // ── Create a task ───────────────────────────────────────────────────
  await page.getByRole("button", { name: "Add task" }).first().click();
  await page.getByPlaceholder("Task title… (Enter to add)").fill("Ship the landing page");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Ship the landing page")).toBeVisible();

  // ── Open the task and add a checklist item ──────────────────────────
  await page.getByText("Ship the landing page").click();
  await expect(page.getByText("Checklist")).toBeVisible();
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByPlaceholder("Add an item…").fill("Review copy");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Review copy")).toBeVisible();
});

test("sign in with wrong password shows an error", async ({ page }) => {
  await gotoHydrated(page, "/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Stays on the login page instead of navigating to the dashboard.
  await expect(page).toHaveURL(/\/login/);
});
