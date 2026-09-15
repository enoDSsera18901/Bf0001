import { expect, test } from "@playwright/test";

test("Reality Lab demo is manipulable, stressable, breakable and mappable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Stop accepting/i })).toBeVisible();

  await page.getByRole("button", { name: /Deterministic demo/i }).click();
  await expect(page.getByRole("heading", { name: "Should this $40 product launch?" })).toBeVisible();
  await expect(page.locator(".decision-topline")).toContainText("Launch");

  const unitsControl = page.locator("label.model-input").filter({ hasText: "Monthly units" });
  const unitsNumber = unitsControl.locator('input[type="number"]');
  await unitsNumber.fill("100");
  await expect(page.locator(".decision-topline")).toContainText("Do not launch");
  await expect(page.locator(".model-output.output-primary strong")).toHaveText("-$8,400");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator(".decision-topline")).toContainText("Launch");

  await page.getByRole("button", { name: "Stress test" }).click();
  await page.getByRole("button", { name: /Demand shock/i }).click();
  await expect(page.locator(".decision-topline")).toContainText("Do not launch");

  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Break this" }).click();
  await expect(page.locator(".break-panel")).toContainText("Found a scenario that flips the conclusion to Do not launch");
  await page.getByRole("button", { name: "Apply scenario" }).click();
  await expect(page.locator(".decision-topline")).toContainText("Do not launch");

  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Timeline" }).click();
  await expect(page.locator("svg.model-chart")).toBeVisible();
  await expect(page.getByText("Profit by monthly units", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sensitivity" }).click();
  await expect(page.getByText("What actually matters?", { exact: true })).toBeVisible();
  await expect(page.locator(".sensitivity-row")).toHaveCount(5);

  await page.getByRole("button", { name: "Boundary" }).click();
  await expect(page.getByText("Decision boundary", { exact: true })).toBeVisible();
  await expect(page.locator(".boundary-cell")).toHaveCount(225);
  await expect(page.locator(".boundary-cell.boundary-current")).toHaveCount(1);
  await page.locator(".boundary-cell").first().click();
  await expect(page.locator(".boundary-cell").first()).toHaveClass(/boundary-current/);

  await page.getByRole("button", { name: "Logic" }).click();
  await expect(page.getByText("Model logic", { exact: true })).toBeVisible();
  await expect(page.locator(".formula-card code").filter({ hasText: "profit = revenue - variable_cost - fixed_cost - ad_spend" })).toBeVisible();

  await page.screenshot({ path: "test-results/reality-lab-demo.png", fullPage: true });
});
