import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, type BrowserContext, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { fillCopy } from "../../apps/web/src/copy/fill-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test, type Stack } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, openEditor, savedNode, serveOriginals, slidePoint, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const pictureFile = join(process.cwd(), "tests/browser/fixtures/picture.png")

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

async function cropRead(stack: Stack, opened: Opened) {
  const blocks = await stack.toolBlocks(
    "airdesign_execute",
    { deck: opened.deck, script: "get().layers" },
    opened.cookie,
  )
  const text = blocks.find((block) => block.type === "text")?.text ?? ""
  const answer = JSON.parse(text) as { result?: string }
  return answer.result?.match(/\/crop\([^)]*\)/)?.[0] ?? ""
}

test("an ordinary resize of a cropped picture keeps its aspect, as one undo, and the agent still reads that crop", async ({
  page,
  context,
  stack,
}) => {
  covers("resize", "undo")
  await serveOriginals(page, stack.originals)
  const opened = await openEditor(page, context, stack)
  await drop(page, [...(await readFile(pictureFile))], await slidePoint(page, 960, 540))
  const picture = page.locator("[data-slide-box] [data-node]").filter({ has: page.locator('[data-paint="image"]') })
  await expect(picture).toHaveCount(1)
  const id = (await picture.getAttribute("data-node")) ?? ""
  const saved = async () => (await savedNode(stack, opened, id)) as unknown as Saved
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await clickSlide(page, 960, 540)
  const fill = page.locator(`[data-design-panel] [data-design-section="${fillCopy.section}"]`)
  await fill.getByRole("combobox").click()
  const { pictureWords } = await import("../../apps/web/src/copy/picture-panel-copy")
  await page.getByRole("option", { name: pictureWords.crop, exact: true }).click()
  await expect(page.locator("[data-crop-handles]")).toBeVisible()
  await dragBy(page, await centre(page, '[data-grip="crop-w"]'), { x: 60, y: 0 })
  await expect.poll(async () => (await saved()).fills[0]?.crop?.x ?? 0).toBeGreaterThan(0.05)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-crop-handles]")).toHaveCount(0)
  const cut = await saved()
  const words = await cropRead(stack, opened)
  expect(words).toMatch(/^\/crop\(/)

  const right = await centre(page, '[data-grip="right"]')
  await dragBy(page, right, { x: 80, y: 24 })
  await expect.poll(async () => (await saved()).box.w).toBeGreaterThan(cut.box.w + 20)
  const kept = await saved()
  expect(kept.box.w / kept.box.h).toBeCloseTo(cut.box.w / cut.box.h, 1)
  expect(kept.fills[0]?.crop).toEqual(cut.fills[0]?.crop)
  await expect.poll(() => cropRead(stack, opened)).toBe(words)

  await page.keyboard.down("Control")
  const again = await centre(page, '[data-grip="right"]')
  await dragBy(page, again, { x: 70, y: 0 })
  await page.keyboard.up("Control")
  await expect.poll(async () => (await saved()).box.w).toBeGreaterThan(kept.box.w + 20)
  const stretched = await saved()
  expect(stretched.box.h).toBe(kept.box.h)
  expect(stretched.box.w / stretched.box.h).not.toBeCloseTo(kept.box.w / kept.box.h, 1)
  expect(stretched.fills[0]?.crop).toEqual(cut.fills[0]?.crop)
  await expect.poll(() => cropRead(stack, opened)).toBe(words)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved()).box).toEqual(kept.box)
  expect((await saved()).fills[0]?.crop).toEqual(cut.fills[0]?.crop)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved()).box).toEqual(cut.box)
  expect(await cropRead(stack, opened)).toBe(words)
})

async function croppedPicture(page: Page, context: BrowserContext, stack: Stack) {
  await serveOriginals(page, stack.originals)
  const opened = await openEditor(page, context, stack)
  await drop(page, [...(await readFile(pictureFile))], await slidePoint(page, 960, 540))
  const picture = page.locator("[data-slide-box] [data-node]").filter({ has: page.locator('[data-paint="image"]') })
  await expect(picture).toHaveCount(1)
  const id = (await picture.getAttribute("data-node")) ?? ""
  const saved = async () => (await savedNode(stack, opened, id)) as unknown as Saved | undefined
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await clickSlide(page, 960, 540)
  const fill = page.locator(`[data-design-panel] [data-design-section="${fillCopy.section}"]`)
  await fill.getByRole("combobox").click()
  const { pictureWords } = await import("../../apps/web/src/copy/picture-panel-copy")
  await page.getByRole("option", { name: pictureWords.crop, exact: true }).click()
  await expect(page.locator("[data-crop-handles]")).toBeVisible()
  await dragBy(page, await centre(page, '[data-grip="crop-w"]'), { x: 60, y: 0 })
  await expect.poll(async () => (await saved())?.fills?.[0]?.crop?.x ?? 0).toBeGreaterThan(0.05)
  return { opened, saved, cut: await saved() }
}

