import { test, expect } from "@playwright/test";
const password = "quote-browser-password";
const headers = (u) => ({ authorization: `Bearer ${u.token}` });
async function user(page, prefix) {
  const handle = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const r = await page.request.post("/ingest/api/auth/register", {
    data: { handle, password },
  });
  expect(r.status()).toBe(201);
  return { ...(await r.json()), handle };
}
async function as(page, u, route) {
  await page.goto("/");
  await page.evaluate((t) => localStorage.setItem("brief_session", t), u.token);
  await page.reload();
  await page.goto("/#" + route);
}
async function supplier(page, name, product, source = false) {
  const u = await user(page, "quote_supply");
  const r = await page.request.post("/ingest/api/enterprises", {
    headers: headers(u),
    data: {
      displayName: name,
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
  expect(r.status()).toBe(201);
  return { ...u, enterprise: (await r.json()).enterprise };
}
async function apiDemand(page, buyer, title) {
  let r = await page.request.post("/ingest/api/requests", {
    headers: headers(buyer),
    data: {
      title,
      description: "Packaging for the next production batch",
      quantity: 5000,
      unit: "pieces",
      category: "Packaging",
      location: "Nairobi",
      requiredBy: "2099-09-12",
      visibility: "private",
      intent: "submit",
    },
  });
  expect(r.status()).toBe(201);
  let row = (await r.json()).request;
  r = await page.request.patch(`/ingest/api/requests/${row.id}/status`, {
    headers: headers(buyer),
    data: { status: "matching", revision: row.revision },
  });
  expect(r.status()).toBe(200);
  return (await r.json()).request;
}
const match = (page, name) =>
  page
    .getByTestId("match-option")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
async function invite(page, sup) {
  const c = match(page, sup.enterprise.displayName);
  await c.getByRole("button", { name: "Request a quote", exact: true }).click();
  await c.getByLabel(/Share this Request’s specification/).check();
  await c
    .getByRole("button", { name: "Send quote request", exact: true })
    .click();
  await expect(
    c.getByText("The participant now has a real quote request", {
      exact: false,
    }),
  ).toBeVisible();
}
async function editor(page, sup, title) {
  await as(page, sup, "supply/mine");
  const i = page
    .getByTestId("quote-invitation")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await i
    .getByRole("button", { name: "I can help with this Request", exact: true })
    .click();
  await i.getByRole("button", { name: "Create quote", exact: true }).click();
  const form = page.locator(".quote-editor");
  await expect(form).toBeVisible();
  await expect(form.getByLabel("Quoted quantity", { exact: true })).toHaveValue(
    "5000",
  );
  return form;
}
async function fill(form, source = false) {
  await form
    .getByLabel(source ? "Source unit cost" : "Unit price", { exact: true })
    .fill(source ? "16.40" : "18");
  await form
    .getByLabel("Production / service lead days", { exact: true })
    .fill(source ? "3" : "4");
  await form
    .getByLabel(source ? "Logistics cost" : "Delivery cost", { exact: true })
    .fill(source ? "3000" : "2000");
  if (source)
    await form
      .getByLabel("Disclosed sourcing / referral fee", { exact: true })
      .fill("4000");
  await form
    .getByLabel("Quote valid until", { exact: true })
    .fill("2099-09-10");
}
async function fits(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("real commercial loop: create, match, save, interest, direct/source comparison, accept, reload", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const title = "5,000 compostable coffee sleeves",
    buyer = await user(page, "quote_buyer"),
    direct = await supplier(
      page,
      `Coffee direct ${info.project.name}`,
      "Compostable coffee sleeves",
    ),
    source = await supplier(
      page,
      `Coffee agent ${info.project.name}`,
      "Compostable coffee sleeves",
      true,
    );
  await as(page, buyer, "requests/new");
  await page.getByLabel("What do you need?", { exact: true }).fill(title);
  await page.getByLabel("Quantity (optional)", { exact: true }).fill("5000");
  await page.getByLabel("Unit", { exact: true }).fill("pieces");
  await page.getByLabel("Location", { exact: true }).fill("Nairobi");
  await page
    .getByLabel("Required by (optional)", { exact: true })
    .fill("2099-09-12");
  await page
    .getByLabel("Short description", { exact: true })
    .fill("PRIVATE buyer internal note");
  await page
    .getByRole("button", { name: "Submit Request", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark ready for matching", exact: true })
    .click();
  const url = page.url();
  const id = url.split("/").at(-1);
  await match(page, direct.enterprise.displayName)
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await invite(page, source);
  await page.getByRole("button", { name: /^Saved \(/ }).click();
  await invite(page, direct);
  let form = await editor(page, direct, title);
  await fill(form);
  await form.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(form).toContainText("Draft saved");
  await form.getByRole("button", { name: "Submit quote", exact: true }).click();
  await expect(page.locator(".quote-editor")).toHaveCount(0);
  await expect(page.getByTestId("quote-card")).toContainText("submitted");
  form = await editor(page, source, title);
  await fill(form, true);
  await form
    .locator("summary")
    .filter({ hasText: "Private source provenance" })
    .click();
  await form
    .getByLabel("Private source reference", { exact: true })
    .fill("PRIVATE EXTERNAL FACTORY");
  await form.getByRole("button", { name: "Submit quote", exact: true }).click();
  await expect(page.locator(".quote-editor")).toHaveCount(0);
  await as(page, buyer, `requests/${id}`);
  const ws = page.getByRole("region", { name: "Request quotes", exact: true });
  await expect(ws.getByTestId("quote-card")).toHaveCount(2);
  const agent = ws.getByTestId("quote-card").filter({
    has: page.getByRole("heading", {
      name: source.enterprise.displayName,
      exact: true,
    }),
  });
  await expect(agent).toContainText("Independent sourcing agent");
  await expect(agent).toContainText("89,000");
  await expect(agent).not.toContainText("PRIVATE EXTERNAL FACTORY");
  await expect(agent).not.toContainText("Verified Sourcing Agent");
  await expect(agent).toContainText("Sourcing fee");
  await fits(page);
  await agent
    .getByRole("button", { name: "Review quote", exact: true })
    .click();
  await expect(agent).toContainText("viewed");
  await agent.screenshot({
    path: `.cache/quote-agent-${info.project.name}.png`,
  });
  await page.screenshot({
    path: `.cache/quotes-${info.project.name}.png`,
    fullPage: true,
  });
  await agent
    .getByRole("button", { name: "Accept quote", exact: true })
    .click();
  await agent
    .getByRole("button", { name: "Confirm acceptance", exact: true })
    .click();
  await expect(page.locator(".request-status")).toHaveText("ready for work");
  await expect(ws).toContainText("not a paid order");
  await page.reload();
  await expect(
    ws
      .getByTestId("quote-card")
      .filter({ hasText: source.enterprise.displayName }),
  ).toContainText("Accepted version 1");
  await expect(
    ws
      .getByTestId("quote-card")
      .filter({ hasText: direct.enterprise.displayName }),
  ).toContainText("declined");
  await fits(page);
  await as(page, source, "supply/mine");
  await expect(page.getByTestId("quote-card")).toContainText(
    "Accepted version 1",
  );
  await expect(
    page.getByRole("button", { name: "Withdraw quote", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("quote-card")).toContainText(
    "No money has moved",
  );
  expect(errors).toEqual([]);
});

test("participant expired session, failed save and lost submission retry preserve one proposal", async ({
  page,
}, info) => {
  const product = "Moulded tamarind trays",
    title = "5,000 moulded tamarind trays",
    buyer = await user(page, "retry_buyer"),
    sup = await supplier(page, `Trays ${info.project.name}`, product);
  const req = await apiDemand(page, buyer, title);
  await as(page, buyer, `requests/${req.id}`);
  await invite(page, sup);
  const form = await editor(page, sup, title);
  await fill(form);
  await page.request.post("/ingest/api/auth/logout", { headers: headers(sup) });
  await form.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    form.getByRole("heading", { name: "Sign in to save your quote" }),
  ).toBeVisible();
  await expect(form.getByLabel("Unit price", { exact: true })).toHaveValue(
    "18",
  );
  await form.getByLabel("Handle", { exact: true }).fill(sup.handle);
  await form.getByLabel("Password", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await form.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(form).toContainText("Draft saved");
  let fail = true;
  await page.route("**/api/request-quotes/*/actions", async (route) => {
    if (fail && route.request().postDataJSON().action === "save") {
      fail = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Test storage interruption" }),
      });
    } else await route.continue();
  });
  await form.getByLabel("Unit price", { exact: true }).fill("17");
  await form.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(form).toContainText("Test storage interruption");
  await expect(form.getByLabel("Unit price", { exact: true })).toHaveValue(
    "17",
  );
  await form.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(form).toContainText("Draft saved");
  await page.unroute("**/api/request-quotes/*/actions");
  let lose = true;
  await page.route("**/api/request-quotes/*/actions", async (route) => {
    if (lose && route.request().postDataJSON().action === "submit") {
      lose = false;
      await route.fetch();
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await form.getByRole("button", { name: "Submit quote", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText('Could not confirm');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('brief.offlineQueue.v1')||'[]'))).toEqual([]);
  await form.getByRole("button", { name: "Submit quote", exact: true }).click();
  await expect(page.locator(".quote-editor")).toHaveCount(0);
  await page.reload();
  const c = page.getByTestId("quote-card");
  await expect(c).toContainText("Quote v1");
  await expect(c).not.toContainText("Quote v2");
  await fits(page);
});

test("two tabs reject stale commercial edits and preserve visible versions", async ({
  page,
  context,
}, info) => {
  const product = "Hexagonal honeycomb cartons",
    title = "5,000 hexagonal honeycomb cartons",
    buyer = await user(page, "tabs_buyer"),
    sup = await supplier(page, `Honeycomb ${info.project.name}`, product);
  const req = await apiDemand(page, buyer, title);
  await as(page, buyer, `requests/${req.id}`);
  await invite(page, sup);
  const form = await editor(page, sup, title);
  await fill(form);
  await form.getByRole("button", { name: "Submit quote", exact: true }).click();
  await expect(page.locator(".quote-editor")).toHaveCount(0);
  await page.getByRole("button", { name: "Revise quote", exact: true }).click();
  await form.getByLabel("Unit price", { exact: true }).fill("16");
  const tab = await context.newPage();
  await tab.goto("/#supply/mine");
  await tab.getByRole("button", { name: "Revise quote", exact: true }).click();
  const second = tab.locator(".quote-editor");
  await second.getByLabel("Unit price", { exact: true }).fill("15");
  await second
    .getByRole("button", { name: "Submit revised quote", exact: true })
    .click();
  await expect(tab.locator(".quote-editor")).toHaveCount(0);
  await form
    .getByRole("button", { name: "Submit revised quote", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(/changed/);
  await expect(form.getByLabel("Unit price", { exact: true })).toHaveValue(
    "16",
  );
  page.once("dialog", (d) => d.accept());
  await form
    .getByRole("button", { name: "Reload current quote", exact: true })
    .click();
  await expect(form.getByLabel("Unit price", { exact: true })).toHaveValue(
    "15.00",
  );
  await form.getByLabel("Unit price", { exact: true }).fill("14");
  await form
    .getByRole("button", { name: "Submit revised quote", exact: true })
    .click();
  await expect(page.locator(".quote-editor")).toHaveCount(0);
  await expect(page.getByTestId("quote-card")).toContainText("Quote v3");
  await page
    .locator("summary")
    .filter({ hasText: "Previous commercial versions" })
    .click();
  await expect(page.getByTestId("quote-card")).toContainText(
    "Quote v1 — superseded",
  );
  await expect(page.getByTestId("quote-card")).toContainText(
    "Quote v2 — superseded",
  );
  await fits(page);
  await tab.close();
});

test("evidence sharing, pinned decision and changed requirements require an explicit new proposal", async ({
  page,
}, info) => {
  const title = "5,000 embossed tea canisters",
    buyer = await user(page, "change_buyer"),
    sup = await supplier(
      page,
      `Tea canisters ${info.project.name}`,
      "Embossed tea canisters",
    );
  const req = await apiDemand(page, buyer, title);
  await as(page, buyer, `requests/${req.id}`);
  await invite(page, sup);
  let form = await editor(page, sup, title);
  await fill(form);
  await form.locator("summary").filter({ hasText: "Evidence images" }).click();
  await form.getByLabel("Add quote evidence", { exact: true }).setInputFiles({
    name: "quote-spec.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await form
    .getByLabel("Share with requester when submitted", { exact: true })
    .check();
  await form.getByRole("button", { name: "Submit quote", exact: true }).click();
  await expect(page.locator(".quote-editor")).toHaveCount(0);
  await as(page, buyer, `requests/${req.id}`);
  let card = page.getByTestId("quote-card");
  await card
    .locator("summary")
    .filter({ hasText: "Evidence uploaded by participant" })
    .click();
  await card
    .getByRole("button", {
      name: "Open Quote evidence 1 (private)",
      exact: true,
    })
    .click();
  await expect(card.getByRole("dialog")).toBeVisible();
  await card.getByRole("button", { name: "Close image", exact: true }).click();
  await card.getByRole("button", { name: "Accept quote", exact: true }).click();
  const w = await page.request.get("/ingest/api/supply/quotes", {
    headers: headers(sup),
  });
  const quote = (await w.json()).quotes[0];
  const { subtotalMinor, totalMinor, relationshipType, ...terms } =
    quote.offers[0].terms;
  terms.evidence = terms.evidence.map(
    ({ uploadId, kind, shareWithRequester }) => ({
      uploadId,
      kind,
      shareWithRequester,
    }),
  );
  terms.unitPriceMinor = 1700;
  const revised = await page.request.post(
    `/ingest/api/request-quotes/${quote.id}/actions`,
    {
      headers: headers(sup),
      data: {
        action: "submit",
        revision: quote.revision,
        requestRevision: quote.requirementsRevision,
        idempotencyKey: "changed-confirmation-" + Date.now(),
        terms,
      },
    },
  );
  expect(revised.status()).toBe(200);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(card.getByRole("alert")).toContainText(
    "commercial record changed",
  );
  await expect(
    card.getByRole("button", { name: "Confirm acceptance", exact: true }),
  ).toBeDisabled();
  await card.getByRole("button", { name: "Not now", exact: true }).click();
  await page.getByRole("button", { name: "Edit Request", exact: true }).click();
  await page.getByLabel("Quantity (optional)", { exact: true }).fill("6000");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(card).toContainText("Requirements changed");
  await expect(
    card.getByRole("button", { name: "Accept quote", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Refresh matches", exact: true })
    .click();
  await invite(page, sup);
  await as(page, sup, "supply/mine");
  const invitation = page.getByTestId("quote-invitation");
  await invitation
    .getByRole("button", { name: "I can help with this Request", exact: true })
    .click();
  await invitation
    .getByRole("button", { name: "Open my quote", exact: true })
    .click();
  form = page.locator(".quote-editor");
  await form.getByLabel("Quoted quantity", { exact: true }).fill("6000");
  await form
    .getByRole("button", { name: "Submit revised quote", exact: true })
    .click();
  await expect(page.locator(".quote-editor")).toHaveCount(0);
  await as(page, buyer, `requests/${req.id}`);
  card = page.getByTestId("quote-card");
  await expect(card).toContainText("Quote v3");
  await expect(card).toContainText("6,000 pieces");
  await card.getByRole("button", { name: "Accept quote", exact: true }).click();
  await card
    .getByRole("button", { name: "Confirm acceptance", exact: true })
    .click();
  await expect(card).toContainText("Accepted version 3");
  await fits(page);
});
