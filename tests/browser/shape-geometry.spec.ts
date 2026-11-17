import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { actualSize } from "./paint-scale"
import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { openDeck, placed, settled, unfold } from "./design-panel"
import { partsOf, shapeAt } from "./shape-fills"
import { outline, pickShape, shapePanel, turned } from "./shape-turns"

const exportName = "exported-shape-geometry.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const slidePart = "ppt/slides/slide1.xml"
const element = "ppt/slides/slide1.xml#2"

test.use({ viewport: { width: 1470, height: 923 } })

test("a person rotates, flips, reshapes, adjusts and centres a shape, and it survives Undo, a reload, the export and a new import @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  await openDeck(page, "clean.pptx")
  await actualSize(page)
  const shape = shapeAt(page, "2")
  const panel = await shapePanel(page, shape)
  await unfold(panel, boxCopy.section)
  const rotation = panel.getByRole("textbox", { name: "Rotation", exact: true })
  await expect(rotation).toHaveValue("0")
  await rotation.fill("45")
  await rotation.press("Enter")
  await expect.poll(() => turned(shape)).toBe("rotate(45deg)")
  await panel.getByRole("button", { name: "Flip horizontally", exact: true }).click()
  await expect.poll(() => turned(shape)).toBe("rotate(45deg) scale(-1, 1)")
  await expect(panel.getByRole("button", { name: "Flip horizontally", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await page.getByRole("button", { name: "Undo flip", exact: true }).click()
  await expect.poll(() => turned(shape)).toBe("rotate(45deg)")
  await page.getByRole("button", { name: "Redo flip", exact: true }).click()
  await expect.poll(() => turned(shape)).toBe("rotate(45deg) scale(-1, 1)")

  await pickShape(page, panel, "Rounded rectangle")
  const corner = panel.getByRole("textbox", { name: "Adjust", exact: true })
  await corner.fill("30000")
  await corner.press("Enter")
  await expect(corner).toHaveValue("30000")
  const reshaped = await outline(shape)
  const radius = await shape.evaluate(
    (node: HTMLElement) => Math.round(Number.parseFloat(node.style.height) * 300) / 1000,
  )
  expect(reshaped).toContain(`A${radius} ${radius}`)

  const left = (await placed(page, element))[0]
  await panel.getByRole("group", { name: "Align", exact: true }).getByRole("button", { name: "Center" }).click()
  await expect.poll(async () => (await placed(page, element))[0]).not.toBe(left)
  const centred = await placed(page, element)
  await expect.poll(() => turned(shape)).toBe("rotate(45deg) scale(-1, 1)")

  await page.reload()
  await settled(page)
  await actualSize(page)
  await expect.poll(() => turned(shapeAt(page, "2"))).toBe("rotate(45deg) scale(-1, 1)")
  await expect.poll(() => outline(shapeAt(page, "2"))).toBe(reshaped)
  await expect.poll(() => placed(page, element)).toEqual(centred)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx"))
  const saved = await partsOf(file)
  const slide = saved.get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain(
    `<a:xfrm rot="2700000" flipH="1"><a:off x="3352800" y="457200"/><a:ext cx="5486400" cy="1828800"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"/></a:avLst></a:prstGeom><a:solidFill>`,
  )
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name).sort()).toEqual([slidePart])
  await copyFile(file, judged)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await actualSize(page)
  await expect.poll(() => turned(shapeAt(page, "2"))).toBe("rotate(45deg) scale(-1, 1)")
  await expect.poll(() => outline(shapeAt(page, "2"))).toBe(reshaped)
})