async function dragWhile(page: Page, from: { x: number; y: number }, by: { x: number; y: number }, key: string) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.keyboard.press(key)
  await page.mouse.up()
}

test("undo, redo or delete during a crop drag does not write the crop from before the key", async ({
  page,
  context,
  stack,
}) => {
  covers("crop-drag", "undo", "redo", "delete")
  const { saved, cut } = await croppedPicture(page, context, stack)
  if (cut === undefined) throw new Error("crop was not saved")

  await dragWhile(
    page,
    await centre(page, '[data-crop-handles] rect[data-grip="crop-move"]'),
    { x: 40, y: 0 },
    "ControlOrMeta+z",
  )
  await expect.poll(async () => (await saved())?.fills?.[0]?.crop?.x).not.toBe(cut.fills[0]?.crop?.x)
  const moved = await saved()
  expect(moved?.box).toEqual(cut.box)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved())?.fills?.[0]?.crop).toEqual(cut.fills[0]?.crop)
  expect((await saved())?.box).toEqual(cut.box)

  await dragWhile(
    page,
    await centre(page, '[data-crop-handles] rect[data-grip="crop-move"]'),
    { x: 28, y: 0 },
    "ControlOrMeta+Shift+z",
  )
  await expect.poll(async () => (await saved())?.fills?.[0]?.crop?.x).not.toBe(cut.fills[0]?.crop?.x)
  expect((await saved())?.box).toEqual(cut.box)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved())?.fills?.[0]?.crop).toEqual(cut.fills[0]?.crop)
  expect((await saved())?.box).toEqual(cut.box)

  await dragWhile(
    page,
    await centre(page, '[data-crop-handles] rect[data-grip="crop-move"]'),
    { x: 20, y: 0 },
    slideListCopy.deleteKey,
  )
  await expect.poll(async () => (await saved())?.fills?.[0]?.crop?.x).not.toBe(cut.fills[0]?.crop?.x)
  expect((await saved())?.box).toEqual(cut.box)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved())?.fills?.[0]?.crop).toEqual(cut.fills[0]?.crop)
  expect((await saved())?.box).toEqual(cut.box)
})

test("Control as a context click, and Fn, free the aspect of a cropped picture", async ({ page, context, stack }) => {
  covers("resize")
  const { saved, cut } = await croppedPicture(page, context, stack)
  if (cut === undefined) throw new Error("crop was not saved")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-crop-handles]")).toHaveCount(0)
  await page.evaluate(() => {
    document.addEventListener("contextmenu", (event) => {
      ;(window as Window & { menuPrevented?: boolean }).menuPrevented = event.defaultPrevented
    })
  })
  await page.keyboard.down("Control")
  const right = await centre(page, '[data-grip="right"]')
  await page.mouse.move(right.x, right.y)
  await page.mouse.down({ button: "right" })
  await page.mouse.move(right.x + 70, right.y, { steps: 8 })
  await page.mouse.up({ button: "right" })
  await page.keyboard.up("Control")
  await expect.poll(async () => (await saved())?.box?.w ?? 0).toBeGreaterThan(cut.box.w + 20)
  const stretched = await saved()
  expect(stretched?.box.h).toBe(cut.box.h)
  expect(stretched?.fills?.[0]?.crop).toEqual(cut.fills[0]?.crop)
  expect(await page.evaluate(() => (window as Window & { menuPrevented?: boolean }).menuPrevented)).toBe(true)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved())?.box).toEqual(cut.box)
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Fn", bubbles: true })))
  const again = await centre(page, '[data-grip="right"]')
  await dragBy(page, again, { x: 70, y: 0 })
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Fn", bubbles: true })))
  await expect.poll(async () => (await saved())?.box?.w ?? 0).toBeGreaterThan(cut.box.w + 20)
  const freed = await saved()
  expect(freed?.box.h).toBe(cut.box.h)
  expect(freed?.fills?.[0]?.crop).toEqual(cut.fills[0]?.crop)
})
