import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { fillCopy } from "../../apps/web/src/copy/fill-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, openEditor, savedNode, serveOriginals, slidePoint } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const pictureFile = join(process.cwd(), "scripts/pptx-fixtures/picture.png")

type Saved = {
  box: { x: number; y: number; w: number; h: number }
  fills: { fit: string; crop?: { x: number; y: number; w: number; h: number } }[]
}

async function drop(page: Page, bytes: readonly number[], at: { x: number; y: number }) {
  await page.evaluate(
    ([bytes, at]) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(bytes)], "picture.png", { type: "image/png" }))
      document.querySelector("[data-editor-stage]")!.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: at.x,
          clientY: at.y,
        }),
      )
    },
    [bytes, at] as const,
  )
}

async function centre(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox()
  if (box === null) throw new Error(`no ${selector}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function dragBy(page: Page, from: { x: number; y: number }, by: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

test("a picture is cropped on the canvas by its handles and by moving it in its frame, one undo step each, and Enter or a click outside ends it", async ({
  page,
  context,
  stack,
}) => {
  covers("crop", "crop-drag", "crop-end")
  await serveOriginals(page, stack.originals)
  const opened = await openEditor(page, context, stack)
  await drop(page, [...(await readFile(pictureFile))], await slidePoint(page, 960, 540))
  const picture = page.locator("[data-slide-box] [data-node]").filter({ has: page.locator('[data-paint="image"]') })
  await expect(picture).toHaveCount(1)
  const id = (await picture.getAttribute("data-node")) ?? ""
  const saved = async () => (await savedNode(stack, opened, id)) as unknown as Saved
  await expect.poll(async () => (await saved())?.fills?.[0]?.fit).toBe("fill")
  const first = (await saved()).box

  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await clickSlide(page, 960, 540)
  const fill = page.locator(`[data-design-panel] [data-design-section="${fillCopy.section}"]`)
  await fill.getByRole("combobox").click()
  const { pictureWords } = await import("../../apps/web/src/copy/picture-panel-copy")
  await page.getByRole("option", { name: pictureWords.crop, exact: true }).click()
  await expect(page.locator("[data-crop-handles]")).toBeVisible()
  await expect.poll(async () => (await saved()).fills[0]?.fit).toBe("crop")
  expect((await saved()).fills[0]?.crop).toBeUndefined()

  await dragBy(page, await centre(page, '[data-grip="crop-w"]'), { x: 60, y: 0 })
  await expect.poll(async () => (await saved()).fills[0]?.crop?.x ?? 0).toBeGreaterThan(0.05)
  const cut = await saved()
  expect(cut.box.w).toBeLessThan(first.w)
  expect(cut.box.h).toBe(first.h)
  expect(cut.box.x + cut.box.w).toBeCloseTo(first.x + first.w, 0)
  expect(cut.fills[0]?.crop?.w).toBeCloseTo(cut.box.w / first.w, 2)

  await dragBy(page, await centre(page, '[data-crop-handles] rect[data-grip="crop-move"]'), { x: 30, y: 0 })
  await expect.poll(async () => (await saved()).fills[0]?.crop?.x).not.toBe(cut.fills[0]?.crop?.x)
  const moved = await saved()
  expect(moved.box).toEqual(cut.box)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved()).fills[0]?.crop?.x).toBe(cut.fills[0]?.crop?.x)
  expect((await saved()).box).toEqual(cut.box)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved()).box).toEqual(first)
  expect((await saved()).fills[0]?.crop).toBeUndefined()
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await saved()).box).toEqual(cut.box)

  await page.keyboard.press("Enter")
  await expect(page.locator("[data-crop-handles]")).toHaveCount(0)
  await clickSlide(page, 960, 540, { double: true })
  await expect(page.locator("[data-crop-handles]")).toBeVisible()
  await clickSlide(page, 100, 100)
  await expect(page.locator("[data-crop-handles]")).toHaveCount(0)
  await expect(page.locator(`[data-design-panel] [data-design-section="${designCopy.slide(1)}"]`)).toHaveCount(0)
})
