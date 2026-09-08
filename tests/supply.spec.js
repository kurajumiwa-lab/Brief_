import { test, expect } from "@playwright/test";
const pass = "test-supply-password";
async function account(page) {
  const handle = `supplier_${Date.now().toString(36)}`;
  await page.goto("/#supply/mine");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "What can your business help someone get done?",
    }),
  ).toBeVisible();
  return handle;
}
async function onboard(page, { agent = false, hybrid = false } = {}) {
  await page
    .getByRole("button", {
      name: agent
        ? /I help businesses source things/
        : /We make, supply or deliver/,
    })
    .click();
  await page
    .getByLabel("First capability", { exact: true })
    .fill(agent ? "Can source kraft cartons" : "Custom kraft cartons");
  await page
    .getByLabel("Capability category", { exact: true })
    .fill("Packaging");
  await page
    .getByLabel("Business / display name", { exact: true })
    .fill("Browser test enterprise");
  if (hybrid)
    await page.getByLabel("How do you provide it?").selectOption("hybrid");
  await page
    .getByLabel("Physical location", { exact: true })
    .fill("Nairobi Industrial Area");
  await page
    .getByLabel("Service areas", { exact: true })
    .fill("Nairobi, Kiambu");
  await page
    .getByText("Typical capacity & turnaround", { exact: false })
    .click();
  await page.getByLabel("Typical capacity", { exact: true }).fill("15000");
  await page.getByLabel("Capacity unit", { exact: true }).fill("pieces");
  await page.getByLabel("Minimum turnaround (days)", { exact: true }).fill("3");
  await page.getByLabel("Maximum turnaround (days)", { exact: true }).fill("7");
  await page
    .getByLabel("Make my profile and active capabilities discoverable")
    .check();
  await page
    .getByRole("button", { name: "Create enterprise", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser test enterprise", exact: true }),
  ).toBeVisible();
}
async function fits(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function session(page) {
  return page.evaluate(() => localStorage.getItem("brief_session"));
}
async function own(page) {
  const token = await session(page);
  return (
    await (
      await page.request.get("/ingest/api/me/enterprise", {
        headers: { authorization: `Bearer ${token}` },
      })
    ).json()
  ).enterprise;
}

test("enterprise onboarding → durable capability edit/reload → search/filter → owner Request options", async ({
  page,
}, info) => {
  const capName = `Heavy duty kraft cartons ${info.project.name}`;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await account(page);
  await fits(page);
  await page.screenshot({path:`.cache/supply-onboarding-${info.project.name}.png`,fullPage:true});
  await onboard(page, { hybrid: true });
  await fits(page);
  await expect(page.getByText("15,000 pieces / per order")).toBeVisible();
  await page
    .getByRole("button", { name: "Edit capability", exact: true })
    .click();
  await page.getByLabel("Capability name", { exact: true }).fill(capName);
  await page.getByLabel("Typical capacity", { exact: true }).fill("22000");
  await page.getByLabel("Minimum order quantity", { exact: true }).fill("500");
  await page
    .getByRole("combobox", { name: "Capacity kind", exact: true })
    .selectOption("production");
  await page
    .getByLabel("Materials", { exact: true })
    .fill("Kraft paper, recycled board");
  await page.getByText("Timing & specifications", { exact: true }).click();
  await page
    .getByRole("button", { name: "Add specification", exact: true })
    .click();
  await page.getByLabel("Specification 1 name").fill("Flute");
  await page.getByLabel("Specification 1 value").fill("B or C flute");
  await fits(page);
  await page
    .getByRole("button", { name: "Save capability", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: capName, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("22,000 pieces / per order")).toBeVisible();
  await page.screenshot({path:`.cache/supply-profile-${info.project.name}.png`,fullPage:true});
  // Create a real demand through the existing Request API, then curate a link in UI.
  const token = await session(page);
  const resp = await page.request.post("/ingest/api/requests", {
    headers: { authorization: `Bearer ${token}` },
    data: { title: "Browser demand for packaging", intent: "draft" },
  });
  expect(resp.status()).toBe(201);
  const { request } = await resp.json();
  await page.goto(`/#requests/${request.id}`);
  await page.getByText("Options you added manually", {exact:true}).click();
  await expect(
    page.getByText("No potential suppliers saved yet."),
  ).toBeVisible();
  await expect(page.getByText("No sourcing agents saved yet.")).toBeVisible();
  await page.getByRole("button", { name: "Browse capabilities" }).click();
  await page.getByLabel("What do you need to get done?").fill(capName);
  await page
    .getByRole("button", { name: "Search capabilities", exact: true })
    .click();
  await expect(page.locator(".supply-search-hit")).toHaveCount(1);
  await page.getByText("Filter capabilities", { exact: true }).click();
  await page.getByLabel("Physical location", { exact: true }).fill("Kisumu");
  await page
    .getByRole("button", { name: "Search capabilities", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No capabilities found" }),
  ).toBeVisible();
  await page.getByLabel("Physical location", { exact: true }).fill("Nairobi");
  await page
    .getByRole("button", { name: "Search capabilities", exact: true })
    .click();
  await expect(page.locator(".supply-search-hit")).toHaveCount(1);
  await fits(page);
  await page.getByRole("button", { name: "Save potential option" }).click();
  await expect(page.getByRole("status")).toContainText(
    "saved as a potential supplier",
  );
  await page.getByRole("button", { name: "Back to Request" }).click();
  await page.getByText("Options you added manually", {exact:true}).click();
  await expect(page.locator(".supply-potential-row")).toContainText(capName);
  await page.reload();
  await page.getByText("Options you added manually", {exact:true}).click();
  await expect(page.locator(".supply-potential-row")).toContainText(capName);
  await page.getByRole("button", { name: "Remove option" }).click();
  await expect(
    page.getByText("No potential suppliers saved yet."),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("dedicated sourcing path, profile edit/reload and actual private image evidence access", async ({
  page,
}) => {
  await account(page);
  await onboard(page, { agent: true });
  await expect(
    page.getByText("Sourcing agent · not verified", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit sourcing profile" }).click();
  await page
    .getByLabel("Sourcing service description")
    .fill("Independent procurement of small-order packaging.");
  await page.getByLabel("Sourcing categories").fill("Packaging, bottles");
  await page.getByLabel("Geographic coverage").fill("Nairobi, Mombasa");
  await page.getByLabel("Years of sourcing experience (stated)").fill("4");
  await page
    .getByText("Private supplier-network notes", { exact: false })
    .click();
  await page
    .getByLabel("Private network notes")
    .fill("CONFIDENTIAL supplier phone and relationship");
  await fits(page);
  await page.getByRole("button", { name: "Save sourcing profile" }).click();
  await expect(
    page.getByText("Independent procurement of small-order packaging.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edit sourcing profile" }).click();
  await expect(page.getByLabel("Sourcing service description")).toHaveValue(
    "Independent procurement of small-order packaging.",
  );
  await page
    .getByLabel("Sourcing service description")
    .fill("Updated independent procurement service.");
  await page.getByRole("button", { name: "Save sourcing profile" }).click();
  await expect(
    page.getByText("Updated independent procurement service.", { exact: true }),
  ).toBeVisible();
  const p = await own(page);
  const publicResponse = await page.request.get(
    `/ingest/api/public/enterprises/${p.id}`,
  );
  expect(await publicResponse.text()).not.toContain("CONFIDENTIAL");
  await page
    .getByRole("button", { name: "Verification & private evidence" })
    .click();
  await expect(
    page.getByText(
      "No evidence submitted. Your enterprise remains unverified.",
    ),
  ).toBeVisible();
  await page.getByLabel("Verification scope").selectOption("sourcing_role");
  await page.getByLabel("Evidence type").selectOption("supplier_relationship");
  await page
    .getByLabel("Attach private evidence image")
    .setInputFiles({
      name: "test-proof.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(page.getByText(/Private image ready/)).toBeVisible();
  await page
    .getByLabel("Private note to the reviewer")
    .fill("PRIVATE confidential reference");
  await page.getByRole("button", { name: "Submit for manual review" }).click();
  await expect(
    page.locator(".supply-record").getByText("submitted", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".supply-record")
    .getByRole("button", { name: "Open private evidence" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Private verification evidence" }),
  ).toBeVisible();
  await fits(page);
  const token = await session(page);
  const records = await (
    await page.request.get(`/ingest/api/enterprises/${p.id}/verification`, {
      headers: { authorization: `Bearer ${token}` },
    })
  ).json();
  const image = records.records[0].evidence[0].uploadId;
  expect(
    (await page.request.get(`/ingest/api/media/file/${image}`)).status(),
  ).toBe(404);
  await page.getByRole("button", { name: "Close evidence" }).click();
  await page.getByRole("button", { name: "Back to enterprise" }).click();
  await expect(
    page.getByText("Sourcing agent · not verified", { exact: true }),
  ).toBeVisible();
});

test("failed capability save retries once without phantom records or offline replay", async ({
  page,
}) => {
  await account(page);
  await onboard(page);
  await page
    .getByRole("button", { name: "Add capability", exact: true })
    .click();
  await page
    .getByLabel("Capability name", { exact: true })
    .fill("Lost response capability");
  await page.getByLabel("Category", { exact: true }).fill("Packaging");
  let lost = true;
  await page.route("**/api/enterprises/*/capabilities", async (route) => {
    if (route.request().method() === "POST" && lost) {
      lost = false;
      await route.fetch();
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Add capability", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Could not confirm");
  await expect(page.getByLabel("Capability name", { exact: true })).toHaveValue(
    "Lost response capability",
  );
  await page
    .getByRole("button", { name: "Add capability", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Lost response capability",
      exact: true,
    }),
  ).toBeVisible();
  const p = await own(page);
  expect(
    p.capabilities.filter((c) => c.name === "Lost response capability"),
  ).toHaveLength(1);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brief.offlineQueue.v1") || "[]")
          .length,
    ),
  ).toBe(0);
});

test("stale enterprise revisions cannot overwrite newer server details and can recover", async ({
  page,
}) => {
  await account(page);
  await onboard(page);
  const p = await own(page);
  await page
    .getByRole("button", { name: "Edit enterprise", exact: true })
    .click();
  await page.getByLabel("Business / display name").fill("Stale browser name");
  const token = await session(page);
  const response = await page.request.patch(`/ingest/api/enterprises/${p.id}`, {
    headers: { authorization: `Bearer ${token}` },
    data: { revision: p.revision, displayName: "Newer saved identity" },
  });
  expect(response.status()).toBe(200);
  await page
    .getByRole("button", { name: "Save enterprise", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("record changed");
  await expect(page.getByLabel("Business / display name")).toHaveValue(
    "Stale browser name",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reload saved profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Newer saved identity", exact: true }),
  ).toBeVisible();
});

test("expired session preserves enterprise edit and signs into the same Brief account", async ({
  page,
}) => {
  const handle = await account(page);
  await onboard(page);
  await page
    .getByRole("button", { name: "Edit enterprise", exact: true })
    .click();
  await page.getByLabel("Business / display name").fill("Recovered enterprise");
  const token = await session(page);
  await page.request.post("/ingest/api/auth/logout", {
    headers: { authorization: `Bearer ${token}` },
  });
  await page
    .getByRole("button", { name: "Save enterprise", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to save your enterprise" }),
  ).toBeVisible();
  await expect(page.getByLabel("Business / display name")).toHaveValue(
    "Recovered enterprise",
  );
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Save enterprise", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Recovered enterprise", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Recovered enterprise", exact: true }),
  ).toBeVisible();
});

test("archive and private publication disappear from public search with honest unavailable profiles", async ({
  page,
}) => {
  await account(page);
  await onboard(page);
  const p = await own(page);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Archive capability", exact: true })
    .click();
  await expect(page.locator(".supply-archived")).toBeVisible();
  await page
    .getByRole("button", { name: "Edit enterprise", exact: true })
    .click();
  await page
    .getByLabel("Make my profile and active capabilities discoverable")
    .uncheck();
  await page
    .getByRole("button", { name: "Save enterprise", exact: true })
    .click();
  await expect(
    page.getByText("Private profile", { exact: true }),
  ).toBeVisible();
  await page.goto(`/#supply/profile/${p.id}`);
  await expect(
    page.getByRole("heading", { name: "Enterprise unavailable" }),
  ).toBeVisible();
  await fits(page);
});

test("reviewer opens actual private bytes and records a scope-only manual decision", async ({
  page,
}, info) => {
  await account(page);
  await onboard(page, { agent: true });
  const p = await own(page);
  const ownerToken = await session(page);
  await page
    .getByRole("button", { name: "Verification & private evidence" })
    .click();
  await page
    .getByLabel("Attach private evidence image")
    .setInputFiles({
      name: "review-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(page.getByText(/Private image ready/)).toBeVisible();
  await page.getByRole("button", { name: "Submit for manual review" }).click();
  await expect(
    page.locator(".supply-record").getByText("submitted", { exact: true }),
  ).toBeVisible();
  const reg = await page.request.post("/ingest/api/auth/register", {
    data: { handle: `supply_review_${info.project.name}`, password: pass },
  });
  expect(reg.status()).toBe(201);
  const reviewer = await reg.json();
  await page.evaluate(
    (token) => localStorage.setItem("brief_session", token),
    reviewer.token,
  );
  await page.goto("/#supply/review");
  await page.reload(); // Restore the reviewer session through the existing token loader.
  const card = page.locator("section.request-panel").filter({ hasText: p.id });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Open private evidence" }).click();
  await expect(card.getByRole("dialog")).toBeVisible();
  await card.getByRole("button", { name: "Close evidence" }).click();
  await card.getByRole("button", { name: "Begin review" }).click();
  await expect(
    card.getByRole("button", { name: "Record scoped decision" }),
  ).toBeVisible();
  await card
    .getByLabel("Review reason")
    .fill(
      "Test-only manual review of identity evidence. No role or capacity approval.",
    );
  await card.getByRole("checkbox").check();
  await fits(page);
  await card.getByRole("button", { name: "Record scoped decision" }).click();
  await expect(card).toHaveCount(0);
  const reviewed = await (
    await page.request.get(`/ingest/api/enterprises/${p.id}/verification`, {
      headers: { authorization: `Bearer ${ownerToken}` },
    })
  ).json();
  expect(reviewed.records[0].status).toBe("verified");
  expect(reviewed.records[0].history).toHaveLength(3);
  await page.goto(`/#supply/profile/${p.id}`);
  await expect(
    page.getByText("Sourcing agent · not verified", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Business-declared", { exact: true }),
  ).toBeVisible();
});

test("supply load error retries and explicit discard preserves the last saved profile", async ({
  page,
}) => {
  await account(page);
  await onboard(page);
  await page
    .getByRole("button", { name: "Edit enterprise", exact: true })
    .click();
  await page.getByLabel("Business / display name").fill("Discarded change");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test enterprise", exact: true }),
  ).toBeVisible();
  let fail = true;
  await page.route("**/api/capabilities/search*", async (route) => {
    if (fail) {
      fail = false;
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Explore capabilities", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Retry search" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".supply-search-hit").first()).toBeVisible();
});
