import { expect, type Page } from "@playwright/test"
import { textCopy, textWords } from "../../apps/web/src/copy/text-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { forward, signInBrowser, test } from "./api-stack"
import { unfold } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { partsOf, shapeAt } from "./shape-fills"

const slidePart = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

function shownCase(page: Page): Promise<string> {
  return shapeAt(page, "2").evaluate((node) => {
    const run = [...node.querySelectorAll("span")].find((span) => span.textContent === "Hello")
    return run === undefined ? "" : getComputedStyle(run).textTransform
  })
}

test("a person picks Uppercase and an agent picks Lowercase, the canvas shows each and the export keeps them", async ({
  page,
  context,
  stack,
  decks,
}, testInfo) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await shapeAt(page, "2").click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  await unfold(panel, textCopy.value)
  await panel.getByRole("button", { name: textWords.upper, exact: true }).click()
  await expect.poll(() => shownCase(page)).toBe("uppercase")

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const upper = testInfo.outputPath("letter-case-upper.pptx")
  await (await saving).saveAs(upper)
  const upperXml = (await partsOf(upper)).get(slidePart)?.toString("utf8") ?? ""
  expect(upperXml).toMatch(/cap="all"[^>]*>(<[^>]+>)*<a:t>Hello<\/a:t>/)

  await expect
    .poll(async () => (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)).index)
    .toBe("ready")
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const change = { op: "set", target: "256.2", text: { case: "lower" } }
  expect(await stack.callTool("airdesign_edit_deck", { deck, base, changes: [change] }, cookie)).toMatchObject({
    ok: true,
  })
  await expect.poll(() => shownCase(page)).toBe("lowercase")
  await expect(panel.getByRole("button", { name: textWords.lower, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )

  const again = page.waitForEvent("download")
  await exportFromDialog(page)
  const lower = testInfo.outputPath("letter-case-lower.pptx")
  await (await again).saveAs(lower)
  const lowerXml = (await partsOf(lower)).get(slidePart)?.toString("utf8") ?? ""
  expect(lowerXml).toContain("<a:t>hello</a:t>")
  expect(lowerXml).toMatch(/cap="none"/)
})
