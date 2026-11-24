import { expect, type Page } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import {
  clearSubtitle,
  clickSlide,
  landNodes,
  openEditor,
  savedNode,
  selectedIds,
  slidePoint,
  spot,
} from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const accent2 = [{ kind: "solid", color: { var: "accent2" } }]
const accent1 = [{ kind: "solid", color: { var: "accent1" } }]

async function colourAt(page: Page, x: number, y: number): Promise<number> {
  const at = await slidePoint(page, x, y)
  const shot = await page.screenshot({ clip: { x: at.x, y: at.y, width: 1, height: 1 } })
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
    const canvas = new OffscreenCanvas(1, 1)
    const context = canvas.getContext("2d")
    if (context === null) throw new Error("no canvas")
    context.drawImage(bitmap, 0, 0)
    const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data
    return red * 65536 + green * 256 + blue
  }, shot.toString("base64"))
}

async function useMenu(page: Page, label: string, x: number, y: number) {
  const at = await slidePoint(page, x, y)
  await page.mouse.click(at.x, at.y, { button: "right" })
  await page.getByRole("menuitem", { name: label }).click()
}

test("Use as mask clips the layer above on the canvas, takes one Undo, survives a reload, and Remove mask paints the layer again", async ({
  page,
  context,
  stack,
}) => {
  covers("select")
  const opened = await openEditor(page, context, stack)
  await clearSubtitle(stack, opened)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(200, 600, 400, 400), fills: accent2 } },
    { id: "t:2", type: "shape", parent: opened.slide, props: { box: spot(100, 500, 400, 400), fills: accent1 } },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)

  const clipped = [150, 550] as const
  const inside = [300, 700] as const
  const maskOnly = [550, 950] as const
  const before = {
    clipped: await colourAt(page, ...clipped),
    inside: await colourAt(page, ...inside),
    maskOnly: await colourAt(page, ...maskOnly),
  }
  expect(before.clipped).toBe(before.inside)
  expect(before.maskOnly).not.toBe(before.inside)

  await useMenu(page, editorCopy.useAsMask, ...maskOnly)
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.mask).toBe(true)
  const masked = async () => ({
    clipped: await colourAt(page, ...clipped),
    inside: await colourAt(page, ...inside),
    maskOnly: await colourAt(page, ...maskOnly),
  })
  await expect.poll(async () => (await masked()).clipped).not.toBe(before.clipped)
  const after = await masked()
  expect(after.inside).toBe(before.inside)
  expect(after.maskOnly).not.toBe(before.maskOnly)
  expect(after.maskOnly).toBe(after.clipped)

  await clickSlide(page, ...clipped)
  expect(await selectedIds(page)).not.toContain("t:2")
  await clickSlide(page, ...inside)
  expect(await selectedIds(page)).toEqual(["t:2"])

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.mask ?? false).toBe(false)
  expect(await masked()).toEqual(before)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.mask).toBe(true)

  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect.poll(async () => (await masked()).clipped).toBe(after.clipped)
  expect(await masked()).toEqual(after)

  await useMenu(page, editorCopy.removeMask, ...maskOnly)
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.mask ?? false).toBe(false)
  await expect.poll(async () => (await masked()).maskOnly).toBe(before.maskOnly)
  expect(await masked()).toEqual(before)
})

test("a click in a corner a rounded mask's radius cuts away does not select the layer it hides", async ({
  page,
  context,
  stack,
}) => {
  covers("select")
  const opened = await openEditor(page, context, stack)
  await clearSubtitle(stack, opened)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: { box: spot(200, 600, 400, 400), fills: accent2, radius: 150, mask: true },
    },
    { id: "t:2", type: "shape", parent: opened.slide, props: { box: spot(100, 500, 400, 400), fills: accent1 } },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(2)

  await clickSlide(page, 210, 610)
  expect(await selectedIds(page)).not.toContain("t:2")
  await clickSlide(page, 300, 700)
  expect(await selectedIds(page)).toEqual(["t:2"])
})
