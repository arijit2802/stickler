import { test, expect } from "@playwright/test";

/**
 * E2E tests for the onboarding interview flow.
 * Prerequisites: local dev server running, test user credentials in env.
 *
 * Run with: npx playwright test tests/e2e/onboarding.spec.ts
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "test@example.com";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "testpassword123";

test.describe("Onboarding Interview Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Sign in via Clerk sign-in page
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /continue|sign in/i }).click();
    await page.waitForURL("/onboarding");
  });

  test("new user sees the chat interface on first visit", async ({ page }) => {
    await expect(page.getByText("Getting to know you")).toBeVisible();
    // First message from Claude should appear
    await expect(page.locator(".rounded-2xl").first()).toBeVisible({ timeout: 10000 });
  });

  test("user can type and submit a message", async ({ page }) => {
    // Wait for Claude's greeting
    await page.waitForSelector(".rounded-2xl", { timeout: 10000 });

    // Type a message
    const textarea = page.getByPlaceholder(/Type your answer/);
    await textarea.fill("I am a software engineer");
    await page.getByRole("button", { name: "Send" }).click();

    // User message should appear
    await expect(page.getByText("I am a software engineer")).toBeVisible();

    // Claude should respond (loading indicator then response)
    await expect(page.locator(".animate-bounce").first()).toBeVisible();
    await page.waitForFunction(
      () => document.querySelectorAll(".animate-bounce").length === 0,
      { timeout: 15000 }
    );
  });

  test("Enter key sends the message", async ({ page }) => {
    await page.waitForSelector(".rounded-2xl", { timeout: 10000 });
    const textarea = page.getByPlaceholder(/Type your answer/);
    await textarea.fill("Product Manager at a startup");
    await textarea.press("Enter");
    await expect(page.getByText("Product Manager at a startup")).toBeVisible();
  });

  test("error state shown when API fails", async ({ page }) => {
    // Intercept the respond endpoint to simulate failure
    await page.route("**/api/onboarding/respond", (route) => {
      void route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) });
    });

    await page.waitForSelector(".rounded-2xl", { timeout: 10000 });
    const textarea = page.getByPlaceholder(/Type your answer/);
    await textarea.fill("Test message");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText(/Something went wrong|Server error/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("profile summary card appears after interview completion", async ({ page }) => {
    // Intercept respond to simulate PROFILE_COMPLETE
    let callCount = 0;
    await page.route("**/api/onboarding/respond", async (route) => {
      callCount++;
      if (callCount >= 2) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Great, here is your profile summary.",
            isComplete: true,
            profileData: {
              role: "Software Engineer",
              interests: [{ topic: "AI", depth: "deep dive", keywords: ["LLM"] }],
              aspirations: [{ goal: "Build AI products", priority: 1 }],
              knowledgeLevel: [{ topic: "AI", level: "intermediate" }],
              motivation: "Stay current",
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.waitForSelector(".rounded-2xl", { timeout: 10000 });
    const textarea = page.getByPlaceholder(/Type your answer/);

    // First message
    await textarea.fill("Software Engineer");
    await page.getByRole("button", { name: "Send" }).click();
    await page.waitForTimeout(500);

    // Second message triggers PROFILE_COMPLETE
    await textarea.fill("yes, looks good");
    await page.getByRole("button", { name: "Send" }).click();

    // Profile summary card should appear
    await expect(page.getByText("Your Learning Profile")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Looks Good — Start Learning")).toBeVisible();
  });
});
