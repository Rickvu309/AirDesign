import { expect } from "@playwright/test"
import { test } from "./api-stack"
import { clickSlide, dragSlide, landNodes, openEditor, savedNode, selectedIds, slidePoint } from "./editor-deck"
import { dragTo, gripCentre, lineFrom, paintedStart } from "./editor-line-end"
import { covers } from "./gesture"

test.use({ viewport: { width: 1600, height: 1000 } })

test("undoing the attachment and then the drawn frame restores the original line", async ({ page, context, stack }) => {
  covers("tool-frame", "line-end", "undo")
  const opened = await openEditor(page, context, stack)
  const original = { x: 230, y: 145 }
  await landNodes(stack, opened, [lineFrom(opened.slide, original, { x: 100, y: 350 })])
  await expect.poll(() => paintedStart(page, "l:1")).toEqual(original)

  await page.keyboard.press("f")
  await dragSlide(page, { x: 400, y: 200 }, { x: 600, y: 300 })
  const [frame] = await selectedIds(page)
  if (frame === undefined) throw new Error("no frame selected")
  await expect.poll(async () => (await savedNode(stack, opened, frame))?.type).toBe("frame")

  await clickSlide(page, 165, 248)
  await expect(page.locator('[data-grip="line-start"]')).toBeVisible()
  await dragTo(page, await gripCentre(page, "line-start"), await slidePoint(page, 600, 250))
  const geometry = async () => (await savedNode(stack, opened, "l:1"))?.geometry
  await expect.poll(geometry).toMatchObject({ start: { node: frame, site: "r" } })

  await page.keyboard.press("ControlOrMeta+z")
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await savedNode(stack, opened, frame))?.parent).toBeNull()
  await expect.poll(geometry).toMatchObject({ start: original, end: { x: 100, y: 350 } })
  await expect.poll(() => paintedStart(page, "l:1")).toEqual(original)
  await page.reload()
  await expect.poll(() => paintedStart(page, "l:1")).toEqual(original)
})
