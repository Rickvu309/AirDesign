import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { actualSize } from "./paint-scale"
import { expect, test } from "@playwright/test"
import { designing, unfold, openDeck, pendingValues, placed, settled } from "./design-panel"

const element = "ppt/slides/slide1.xml#2"
const point = 12_700

test.use({ viewport: { width: 1470, height: 923 } })

test("a length moves and sizes the selected element in points, Undo takes back each visit to a field, and a reload keeps it", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  await actualSize(page)
  const panel = await designing(page, page.locator('[contenteditable="true"]'))
  await unfold(panel, boxCopy.section)
  const x = panel.getByRole("textbox", { name: "X", exact: true })
  const width = panel.getByRole("textbox", { name: "Width", exact: true })
  await expect(panel.getByRole("heading", { name: boxCopy.section })).toBeVisible()
  await expect(x).toHaveValue("36")
  await expect(width).toHaveValue("432")
  await x.fill("72")
  await x.press("Enter")
  await expect.poll(() => placed(page, element)).toEqual([96, 48, 576, 192])
  await expect(x).toHaveValue("72")
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await width.press("ArrowUp")
  await expect(width).toHaveValue("433")
  await width.press("Shift+ArrowDown")
  await expect(width).toHaveValue("423")
  await expect
    .poll(() => pendingValues(page, "256.2"))
    .toEqual([{ x: 72 * point, y: 36 * point, cx: 423 * point, cy: 144 * point }])
  await page.getByRole("button", { name: "Undo resize", exact: true }).click()
  await expect(width).toHaveValue("432")
  await page.getByRole("button", { name: "Undo move", exact: true }).click()
  await expect.poll(() => placed(page, element)).toEqual([48, 48, 576, 192])
  await expect(x).toHaveValue("36")
  await page.getByRole("button", { name: "Redo move", exact: true }).click()
  await expect.poll(() => placed(page, element)).toEqual([96, 48, 576, 192])
  await page.reload()
  await settled(page)
  await actualSize(page)
  await expect.poll(() => placed(page, element)).toEqual([96, 48, 576, 192])
})

test("five arrow presses in one visit to a field are one undo step, and a press after leaving it is the next", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  await actualSize(page)
  const panel = await designing(page, page.locator('[contenteditable="true"]'))
  await unfold(panel, boxCopy.section)
  const width = panel.getByRole("textbox", { name: "Width", exact: true })
  await expect(width).toHaveValue("432")
  for (const shown of ["433", "434", "435", "436", "437"]) {
    await width.press("ArrowUp")
    await expect(width).toHaveValue(shown)
  }
  await width.blur()
  await width.press("ArrowUp")
  await expect(width).toHaveValue("438")
  await width.blur()
  await page.keyboard.press("Control+z")
  await expect(width).toHaveValue("437")
  await page.keyboard.press("Control+z")
  await expect(width).toHaveValue("432")
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled()
  await expect.poll(() => placed(page, element)).toEqual([48, 48, 576, 192])
})

test("dragging a field's label scrubs it in steps, Shift scrubs tens, and one Undo takes the whole scrub back", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  await actualSize(page)
  const panel = await designing(page, page.locator('[contenteditable="true"]'))
  await unfold(panel, boxCopy.section)
  const width = panel.getByRole("textbox", { name: "Width", exact: true })
  await expect(width).toHaveValue("432")
  const label = width.locator("xpath=ancestor::label").locator("span").first()
  const box = await label.boundingBox()
  if (box === null) throw new Error("the Width label has no box")
  const y = box.y + box.height / 2
  const x = box.x + box.width / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 10, y, { steps: 5 })
  await expect(width).toHaveValue("437")
  await page.keyboard.down("Shift")
  await page.mouse.move(x + 14, y, { steps: 2 })
  await page.keyboard.up("Shift")
  await page.mouse.up()
  await expect(width).toHaveValue("457")
  await expect(width).toBeFocused()
  await expect
    .poll(() => pendingValues(page, "256.2"))
    .toEqual([{ x: 36 * point, y: 36 * point, cx: 457 * point, cy: 144 * point }])
  await width.blur()
  await page.keyboard.press("Control+z")
  await expect(width).toHaveValue("432")
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled()
  await expect.poll(() => placed(page, element)).toEqual([48, 48, 576, 192])
})

test("a length the slide cannot hold leaves the element where it was", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  await actualSize(page)
  const panel = await designing(page, page.locator('[contenteditable="true"]'))
  await unfold(panel, boxCopy.section)
  const x = panel.getByRole("textbox", { name: "X", exact: true })
  await x.fill("99999")
  await x.press("Enter")
  await expect(x).toHaveValue("36")
  await x.fill("wide")
  await x.press("Tab")
  await expect(x).toHaveValue("36")
  expect(await placed(page, element)).toEqual([48, 48, 576, 192])
  expect(await pendingValues(page, "256.2")).toEqual([])
})
