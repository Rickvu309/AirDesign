import { expectAccepts, expectRejects } from "../harness.js"

const counted = {
  today: "2026-11-20",
  kept: { "tests/browser/kept.spec.ts": 1 },
}
const rule = { "airdesign/no-blind-wait": ["error", counted] }
const later = { "airdesign/no-blind-wait": ["error", { ...counted, today: "2027-03-01" }] }
const spec = "tests/browser/save-status.spec.ts"
const kept = "tests/browser/kept.spec.ts"
const keptSleep = (until, approval = "keptWaitApproval") =>
  `import { keptWait, keptWaitApproval } from "./kept-wait"\nexport async function wait(page) {\n  await page.waitForTimeout(keptWait(400, { why: "the quiet span is what is measured", until: "${until}", approval: ${approval} }))\n}\n`

expectRejects(
  "0ce155cb9 waited a second for Saving on a reopened deck",
  spec,
  `export async function reopened(page, saveStatus, saving) {\n  await page.reload()\n  await expect(saveStatus(page)).toHaveText(saving)\n  await page.waitForTimeout(1000)\n  await expect(saveStatus(page)).toHaveText(saving)\n}\n`,
  rule,
  "Remove waitForTimeout. A fixed wait races the app",
)
expectRejects(
  "bc6e4d4c7 waited 2.5 seconds to see nothing more sent",
  spec,
  `export async function refused(page, sent) {\n  const refused = sent\n  await page.waitForTimeout(2500)\n  expect(sent).toBe(refused)\n}\n`,
  rule,
  "move time with page.clock",
)
expectRejects(
  "817594c79 delayed the index in a Promise",
  "tests/browser/aira-history.spec.ts",
  `export async function late(page, indexDelay) {\n  await page.route("**/decks/index", async (route) => {\n    await new Promise((resolve) => setTimeout(resolve, indexDelay))\n    await route.fallback()\n  })\n}\n`,
  rule,
  "Remove this timer in a Promise",
)
expectRejects(
  "a copied settled helper fails",
  "tests/browser/element-edits.spec.ts",
  `async function settled(page) {\n  await page.waitForFunction(() => document.querySelector(".thin-page")?.getAttribute("data-deck-ready") !== null)\n}\nexport const open = settled\n`,
  rule,
  "Do not define a settled helper. Open and wait for a deck with the decks fixture",
)
expectRejects(
  "a raw readiness read fails",
  "tests/browser/blank-deck.spec.ts",
  `export async function ready(page, id) {\n  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", id)\n}\n`,
  rule,
  "Read the deck's readiness only through tests/browser/deck-test.ts",
)
expectRejects(
  "a readiness selector in a template fails",
  "tests/browser/grid-reorder.spec.ts",
  "export const shown = (id) => `.thin-page[data-deck-ready=${id}]`\n",
  rule,
  "Read the deck's readiness only through",
)
expectRejects(
  "a per-test timeout fails",
  "tests/browser/grid-select.spec.ts",
  `test("selects", async ({ page }) => {\n  test.setTimeout(120_000)\n  await page.goto("/")\n})\n`,
  rule,
  "Remove this per-test timeout",
)
expectRejects(
  "a stack test timeout fails",
  "tests/browser/grid-select.spec.ts",
  `stackTest("selects", async ({ page }, testInfo) => {\n  testInfo.setTimeout(60_000)\n  await page.goto("/")\n})\n`,
  rule,
  "Remove this per-test timeout",
)
expectRejects("test.slow fails", spec, `test("slow", async () => {\n  test.slow()\n})\n`, rule, "Remove test.slow()")
expectRejects(
  "retries fail",
  spec,
  `test.describe.configure({ mode: "parallel", retries: 2 })\n`,
  rule,
  "Tests never retry",
)
expectRejects(
  "a timeout in configure fails",
  spec,
  `test.describe.configure({ timeout: 90_000 })\n`,
  rule,
  "Remove this per-test timeout",
)
expectRejects(
  "a kept wait past its date fails",
  kept,
  keptSleep("2027-02-18"),
  later,
  "This kept wait ended on 2027-02-18",
)
expectRejects(
  "a kept wait set too far ahead fails",
  kept,
  keptSleep("2027-06-01"),
  rule,
  "A kept wait lasts at most 92 days",
)
expectRejects(
  "a kept wait with no approval fails",
  kept,
  keptSleep("2027-02-18", `"done"`),
  rule,
  "because a person approves it",
)
expectRejects(
  "a kept wait in a file with no count fails",
  spec,
  keptSleep("2027-02-18"),
  rule,
  "tests/browser/save-status.spec.ts may keep 0 waits",
)
expectRejects(
  "a second kept wait over the count fails",
  kept,
  `${keptSleep("2027-02-18")}export async function again(page) {\n  await page.waitForTimeout(keptWait(400, { why: "again", until: "2027-02-18", approval: keptWaitApproval }))\n}\n`,
  rule,
  "tests/browser/kept.spec.ts may keep 1 waits",
)
expectAccepts("a counted kept wait in its dates passes", kept, keptSleep("2027-02-18"), rule)
expectAccepts(
  "a deck wait and web-first assertions pass",
  spec,
  `test("saved", async ({ page, decks }) => {\n  await decks.open()\n  const held = page.waitForRequest("**/decks/commit")\n  await page.reload()\n  await held\n  await expect(page.getByText("Saving")).toBeVisible()\n  await page.clock.runFor(10_000)\n})\n`,
  rule,
)
expectAccepts(
  "the fixture reads the mark",
  "tests/browser/deck-test.ts",
  `export const readyMark = "data-deck-ready"\n`,
  rule,
)
expectAccepts(
  "a page script timer outside a Promise passes",
  "tests/browser/slow-device.ts",
  `export const later = (start, delay) => window.setTimeout(start, delay)\n`,
  rule,
)
expectAccepts(
  "product code is not a browser test",
  "apps/web/src/deck-follow.ts",
  `export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))\n`,
  rule,
)
expectAccepts(
  "a helper with another name passes",
  "tests/browser/notes-resize.spec.ts",
  `async function resized(page, target) {\n  await expect.poll(() => page.evaluate(() => innerHeight)).toBeCloseTo(target, 0)\n}\nexport const done = resized\n`,
  rule,
)
