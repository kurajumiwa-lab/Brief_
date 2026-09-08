import { test, expect } from "@playwright/test";
const pass = "match-browser-password";
async function user(page, prefix) {
  const handle = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const r = await page.request.post("/ingest/api/auth/register", {
    data: { handle, password: pass },
  });
  expect(r.status()).toBe(201);
  return { ...(await r.json()), handle };
}
async function loginAs(page, u, path) {
  await page.goto("/");
  await page.evaluate(
    (token) => localStorage.setItem("brief_session", token),
    u.token,
  );
  await page.goto("/");
  await page.reload();
  await page.goto(`/#${path}`);
}
async function supplier(page, name, role = "direct_supplier", cap = {}) {
  const u = await user(page, "match_supply");
  const res = await page.request.post("/ingest/api/enterprises", {
    headers: { authorization: `Bearer ${u.token}` },
    data: {
      displayName: name,
      businessType:
        role === "verified_sourcing_agent"
          ? "sourcing_agent"
          : role === "hybrid"
            ? "hybrid"
            : "manufacturer",
      supplyRole: role,
      location: "Nairobi Industrial Area",
      serviceAreas: ["Nairobi"],
      publication: "public",
      firstCapability: {
        name: "Printed paper takeaway bags",
        category: "Packaging",
        productsServices: ["Paper bags"],
        minimumQuantity: 500,
        maximumQuantity: 50000,
        typicalCapacity: 20000,
        unit: "pieces",
        capacityKind:
          role === "verified_sourcing_agent" ? "sourcing_access" : "production",
        supplyMode: role === "verified_sourcing_agent" ? "source" : "direct",
        leadTime: { minDays: 2, maxDays: 4 },
        serviceAreas: ["Nairobi"],
        ...cap,
      },
    },
  });
  expect(res.status()).toBe(201);
  return { ...u, enterprise: (await res.json()).enterprise };
}
async function demand(page, buyer, data = {}) {
  const res = await page.request.post("/ingest/api/requests", {
    headers: { authorization: `Bearer ${buyer.token}` },
    data: {
      title: "5,000 printed paper takeaway bags",
      description: "PRIVATE commercial description and reference contacts",
      quantity: 5000,
      unit: "pieces",
      category: "Packaging",
      location: "Nairobi",
      deliveryLocation: "Nairobi",
      requiredBy: new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
      budgetMin: 50000,
      budgetMax: 70000,
      specifications: { otherNotes: "CONFIDENTIAL internal notes" },
      visibility: "public",
      intent: "submit",
      ...data,
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).request;
}
async function start(page, buyer, r) {
  await loginAs(page, buyer, `requests/${r.id}`);
  await page
    .getByRole("button", { name: "Mark ready for matching", exact: true })
    .click();
  await expect(page.locator(".request-status")).toHaveText("matching");
  await expect(
    page.getByRole("button", { name: "Refresh matches", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Loading matches…", { exact: true })).toHaveCount(
    0,
  );
}
const card = (page, name) =>
  page
    .getByTestId("match-option")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
async function fits(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("real server matches direct/source/hybrid with explanations, save/dismiss/filter/view/reload", async ({
  page,
}, info) => {
  const suffix = info.project.name,
    buyer = await user(page, "match_buyer");
  const direct = await supplier(page, `Direct bags ${suffix}`),
    agent = await supplier(
      page,
      `Sourcing bags ${suffix}`,
      "verified_sourcing_agent",
    ),
    hybrid = await supplier(page, `Hybrid bags ${suffix}`, "hybrid");
  const r = await demand(page, buyer);
  await start(page, buyer, r);
  const d = card(page, direct.enterprise.displayName),
    a = card(page, agent.enterprise.displayName),
    h = card(page, hybrid.enterprise.displayName);
  await expect(d.getByText("Strong match", { exact: true })).toBeVisible();
  await expect(d).toContainText("Quantity fits stated capacity");
  await expect(d).toContainText("Declared service coverage");
  await expect(d).toContainText("appears compatible");
  await expect(d).not.toContainText("%");
  await expect(a.getByText("Sourcing option", { exact: true })).toBeVisible();
  await expect(a).toContainText("Independent sourcing relationship");
  await expect(a).toContainText("Sourcing agent · not verified");
  await expect(h).toContainText("Hybrid enterprise");
  await d.screenshot({ path: `.cache/match-direct-${suffix}.png` });
  await a.screenshot({ path: `.cache/match-source-${suffix}.png` });
  await fits(page);
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: /^Saved \(/ }).click();
  await expect(d).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Saved \(/ }).click();
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByRole("button", { name: /^Dismissed \(/ }).click();
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: "Restore suggestion" }).click();
  await page.getByRole("button", { name: /^Suggested \(/ }).click();
  await page.getByText("Filter potential matches", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Supply role", exact: true })
    .selectOption("source");
  await expect(d).toHaveCount(0);
  await expect(a).toBeVisible();
  await a.getByRole("button", { name: "View profile", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: agent.enterprise.displayName,
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`/#requests/${r.id}`);
  await expect(a).toBeVisible();
  await fits(page);
  await page.screenshot({
    path: `.cache/matching-${suffix}.png`,
    fullPage: true,
  });
});

test("two-sided interest exposes only an opted-in brief and persists for the requester", async ({
  page,
}, info) => {
  const buyer = await user(page, "interest_buyer"),
    sup = await supplier(page, `Interested business ${info.project.name}`);
  const r = await demand(page, buyer);
  await start(page, buyer, r);
  await loginAs(page, sup, "supply/mine");
  const brief = page
    .getByTestId("relevant-request")
    .filter({ has: page.getByRole("heading", { name: r.title, exact: true }) })
    .first();
  await expect(brief).toBeVisible();
  await expect(brief).not.toContainText("CONFIDENTIAL");
  await expect(brief).not.toContainText("PRIVATE");
  await expect(brief).not.toContainText("70000");
  await brief
    .getByRole("button", { name: "I can help with this Request" })
    .click();
  await expect(brief).toContainText("Your interest is recorded");
  await page.reload();
  await expect(brief).toContainText("Your interest is recorded");
  await fits(page);
  await loginAs(page, buyer, `requests/${r.id}`);
  await page.getByRole("button", { name: /^Interested \(/ }).click();
  const match = card(page, sup.enterprise.displayName);
  await expect(match).toContainText("indicated “I can help.”");
  await page.reload();
  await page.getByRole("button", { name: /^Interested \(/ }).click();
  await expect(match).toBeVisible();
  // Revoke sharing using the existing revisioned Request edit; supplier loses access immediately.
  await page.getByRole("button", { name: "Edit Request", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Who can see a matching brief?" })
    .selectOption("private");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".matching-workspace")).toContainText(
    "Refresh matches before relying",
  );
  await loginAs(page, sup, "supply/mine");
  await expect(
    page.getByTestId("relevant-request").filter({
      has: page.getByRole("heading", { name: r.title, exact: true }),
    }),
  ).toHaveCount(0);
});

test("Request edits expire assessments; refresh changes quantity warnings without losing saved relationship", async ({
  page,
}, info) => {
  const buyer = await user(page, "revision_buyer"),
    sup = await supplier(page, `Capacity constrained ${info.project.name}`);
  const r = await demand(page, buyer);
  await start(page, buyer, r);
  const c = card(page, sup.enterprise.displayName);
  await c.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Edit Request", exact: true }).click();
  await page.getByLabel("Quantity (optional)", { exact: true }).fill("90000");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".matching-workspace")).toContainText(
    "Refresh matches before relying",
  );
  await page.getByRole("button", { name: /^Saved \(/ }).click();
  await expect(c).toContainText("Requirements changed");
  await expect(c).not.toContainText("Strong match");
  await page
    .getByRole("button", { name: "Refresh matches", exact: true })
    .click();
  await expect(c.getByText("Potential match", { exact: true })).toBeVisible();
  await expect(c).toContainText("outside stated");
  await page.reload();
  await page.getByRole("button", { name: /^Saved \(/ }).click();
  await expect(c).toContainText("outside stated");
});

test("no relevant capability stays empty, and incomplete supply produces a potential—not fabricated strong—match", async ({
  page,
}, info) => {
  const buyer = await user(page, "empty_buyer");
  await supplier(
    page,
    `Thin capability ${info.project.name}`,
    "direct_supplier",
    {
      name: "Gyroscope alignment",
      productsServices: ["Gyroscope alignment"],
      minimumQuantity: null,
      maximumQuantity: null,
      typicalCapacity: null,
      leadTime: { minDays: null, maxDays: null },
    },
  );
  const empty = await demand(page, buyer, {
    title: "Need underwater crystalline turbine balancing",
  });
  await start(page, buyer, empty);
  await expect(
    page.getByRole("heading", {
      name: "Brief hasn't found a strong capability match yet.",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("match-option")).toHaveCount(0);
  const thin = await demand(page, buyer, { title: "Need gyroscope alignment" });
  await start(page, buyer, thin);
  const row = card(page, `Thin capability ${info.project.name}`);
  await expect(row.getByText("Potential match", { exact: true })).toBeVisible();
  await expect(row).toContainText("Capacity not stated");
  await expect(row).toContainText("Turnaround not stated");
  await fits(page);
});

test("expired requester session recovers a save and uncertain refresh retries safely", async ({
  page,
}, info) => {
  const buyer = await user(page, "recovery_buyer"),
    sup = await supplier(
      page,
      `Recovery supplier ${info.project.name}`,
      "direct_supplier",
      {
        name: "Tamper-proof retail sleeves",
        productsServices: ["Retail sleeves"],
      },
    );
  const r = await demand(page, buyer, {
    title: "5,000 tamper-proof retail sleeves",
  });
  await start(page, buyer, r);
  const c = card(page, sup.enterprise.displayName);
  await page.request.post("/ingest/api/auth/logout", {
    headers: { authorization: `Bearer ${buyer.token}` },
  });
  await c.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to manage your matches" }),
  ).toBeVisible();
  await page.getByLabel("Handle", { exact: true }).fill(buyer.handle);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await c.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: /^Saved \(/ }).click();
  await expect(c).toBeVisible();
  let lose = true;
  await page.route("**/api/requests/*/matches", async (route) => {
    if (route.request().method() === "POST" && lose) {
      lose = false;
      await route.fetch();
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Refresh matches", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Could not confirm");
  await page
    .getByRole("button", { name: "Refresh matches", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(c).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brief.offlineQueue.v1") || "[]")
          .length,
    ),
  ).toBe(0);
});

test("a delayed anonymous response cannot erase a newer authenticated session", async ({
  page,
}) => {
  const buyer = await user(page, "late_response");
  let release;
  const pending = new Promise((r) => {
    release = r;
  });
  let held = false;
  await page.route("**/api/spaces", async (route) => {
    if (!route.request().headers().authorization && !held) {
      held = true;
      await pending;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "authentication required",
          code: "no_token",
        }),
      });
    } else await route.continue();
  });
  await page.goto("/#requests");
  await page.getByLabel("Handle", { exact: true }).fill(buyer.handle);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No open requests yet." }),
  ).toBeVisible();
  const oldResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/spaces") && r.status() === 401,
  );
  release();
  await oldResponse;
  await page
    .locator(".request-empty")
    .getByRole("button", { name: "Create a Request" })
    .click();
  await page
    .getByLabel("What do you need?", { exact: true })
    .fill("Paper bags after late anonymous response");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator(".request-detail h2")).toHaveText(
    "Paper bags after late anonymous response",
  );
});

test("focus revalidates cross-tab Request changes before another matching action", async ({
  page,
}, info) => {
  const buyer = await user(page, "cross_tab_buyer"),
    sup = await supplier(page, `Cross-tab supplier ${info.project.name}`);
  const r = await demand(page, buyer, {
    title: "Cross-tab unique custom bags",
  });
  await start(page, buyer, r);
  const current = await (
    await page.request.get(`/ingest/api/requests/${r.id}`, {
      headers: { authorization: `Bearer ${buyer.token}` },
    })
  ).json();
  const updated = await page.request.patch(`/ingest/api/requests/${r.id}`, {
    headers: { authorization: `Bearer ${buyer.token}` },
    data: { revision: current.request.revision, quantity: 100000 },
  });
  expect(updated.status()).toBe(200);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Reload current Request" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh matches", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload current Request" }).click();
  await expect(page.locator(".request-detail")).toContainText("100,000 pieces");
  await page
    .getByRole("button", { name: "Refresh matches", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reload current Request" }),
  ).toHaveCount(0);
  await expect(page.locator(".matching-workspace")).not.toContainText(
    "Strong match",
  );
});
