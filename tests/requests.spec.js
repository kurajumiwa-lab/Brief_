import { test, expect } from "@playwright/test";

const text = {
  title: "2,000 branded paper bags",
  description: "Kraft paper takeaway bags for monthly restaurant orders.",
};
async function account(page) {
  await page.goto("/#requests");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page
    .getByLabel("Handle", { exact: true })
    .fill(`buyer_${Date.now().toString(36)}`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-request-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No open requests yet." }),
  ).toBeVisible();
}
async function start(page) {
  await page
    .locator(".request-empty")
    .getByRole("button", { name: "Create a Request" })
    .click();
  await expect(
    page.getByLabel("What do you need?", { exact: true }),
  ).toBeVisible();
}
async function fill(page) {
  await page.getByLabel("What do you need?", { exact: true }).fill(text.title);
  await page.getByLabel("Quantity (optional)", { exact: true }).fill("2000");
  await page.getByLabel("Unit", { exact: true }).fill("pieces");
  await page.getByLabel("Location", { exact: true }).fill("Nairobi");
  await page
    .getByLabel("Required by (optional)", { exact: true })
    .fill("2099-09-12");
  await page
    .getByLabel("Short description", { exact: true })
    .fill(text.description);
}
async function fits(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("real create → persist → reload → edit → matching → cancel, with images and history", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What do you need?", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Everything Happening Around You" }),
  ).toBeVisible();
  await expect(page.getByText("Amina's Cakes", { exact: true })).toHaveCount(0);
  await fits(page);
  await account(page);
  await start(page);
  await fill(page);
  await page.locator("summary").filter({ hasText: "Budget" }).click();
  await page.getByLabel("Minimum budget", { exact: true }).fill("20000");
  await page.getByLabel("Maximum budget", { exact: true }).fill("50000");
  await page
    .locator("summary")
    .filter({ hasText: "Specifications & delivery" })
    .click();
  await page.getByLabel("Material", { exact: true }).fill("Kraft paper");
  await page.getByLabel("Dimensions", { exact: true }).fill("20 × 30 cm");
  await page
    .getByLabel("Brand requirements", { exact: true })
    .fill("Two-color logo");
  await page
    .getByLabel("Delivery location", { exact: true })
    .fill("Industrial Area, Nairobi");
  await page.locator("summary").filter({ hasText: "Business context" }).click();
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Browser-test buyer");
  await page.getByLabel("Buying frequency", { exact: true }).fill("Monthly");
  await page.locator("summary").filter({ hasText: "Reference images" }).click();
  await page
    .getByLabel("Add an image", { exact: true })
    .setInputFiles({
      name: "spec.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(page.getByText("Uploading image…")).toHaveCount(0);
  await expect(page.locator(".request-attachments")).toContainText("spec.png");
  await fits(page);
  await page
    .getByRole("button", { name: "Submit Request", exact: true })
    .click();
  await expect(page.locator(".request-detail h2")).toHaveText(text.title);
  const url = page.url();
  await expect(page.locator(".request-status")).toHaveText("open");
  await expect(page.locator(".request-detail")).toContainText("Kraft paper");
  await expect(page.locator(".request-detail")).toContainText(
    "Browser-test buyer",
  );
  await page.getByRole("button", {name: "Open spec.png (private)"}).click();
  await expect(page.getByRole("dialog", {name:"Private Request image"})).toBeVisible();
  await page.getByRole("button", {name:"Close image"}).click();
  await page.reload();
  await expect(page.locator(".request-detail h2")).toHaveText(text.title);
  await expect(page.locator(".request-detail")).toContainText("2,000 pieces");
  await page.getByRole("button", { name: "Edit Request", exact: true }).click();
  await page.getByLabel("Quantity (optional)", { exact: true }).fill("3000");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".request-detail")).toContainText("3,000 pieces");
  await page
    .getByRole("button", { name: "Mark ready for matching", exact: true })
    .click();
  await expect(page.locator(".request-status")).toHaveText("matching");
  await expect(page.locator(".request-future")).toContainText(
    "Brief has evaluated published capabilities",
  );
  await expect(page.getByRole("region", {name:"Request quotes", exact:true})).toContainText("No quotes yet");
  await page
    .getByRole("button", { name: "← My Requests", exact: true })
    .click();
  await page.getByRole("button", { name: /^Active / }).click();
  await page.locator(".request-row").filter({ hasText: text.title }).click();
  await expect(page).toHaveURL(url);
  await page
    .getByRole("button", { name: "Cancel Request", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep Request", exact: true }).click();
  await expect(page.locator(".request-status")).toHaveText("matching");
  await page
    .getByRole("button", { name: "Cancel Request", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, cancel Request", exact: true })
    .click();
  await expect(page.locator(".request-status")).toHaveText("cancelled");
  await page.reload();
  await expect(page.locator(".request-status")).toHaveText("cancelled");
  await expect(
    page.getByRole("button", { name: "Edit Request", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".request-history")).toContainText("cancelled");
  await fits(page);
  expect(errors).toEqual([]);
});

test("drafts, server validation, errors, retry and browser refresh", async ({
  page,
}) => {
  await account(page);
  await page.getByRole("button", { name: /^Completed / }).click();
  await expect(
    page.getByRole("heading", { name: "No completed requests yet." }),
  ).toBeVisible();
  await start(page);
  await page
    .getByLabel("What do you need?", { exact: true })
    .fill("Twenty office chairs");
  await page
    .getByRole("button", { name: "Submit Request", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("short description");
  await expect(
    page.getByLabel("What do you need?", { exact: true }),
  ).toHaveValue("Twenty office chairs");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator(".request-status")).toHaveText("draft");
  await page.reload();
  await expect(page.locator(".request-status")).toHaveText("draft");
  await page.getByRole("button", { name: "Edit Request", exact: true }).click();
  await fill(page);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit Request", exact: true })
    .click();
  await expect(page.locator(".request-status")).toHaveText("open");
  await page.getByRole("button", { name: "Edit Request", exact: true }).click();
  await page.getByLabel("Quantity (optional)", { exact: true }).fill("2500");
  await page.route("**/ingest/api/requests/*", (route) =>
    route.request().method() === "PATCH"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByLabel("Quantity (optional)", { exact: true }),
  ).toHaveValue("2500");
  await page.unroute("**/ingest/api/requests/*");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".request-detail")).toContainText("2,500 pieces");
  await page.route("**/ingest/api/me/requests", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporarily unavailable" }),
    }),
  );
  await page
    .getByRole("button", { name: "← My Requests", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Temporarily unavailable",
  );
  await page.unroute("**/ingest/api/me/requests");
  await page.getByRole("button", { name: "Reload / retry" }).click();
  await expect(page.locator(".request-row")).toContainText(text.title);
  await fits(page);
});

test('lost creation response is retry-safe and never placed in the offline queue', async ({ page }) => {
  await account(page); await start(page); await fill(page);
  let savedId;
  await page.route('**/ingest/api/requests', async route => {
    const response = await route.fetch(); // the real server commits the write
    savedId = (await response.json()).request.id;
    await route.abort('failed'); // the phone never receives confirmation
  });
  await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not confirm the save');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('brief.offlineQueue.v1') || '[]').length)).toBe(0);
  await page.unroute('**/ingest/api/requests');
  await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
  await expect(page.locator('.request-detail h2')).toHaveText(text.title);
  await expect(page).toHaveURL(new RegExp(savedId));
  await page.getByRole('button', { name: '← My Requests', exact: true }).click();
  await expect(page.locator('.request-row')).toHaveCount(1);
});

test('two-tab edits cannot overwrite newer demand', async ({ page, context }) => {
  await account(page); await start(page); await fill(page);
  await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
  await expect(page.locator('.request-detail h2')).toHaveText(text.title);
  const other = await context.newPage(); await other.goto(page.url());
  await page.getByRole('button', { name: 'Edit Request', exact: true }).click();
  await other.getByRole('button', { name: 'Edit Request', exact: true }).click();
  await other.getByLabel('Quantity (optional)', { exact: true }).fill('5000');
  await other.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(other.locator('.request-detail')).toContainText('5,000 pieces');
  await page.getByLabel('Quantity (optional)', { exact: true }).fill('6000');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This request changed');
  await expect(page.getByLabel('Quantity (optional)', { exact: true })).toHaveValue('6000');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Reload saved Request', exact: true }).click();
  await expect(page.locator('.request-detail')).toContainText('5,000 pieces');
  await other.close();
});

test('expired sessions can sign back in without losing the form', async ({ page }) => {
  await account(page); await start(page); await fill(page);
  await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
  await expect(page.locator('.request-detail h2')).toHaveText(text.title);
  const token = await page.evaluate(() => localStorage.getItem('brief_session'));
  const identity = await page.request.get('/ingest/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
  const handle = (await identity.json()).user.handle;
  await page.getByRole('button', { name: 'Edit Request', exact: true }).click();
  await page.getByLabel('Quantity (optional)', { exact: true }).fill('4500');
  await page.request.post('/ingest/api/auth/logout', { headers: { authorization: `Bearer ${token}` } });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to save your Request' })).toBeVisible();
  await page.getByLabel('Handle', { exact: true }).fill(handle);
  await page.getByLabel('Password', { exact: true }).fill('test-request-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Quantity (optional)', { exact: true })).toHaveValue('4500');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.request-detail')).toContainText('4,500 pieces');
});
