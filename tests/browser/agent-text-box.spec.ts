import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { forward, openClean, signInBrowser, test } from "./api-stack"
import { exportFromDialog } from "./export-dialog"
import { partsOf, shapeAt } from "./shape-fills"

const exportName = "exported-agent-text-box.pptx"
const slidePart = "ppt/slides/slide1.xml"
const fitted =
  '<a:bodyPr anchor="ctr"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr/><a:r><a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill><a:latin typeface="Georgia"/></a:rPr><a:t>Hello</a:t></a:r>'

test.use({ viewport: { width: 1600, height: 1000 } })

function font(page: import("@playwright/test").Page): Promise<string> {
  return shapeAt(page, "2").evaluate((node) => {
    const run = [...node.querySelectorAll("span")].find((span) => span.textContent === "Hello")
    return run === undefined ? "" : getComputedStyle(run).fontFamily
  })
}

test("an agent sets a text box's autofit, anchor and font, which the person sees and the export keeps @export", async ({
  page,
  context,
  stack,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", exportName)
  await rm(judged, { force: true })
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await expect
    .poll(async () => (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)).index)
    .toBe("ready")
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const change = { op: "set", target: "256.2", body: { autofit: "shrink", anchor: "ctr" }, text: { font: "Georgia" } }
  const edited = await stack.callTool("airdesign_edit_deck", { deck, base, changes: [change] }, cookie)
  expect(edited).toMatchObject({ ok: true })
  await expect.poll(() => font(page)).toMatch(/^"?Georgia"?,/)
  const read = await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)
  expect(JSON.stringify(read)).toContain("text.font Georgia · body.anchor ctr · body.autofit shrink")

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await shapeAt(page, "2").click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const autofit = panel.getByRole("group", { name: "Autofit", exact: true })
  await expect(autofit.getByRole("button", { name: "Shrink" })).toHaveAttribute("aria-pressed", "true")
  await expect(autofit.getByRole("button", { name: "Off" })).toBeDisabled()

  const file = testInfo.outputPath(exportName)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx"))
  const saved = await partsOf(file)
  expect(saved.get(slidePart)?.toString("utf8")).toContain(fitted)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(file, judged)
})
