// ---------------------------------------------------------------------------
// TEST HARNESS — sequential, awaited, and honest about its exit code.
//
// WHY THIS EXISTS
//   Sixteen files in the `npm test` chain each carried their own private copy
//   of the same three lines:
//
//       let count = 0;
//       const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
//       ...
//       console.log(`\nPASS ${count}`);
//       process.exit(0);
//
//   `fn()` was called and its return value thrown away. A test written as
//
//       test("API: /api/me/position is wired and auth-gated", async () => { ... })
//
//   therefore printed PASS immediately, ran its body only as far as the first
//   `await`, and had every remaining assertion killed by `process.exit(0)` at
//   the bottom of the file. Those assertions could not fail. The file still
//   printed its count and exited 0 — and because `npm test` is an `&&` chain,
//   the whole suite reported green.
//
//   A test that cannot fail is worse than no test. It is a claim that has never
//   been checked, wearing the clothes of one that has. Every HTTP test in those
//   sixteen files was in that state: the routes were asserted by nothing.
//
// WHAT THIS DOES
//   `test(name, fn)` REGISTERS. It does not run anything.
//   `run()` executes the registered entries in order, awaiting each one, prints
//   the same summary these files always printed, and exits 1 if anything
//   failed. Sequential rather than parallel because these tests share one
//   in-memory store and bind one port; parallel would make them order-dependent.
//   `step(name, fn)` registers ordered setup that asserts nothing, so a fixture
//   that has to land between two tests keeps its place in the sequence without
//   being counted as a passing test. A step that throws is still a failure.
//
//   The output format is deliberately unchanged (`PASS <name>`, then
//   `\nPASS <count>`) so nothing that reads these logs has to be rewritten.
//   The only additions are `FAIL` lines and a non-zero exit code — which is the
//   entire point.
// ---------------------------------------------------------------------------

const queue = [];

/** Register a test. Runs when `run()` is called, in registration order. */
export function test(name, fn) {
  queue.push({ kind: "test", name, fn });
}

/** Register ordered setup that asserts nothing. Not counted as a passing test. */
export function step(name, fn) {
  queue.push({ kind: "step", name, fn });
}

/**
 * Execute everything registered, sequentially and awaited.
 * Exits 0 only if every test and every step actually completed.
 */
export async function run() {
  let count = 0;
  let failed = 0;
  const failures = [];

  for (const entry of queue) {
    try {
      await entry.fn();
      if (entry.kind === "test") {
        count++;
        console.log("PASS " + entry.name);
      } else {
        console.log("STEP " + entry.name);
      }
    } catch (err) {
      failed++;
      failures.push({ entry, err });
      console.log("FAIL " + entry.name);
      console.log("     " + (err && err.message ? err.message : String(err)));
    }
  }

  if (failed > 0) {
    console.log(`\nFAILURES (${failed}):`);
    for (const f of failures) {
      console.log(`  · ${f.entry.name}`);
      const stack = f.err && f.err.stack ? f.err.stack.split("\n").slice(1, 4) : [];
      for (const line of stack) console.log(`    ${line.trim()}`);
    }
  }

  console.log(`\nPASS ${count}` + (failed > 0 ? `   FAILED ${failed}` : ""));
  process.exit(failed > 0 ? 1 : 0);
}
