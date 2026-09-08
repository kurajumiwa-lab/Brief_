import { test, expect } from "@playwright/test";
const password = "work-browser-password";
const headers = (u) => ({ authorization: `Bearer ${u.token}` });
async function user(page, prefix) {
  const handle = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const res = await page.request.post("/ingest/api/auth/register", {
    data: { handle, password },
  });
  expect(res.status()).toBe(201);
  return { ...(await res.json()), handle };
}
async function as(page, u, route) {
  await page.goto("/");
  await page.evaluate((t) => localStorage.setItem("brief_session", t), u.token);
  await page.reload();
  await page.goto("/#" + route);
}
async function setup(page, info, product, source = false) {
  const buyer = await user(page, "work_buyer"),
    supplier = await user(page, "work_supplier");
  const res = await page.request.post("/ingest/api/enterprises", {
    headers: headers(supplier),
    data: {
      displayName: `${product} ${info.project.name}`,
      businessType: source ? "sourcing_agent" : "manufacturer",
      supplyRole: source ? "verified_sourcing_agent" : "direct_supplier",
      location: "Nairobi",
      serviceAreas: ["Nairobi"],
      publication: "public",
      firstCapability: {
        name: product,
        category: "Packaging",
        productsServices: [product],
        supplyMode: source ? "source" : "direct",
        capacityKind: source ? "sourcing_access" : "production",
        unit: "pieces",
        minimumQuantity: 100,
        maximumQuantity: 30000,
        typicalCapacity: 20000,
        leadTime: { minDays: 2, maxDays: 4 },
        serviceAreas: ["Nairobi"],
      },
    },
  });
  expect(res.status()).toBe(201);
  supplier.enterprise = (await res.json()).enterprise;
  await as(page, buyer, "requests/new");
  await page
    .getByLabel("What do you need?", { exact: true })
    .fill(`5,000 ${product}`);
  await page.getByLabel("Quantity (optional)", { exact: true }).fill("5000");
  await page.getByLabel("Unit", { exact: true }).fill("pieces");
  await page.getByLabel("Location", { exact: true }).fill("Nairobi");
  await page
    .getByLabel("Required by (optional)", { exact: true })
    .fill("2099-09-12");
  await page
    .getByLabel("Short description", { exact: true })
    .fill("Private buyer production requirement");
  await page
    .getByRole("button", { name: "Submit Request", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark ready for matching", exact: true })
    .click();
  const requestId = page.url().split("/").at(-1);
  const match = page.getByTestId("match-option").filter({
    has: page.getByRole("heading", {
      name: supplier.enterprise.displayName,
      exact: true,
    }),
  });
  await match
    .getByRole("button", { name: "Request a quote", exact: true })
    .click();
  await match.getByLabel(/Share this Request’s specification/).check();
  await match
    .getByRole("button", { name: "Send quote request", exact: true })
    .click();
  await expect(match).toContainText("now has a real quote request");
  await as(page, supplier, "supply/mine");
  const inv = page.getByTestId("quote-invitation");
  await inv
    .getByRole("button", { name: "I can help with this Request", exact: true })
    .click();
  await inv.getByRole("button", { name: "Create quote", exact: true }).click();
  const form = page.locator(".quote-editor");
  await form
    .getByLabel(source ? "Source unit cost" : "Unit price", { exact: true })
    .fill(source ? "16" : "18");
  await form
    .getByLabel("Production / service lead days", { exact: true })
    .fill("4");
  await form.getByLabel("Delivery lead days", { exact: true }).fill("1");
  await form
    .getByLabel(source ? "Logistics cost" : "Delivery cost", { exact: true })
    .fill("2000");
  if (source)
    await form
      .getByLabel("Disclosed sourcing / referral fee", { exact: true })
      .fill("3000");
  if (source) {
    await form
      .locator("summary")
      .filter({ hasText: "Private source provenance" })
      .click();
    await form
      .getByRole("textbox", { name: "Private source reference", exact: true })
      .fill("PRIVATE WORK SOURCE NETWORK");
  }
  await form.getByRole("button", { name: "Submit quote", exact: true }).click();
  await expect(form).toHaveCount(0);
  await as(page, buyer, `requests/${requestId}`);
  const quote = page.getByTestId("quote-card");
  await quote
    .getByRole("button", { name: "Accept quote", exact: true })
    .click();
  await quote
    .getByRole("button", { name: "Confirm acceptance", exact: true })
    .click();
  await expect(
    page.getByTestId("work-card").locator(".work-status"),
  ).toHaveText("created");
  const api = await page.request.get(
    `/ingest/api/requests/${requestId}/work-orders`,
    { headers: headers(buyer) },
  );
  expect(api.status()).toBe(200);
  const work = (await api.json()).workOrders[0];
  await quote
    .getByRole("button", { name: "Open Work Order", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.get("work")).toBe(work.id);
  return { buyer, supplier, requestId, work };
}
const card = (page) => page.getByTestId("work-card");
const panel = (page) =>
  card(page).getByRole("group", { name: "Work action", exact: true });
async function stage(page, text) {
  await expect(card(page).locator(".work-status")).toHaveText(text);
}
async function action(page, label, note) {
  await card(page).getByRole("button", { name: label, exact: true }).click();
  if (note)
    await panel(page)
      .getByRole("textbox", { name: "What happened?", exact: true })
      .fill(note);
  await panel(page)
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
}
async function fit(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
for (const source of [false, true])
  test(`${source ? "sourcing" : "direct"}: full real Request → Quote → Work → recorded delivery → requester completion`, async ({
    page,
  }, info) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const f = await setup(
      page,
      info,
      source ? "woven jute carriers" : "linen carryall bags",
      source,
    );
    await expect(card(page)).toContainText(
      source ? "Independent sourcing agent" : "Direct supplier",
    );
    if (source) {
      await expect(card(page)).toContainText("Sourcing fee");
      await expect(card(page)).toContainText("85,000");
      await expect(card(page)).not.toContainText("Verified Sourcing Agent");
    }
    await expect(
      card(page).getByRole("button", { name: "Start work", exact: true }),
    ).toHaveCount(0);
    await action(page, "Confirm specifications");
    await stage(page, "specification pending");
    await page.reload();
    await stage(page, "specification pending");
    await as(page, f.supplier, "supply/mine");
    await action(page, "Confirm specifications");
    await stage(page, "confirmed");
    await action(page, "Start work");
    await stage(page, "in progress");
    await action(
      page,
      "Record progress",
      "Production batch checked against agreed specification",
    );
    await expect(card(page)).toContainText("Production batch checked");
    await fit(page);
    if (source) {
      await card(page)
        .getByRole("button", { name: "Add evidence", exact: true })
        .click();
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64",
      );
      await panel(page)
        .getByLabel("Add work evidence", { exact: true })
        .setInputFiles({
          name: "finished.png",
          mimeType: "image/png",
          buffer: png,
        });
      await panel(page)
        .getByRole("combobox", { name: "Image visibility", exact: true })
        .selectOption("shared");
      await panel(page)
        .getByRole("textbox", { name: "Image description", exact: true })
        .fill("Shared finished goods evidence");
      await panel(page)
        .getByLabel("Add work evidence", { exact: true })
        .setInputFiles({
          name: "source.png",
          mimeType: "image/png",
          buffer: Buffer.concat([png, Buffer.from("private")]),
        });
      await panel(page)
        .getByRole("textbox", { name: "Image description", exact: true })
        .nth(1)
        .fill("PRIVATE SOURCE DETAILS");
      await panel(page)
        .getByRole("button", { name: "Confirm action", exact: true })
        .click();
      await expect(panel(page)).toHaveCount(0);
      const saved = await page.request.get(
        `/ingest/api/work-orders/${f.work.id}`,
        { headers: headers(f.supplier) },
      );
      const savedWork = (await saved.json()).workOrder;
      expect(savedWork.privateSource.reference).toBe(
        "PRIVATE WORK SOURCE NETWORK",
      );
      f.sharedImage = savedWork.evidence.find(
        (e) => e.visibility === "shared",
      ).uploadId;
      f.privateImage = savedWork.evidence.find(
        (e) => e.visibility === "private",
      ).uploadId;
    }
    await action(page, "Mark ready");
    await stage(page, "ready");
    await action(page, "Record dispatch");
    await stage(page, "dispatched");
    await action(page, "Record delivery");
    await stage(page, "delivered");
    await expect(
      card(page).getByRole("button", {
        name: "Confirm completion",
        exact: true,
      }),
    ).toHaveCount(0);
    await as(page, f.buyer, `requests/${f.requestId}`);
    await stage(page, "delivered");
    if (source) {
      await expect(card(page)).toContainText("Shared finished goods evidence");
      await expect(card(page)).not.toContainText("PRIVATE SOURCE DETAILS");
      await expect(card(page)).not.toContainText("PRIVATE WORK SOURCE NETWORK");
      const buyerData = await page.request.get(
        `/ingest/api/work-orders/${f.work.id}`,
        { headers: headers(f.buyer) },
      );
      expect(await buyerData.text()).not.toContain(
        "PRIVATE WORK SOURCE NETWORK",
      );
      expect(
        (
          await page.request.get(`/ingest/api/media/file/${f.privateImage}`, {
            headers: headers(f.buyer),
          })
        ).status(),
      ).toBe(404);
      expect(
        (
          await page.request.get(`/ingest/api/media/file/${f.sharedImage}`, {
            headers: headers(f.buyer),
          })
        ).status(),
      ).toBe(200);
      await card(page)
        .getByRole("button", {
          name: "Open Work evidence production progress (private)",
          exact: true,
        })
        .click();
      await expect(card(page).getByRole("dialog")).toBeVisible();
      await card(page)
        .getByRole("button", { name: "Close image", exact: true })
        .click();
    }
    await action(page, "Confirm completion");
    await stage(page, "completed");
    await expect(page.locator(".request-status")).toHaveText("completed");
    await expect(card(page)).toContainText(
      "No payment confirmation is recorded",
    );
    await page.reload();
    await stage(page, "completed");
    await expect(card(page)).toContainText("work order completed");
    await fit(page);
    await card(page).screenshot({
      path: `.cache/work-${source ? "source" : "direct"}-${info.project.name}.png`,
    });
    await as(page, f.supplier, "supply/mine");
    await stage(page, "completed");
    await expect(
      card(page).getByRole("button", { name: "Mark ready", exact: true }),
    ).toHaveCount(0);
    const stranger = await user(page, "work_stranger");
    const denied = await page.request.get(
      `/ingest/api/work-orders/${f.work.id}`,
      { headers: headers(stranger) },
    );
    expect(denied.status()).toBe(404);
    if (source)
      for (const id of [f.sharedImage, f.privateImage])
        expect(
          (
            await page.request.get(`/ingest/api/media/file/${id}`, {
              headers: headers(stranger),
            })
          ).status(),
        ).toBe(404);
    await as(page, stranger, `requests/${f.requestId}`);
    await expect(card(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

test("expired session and lost start response recover without duplicate milestones", async ({
  page,
}, info) => {
  const f = await setup(page, info, "pressed bamboo cases");
  await action(page, "Confirm specifications");
  await as(page, f.supplier, "supply/mine");
  await action(page, "Confirm specifications");
  await page.request.post("/ingest/api/auth/logout", {
    headers: headers(f.supplier),
  });
  await card(page)
    .getByRole("button", { name: "Start work", exact: true })
    .click();
  await panel(page)
    .getByRole("textbox", { name: "Note (optional)", exact: true })
    .fill("Starting the agreed batch");
  await panel(page)
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(
    panel(page).getByRole("heading", {
      name: "Sign in to manage this Work Order",
    }),
  ).toBeVisible();
  await panel(page)
    .getByLabel("Handle", { exact: true })
    .fill(f.supplier.handle);
  await panel(page).getByLabel("Password", { exact: true }).fill(password);
  await panel(page)
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    panel(page).getByRole("textbox", { name: "Note (optional)", exact: true }),
  ).toHaveValue("Starting the agreed batch");
  let lose = true;
  await page.route("**/api/work-orders/*/actions", async (route) => {
    if (lose && route.request().postDataJSON().action === "start") {
      lose = false;
      await route.fetch();
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await panel(page)
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(panel(page).getByRole("alert")).toContainText(
    "Could not confirm",
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("brief.offlineQueue.v1") || "[]"),
    ),
  ).toEqual([]);
  await panel(page)
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
  await stage(page, "in progress");
  await page.reload();
  await stage(page, "in progress");
  const res = await page.request.get(`/ingest/api/work-orders/${f.work.id}`, {
    headers: headers(f.buyer),
  });
  expect(
    (await res.json()).workOrder.history.filter(
      (e) => e.action === "work_started",
    ),
  ).toHaveLength(1);
  await fit(page);
});

test("two tabs reject a stale operational action without losing the note", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, info, "reusable felt pouches");
  await action(page, "Confirm specifications");
  await as(page, f.supplier, "supply/mine");
  await action(page, "Confirm specifications");
  await card(page)
    .getByRole("button", { name: "Start work", exact: true })
    .click();
  await panel(page)
    .getByRole("textbox", { name: "Note (optional)", exact: true })
    .fill("Keep my stale tab note");
  const tab = await context.newPage();
  await tab.goto("/#supply/mine");
  await action(tab, "Start work");
  await stage(tab, "in progress");
  await panel(page)
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(panel(page).getByRole("alert")).toContainText("changed");
  await expect(
    panel(page).getByRole("textbox", { name: "Note (optional)", exact: true }),
  ).toHaveValue("Keep my stale tab note");
  page.once("dialog", (d) => d.accept());
  await panel(page)
    .getByRole("button", { name: "Reload current Work Order", exact: true })
    .click();
  await stage(page, "in progress");
  await expect(panel(page)).toHaveCount(0);
  await tab.close();
  await fit(page);
});

test("controlled amendment, counterpart acceptance and mutual issue resolution preserve history", async ({
  page,
}, info) => {
  const f = await setup(page, info, "embroidered cotton sleeves");
  await card(page)
    .locator("summary")
    .filter({ hasText: "Changes, cancellation & issues" })
    .click();
  await card(page)
    .getByRole("button", { name: "Propose amendment", exact: true })
    .click();
  await panel(page)
    .getByRole("combobox", { name: "Changed field", exact: true })
    .selectOption("quotedQuantity");
  await panel(page)
    .getByRole("textbox", { name: "Proposed value", exact: true })
    .fill("5500");
  await panel(page)
    .getByRole("button", { name: "Add another change", exact: true })
    .click();
  await panel(page)
    .getByRole("combobox", { name: "Changed field", exact: true })
    .nth(1)
    .selectOption("unitPriceMinor");
  await panel(page)
    .getByRole("textbox", { name: "Proposed value", exact: true })
    .nth(1)
    .fill("17");
  await panel(page)
    .getByRole("textbox", { name: "Reason for amendment", exact: true })
    .fill("Additional units at an agreed revised unit price");
  await panel(page)
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
  await expect(card(page)).toContainText("pending · amendment");
  await expect(
    card(page).getByRole("button", { name: "Accept amendment", exact: true }),
  ).toHaveCount(0);
  await as(page, f.supplier, "supply/mine");
  await expect(card(page)).toContainText("95,500");
  await action(page, "Accept amendment");
  await stage(page, "confirmed");
  await expect(card(page)).toContainText("Agreement version 2");
  await action(page, "Start work");
  await card(page)
    .locator("summary")
    .filter({ hasText: "Changes, cancellation & issues" })
    .click();
  await expect(
    card(page).getByRole("button", { name: "Cancel Work Order", exact: true }),
  ).toHaveCount(0);
  await action(page, "Record an issue", "Confirm the embroidery colour");
  await stage(page, "disputed");
  await expect(
    card(page).getByRole("button", { name: "Mark ready", exact: true }),
  ).toHaveCount(0);
  await action(page, "Confirm issue resolved", "Colour proof is ready");
  await stage(page, "disputed");
  await as(page, f.buyer, `requests/${f.requestId}`);
  await action(page, "Confirm issue resolved", "Colour proof approved");
  await stage(page, "in progress");
  await expect(card(page)).toContainText("work resumed");
  await card(page)
    .locator("summary")
    .filter({ hasText: "Original accepted agreement & version history" })
    .click();
  await expect(card(page)).toContainText("92,000");
  await expect(card(page)).toContainText("95,500");
  await page.reload();
  await stage(page, "in progress");
  await fit(page);
});

test("stale amendment decision cannot approve a rejected version in another tab", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, info, "screen printed cloth envelopes");
  await card(page)
    .locator("summary")
    .filter({ hasText: "Changes, cancellation & issues" })
    .click();
  await card(page)
    .getByRole("button", { name: "Propose amendment", exact: true })
    .click();
  await panel(page)
    .getByRole("textbox", { name: "Proposed value", exact: true })
    .fill("Collection bay C");
  await panel(page)
    .getByRole("textbox", { name: "Reason for amendment", exact: true })
    .fill("Agree collection instructions");
  await panel(page)
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
  await as(page, f.supplier, "supply/mine");
  await card(page)
    .getByRole("button", { name: "Accept amendment", exact: true })
    .click();
  await panel(page)
    .getByRole("textbox", { name: "Note (optional)", exact: true })
    .fill("My stale amendment decision");
  const tab = await context.newPage();
  await tab.goto("/#supply/mine");
  await action(tab, "Reject amendment");
  await panel(page)
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(panel(page).getByRole("alert")).toContainText("changed");
  await expect(
    panel(page).getByRole("textbox", { name: "Note (optional)", exact: true }),
  ).toHaveValue("My stale amendment decision");
  page.once("dialog", (d) => d.accept());
  await panel(page)
    .getByRole("button", { name: "Reload current Work Order", exact: true })
    .click();
  await expect(card(page)).toContainText("rejected · amendment");
  await expect(card(page)).toContainText("Agreement version 1");
  await expect(
    card(page).getByRole("button", { name: "Accept amendment", exact: true }),
  ).toHaveCount(0);
  const saved = await page.request.get(`/ingest/api/work-orders/${f.work.id}`, {
    headers: headers(f.buyer),
  });
  expect((await saved.json()).workOrder.agreements).toHaveLength(1);
  await tab.close();
  await fit(page);
});
