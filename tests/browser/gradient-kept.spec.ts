import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { openDeck, settled } from "./design-panel"
import { fillPanel, filled, partsOf, shapeAt } from "./shape-fills"

const deck = "corpus/nasa-lessons-capture-eee.pptx"
const exportName = "exported-gradient-kept.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const slidePart = "ppt/slides/slide2.xml"
const linear =
  /<a:prstGeom prst="ellipse"><a:avLst\/><\/a:prstGeom><a:gradFill flip="none" rotWithShape="1"><a:gsLst>.*?<\/a:gsLst><a:lin ang="\d+" scaled="[01]"\/><a:tileRect\/><\/a:gradFill>/

test.use({ viewport: { width: 1600, height: 1000 } })

test("a person turns a tiled radial gradient linear, and the export keeps its flip and tile rectangle @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await openDeck(page, deck)
  const entry = page.locator('[data-slide-entry="2"]')
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
  const oval = shapeAt(page, "5", slidePart)
  const radial = await filled(oval)
  const panel = await fillPanel(page, oval)
  await expect(
    panel.getByRole("group", { name: "Fill", exact: true }).getByRole("button", { name: "Gradient" }),
  ).toHaveAttribute("aria-pressed", "true")
  const direction = panel.getByRole("group", { name: "Direction", exact: true })
  await direction.getByRole("button", { name: "Linear" }).click()
  await expect(direction.getByRole("button", { name: "Linear" })).toHaveAttribute("aria-pressed", "true")
  await expect.poll(() => filled(oval)).not.toBe(radial)
  const turned = await filled(oval)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures", deck))
  const saved = await partsOf(file)
  expect(saved.get(slidePart)?.toString("utf8")).toMatch(linear)
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.locator('[data-slide-entry="2"]').click()
  await expect.poll(() => filled(shapeAt(page, "5", slidePart))).toBe(turned)
})
