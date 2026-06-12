# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core-flow.spec.ts >> register, create workspace, board and task
- Location: tests\e2e\core-flow.spec.ts:20:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/dashboard/
Received string:  "http://localhost:3000/register"
Timeout: 30000ms

Call log:
  - Expect "toHaveURL" with timeout 30000ms
    63 × unexpected value "http://localhost:3000/register"

```

```yaml
- link "CollabSpace":
  - /url: /
  - img
  - text: CollabSpace
- text: Create your account Free for you and your team Full name
- textbox "Full name":
  - /placeholder: Ada Lovelace
  - text: E2E Tester
- text: Email
- textbox "Email":
  - /placeholder: you@company.com
  - text: e2e-1781229223738@example.com
- text: Password
- textbox "Password": Password123
- button "Create account":
  - text: Create account
  - img
- paragraph:
  - text: Already registered?
  - link "Sign in":
    - /url: /login
- paragraph: Real-time collaboration for modern teams
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { test, expect, type Page } from "@playwright/test";
  2  | 
  3  | /**
  4  |  * Wait for React hydration. Clicking submit before hydration triggers a
  5  |  * native GET form submission instead of the React handler — especially
  6  |  * likely in dev where bundles compile on first visit.
  7  |  */
  8  | async function gotoHydrated(page: Page, path: string) {
  9  |   await page.goto(path);
  10 |   // window.next is set by the app router during hydration. networkidle is
  11 |   // useless here: dev-mode HMR keeps the network permanently busy.
  12 |   await page.waitForFunction(() => "next" in window);
  13 |   await page.waitForTimeout(300);
  14 | }
  15 | 
  16 | /**
  17 |  * The golden path: register → create workspace → create board from a
  18 |  * template → add a task → open it and add a checklist item.
  19 |  */
  20 | test("register, create workspace, board and task", async ({ page }) => {
  21 |   const stamp = Date.now();
  22 |   const email = `e2e-${stamp}@example.com`;
  23 | 
  24 |   // ── Register ────────────────────────────────────────────────────────
  25 |   await gotoHydrated(page, "/register");
  26 |   await page.getByLabel("Full name").fill("E2E Tester");
  27 |   await page.getByLabel("Email").fill(email);
  28 |   await page.getByLabel("Password").fill("Password123");
  29 |   await page.getByRole("button", { name: "Create account" }).click();
  30 | 
  31 |   // Lands on the workspace hub with no workspaces yet. Generous timeout:
  32 |   // in dev the page compiles on first visit.
> 33 |   await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  34 |   await expect(page.getByText("Create your first workspace")).toBeVisible();
  35 | 
  36 |   // ── Create workspace ────────────────────────────────────────────────
  37 |   await page.getByRole("button", { name: "New workspace" }).click();
  38 |   await page.getByLabel("Workspace name").fill(`E2E Space ${stamp}`);
  39 |   await page.getByRole("button", { name: "Create workspace" }).click();
  40 |   await expect(page).toHaveURL(/\/w\//, { timeout: 15_000 });
  41 | 
  42 |   // ── Create a board from the Sprint template ─────────────────────────
  43 |   await page.getByRole("button", { name: "New board" }).click();
  44 |   await page.getByLabel("Board name").fill("Launch plan");
  45 |   await page.getByRole("button", { name: /Sprint/ }).click();
  46 |   await page.getByRole("button", { name: "Create board" }).click();
  47 |   await expect(page).toHaveURL(/\/boards\//, { timeout: 15_000 });
  48 | 
  49 |   // Template columns are rendered.
  50 |   await expect(page.getByText("Backlog")).toBeVisible();
  51 |   await expect(page.getByText("In Review")).toBeVisible();
  52 | 
  53 |   // ── Create a task ───────────────────────────────────────────────────
  54 |   await page.getByRole("button", { name: "Add task" }).first().click();
  55 |   await page.getByPlaceholder("Task title… (Enter to add)").fill("Ship the landing page");
  56 |   await page.keyboard.press("Enter");
  57 |   await expect(page.getByText("Ship the landing page")).toBeVisible();
  58 | 
  59 |   // ── Open the task and add a checklist item ──────────────────────────
  60 |   await page.getByText("Ship the landing page").click();
  61 |   await expect(page.getByText("Checklist")).toBeVisible();
  62 |   await page.getByRole("button", { name: "Add item" }).click();
  63 |   await page.getByPlaceholder("Add an item…").fill("Review copy");
  64 |   await page.keyboard.press("Enter");
  65 |   await expect(page.getByText("Review copy")).toBeVisible();
  66 | });
  67 | 
  68 | test("sign in with wrong password shows an error", async ({ page }) => {
  69 |   await gotoHydrated(page, "/login");
  70 |   await page.getByLabel("Email").fill("nobody@example.com");
  71 |   await page.getByLabel("Password").fill("wrong-password-1");
  72 |   await page.getByRole("button", { name: "Sign in" }).click();
  73 |   // Stays on the login page instead of navigating to the dashboard.
  74 |   await expect(page).toHaveURL(/\/login/);
  75 | });
  76 | 
```