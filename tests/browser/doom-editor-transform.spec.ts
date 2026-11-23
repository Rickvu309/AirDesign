import { expect, type Page } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { accent, clickSlide, landNodes, openDoomEditor, savedNode, selectedIds, slidePoint, spot } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Saved = { x: number; y: number; w: number; h: number; rotation: number }

async function gripCentre(page: Page, grip: string) {
  const box = await page.locator(`[data-grip="${grip}"]`).boundingBox()
  if (box === null) throw new Error(`no ${grip}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function dragFrom(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, held: string[] = []) {
  for (const key of held) await page.keyboard.down(key)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  for (const key of held) await page.keyboard.up(key)
}

test("a corner handle resizes, a side handle moves one edge, and one undo takes the whole resize back", async ({
  page,
  context,
  stack,
}) => {
  covers("resize", "undo")
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(200, 600, 300, 150), fills: accent } },
  ])
  const boxOf = async () => (await savedNode(stack, opened, "t:1"))?.box as Saved
  await clickSlide(page, 350, 675)
  expect(await selectedIds(page)).toEqual(["t:1"])
  await expect(page.locator("[data-size-label]")).toContainText("300")

  const corner = await gripCentre(page, "bottom-right")
  await dragFrom(page, corner, { x: corner.x + 80, y: corner.y + 40 })
  await expect.poll(async () => (await boxOf()).w).toBeGreaterThan(380)
  const grown = await boxOf()
  expect(grown.x).toBe(200)
  expect(grown.y).toBe(600)
  expect(grown.h).toBeGreaterThan(190)

  const side = await gripCentre(page, "left")
  await dragFrom(page, side, { x: side.x - 60, y: side.y })
  await expect.poll(async () => (await boxOf()).x).toBeLessThan(150)
  const wider = await boxOf()
  expect(wider.x + wider.w).toBe(grown.x + grown.w)
  expect(wider.h).toBe(grown.h)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf()).x).toBe(200)
  expect(await boxOf()).toMatchObject({ w: grown.w, h: grown.h })
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf()).w).toBe(300)
})

test("Alt resizes from the centre and Shift keeps the proportions", async ({ page, context, stack }) => {
  covers("resize")
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(600, 600, 300, 150), fills: accent } },
  ])
  const boxOf = async () => (await savedNode(stack, opened, "t:1"))?.box as Saved
  await clickSlide(page, 750, 675)
  const right = await gripCentre(page, "right")
  await dragFrom(page, right, { x: right.x + 30, y: right.y }, [shortcutCopy.chord.other.alt])
  await expect.poll(async () => (await boxOf()).w).toBeGreaterThan(330)
  const centred = await boxOf()
  expect(centred.x + centred.w / 2).toBeCloseTo(750, 0)

  const corner = await gripCentre(page, "bottom-right")
  await dragFrom(page, corner, { x: corner.x + 60, y: corner.y + 5 }, [shortcutCopy.chord.other.shift])
  await expect.poll(async () => (await boxOf()).w).toBeGreaterThan(centred.w + 20)
  const kept = await boxOf()
  expect(kept.w / kept.h).toBeCloseTo(centred.w / centred.h, 1)
})

test("a rotate zone turns the layer about its centre and Shift steps by 15 degrees", async ({
  page,
  context,
  stack,
}) => {
  covers("rotate")
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(700, 600, 300, 150), fills: accent } },
  ])
  const boxOf = async () => (await savedNode(stack, opened, "t:1"))?.box as Saved
  await clickSlide(page, 850, 675)
  const zone = await gripCentre(page, "rotate-top-right")
  const middle = await page.locator("[data-selection-outline]").evaluate((outline) => {
    const box = outline.getBoundingClientRect()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })
  const along = { x: zone.x - middle.x, y: zone.y - middle.y }
  await dragFrom(page, zone, { x: middle.x - along.y, y: middle.y + along.x }, [shortcutCopy.chord.other.shift])
  await expect.poll(async () => (await boxOf()).rotation).not.toBe(0)
  const turned = await boxOf()
  expect(turned.rotation % 15).toBe(0)
  expect(turned.rotation).toBeGreaterThan(60)
  expect(turned.rotation).toBeLessThan(120)
  expect(turned).toMatchObject({ x: 700, y: 600, w: 300, h: 150 })
})

test("resizing a group scales the layers inside it and leaves it hugging them", async ({ page, context, stack }) => {
  covers("resize")
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "frame",
      parent: opened.slide,
      props: { box: spot(300, 700, 400, 100), sizing: { w: "hug", h: "hug" } },
    },
    { id: "t:2", type: "shape", parent: "t:1", props: { box: spot(0, 0, 100, 100), fills: accent } },
    { id: "t:3", type: "shape", parent: "t:1", props: { box: spot(300, 0, 100, 100), fills: accent } },
  ])
  await clickSlide(page, 350, 750)
  expect(await selectedIds(page)).toEqual(["t:1"])
  const right = await gripCentre(page, "right")
  await dragFrom(page, right, { x: right.x + 150, y: right.y })
  const widthOf = async (id: string) => ((await savedNode(stack, opened, id))?.box as Saved).w
  await expect.poll(() => widthOf("t:2")).toBeGreaterThan(130)
  const grew = (await widthOf("t:2")) / 100
  expect(Math.abs((await widthOf("t:3")) - 100 * grew)).toBeLessThanOrEqual(2)
  expect(Math.abs(((await savedNode(stack, opened, "t:3"))?.box as Saved).x - 300 * grew)).toBeLessThanOrEqual(2)
  expect((await savedNode(stack, opened, "t:1"))?.sizing).toEqual({ w: "hug", h: "hug" })
})

test("Alt-drag leaves the layer where it is and drags a copy above it, and one undo takes the copy away", async ({
  page,
  context,
  stack,
}) => {
  covers("duplicate-drag", "undo")
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(200, 600, 300, 150), fills: accent } },
  ])
  const layers = page.locator("[data-slide-box] [data-node]")
  await expect(layers).toHaveCount(3)
  const from = await slidePoint(page, 350, 675)
  const to = await slidePoint(page, 450, 800)
  await page.mouse.move(from.x, from.y)
  await page.keyboard.down(shortcutCopy.chord.other.alt)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await expect(layers).toHaveCount(4)
  await page.mouse.up()
  await page.keyboard.up(shortcutCopy.chord.other.alt)

  const [copy] = await selectedIds(page)
  expect(copy).toBeTruthy()
  expect(copy).not.toBe("t:1")
  await expect.poll(async () => (await savedNode(stack, opened, copy!))?.box).toMatchObject({ x: 300, y: 725 })
  expect((await savedNode(stack, opened, "t:1"))?.box).toMatchObject(spot(200, 600, 300, 150))

  await page.keyboard.press("ControlOrMeta+z")
  await expect(layers).toHaveCount(3)
  expect((await savedNode(stack, opened, "t:1"))?.box).toMatchObject(spot(200, 600, 300, 150))
})

test("Escape during an Alt-drag drops the copy and keeps the original selected", async ({ page, context, stack }) => {
  covers("duplicate-drag")
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(200, 600, 300, 150), fills: accent } },
  ])
  const layers = page.locator("[data-slide-box] [data-node]")
  const from = await slidePoint(page, 350, 675)
  const to = await slidePoint(page, 450, 800)
  await page.mouse.move(from.x, from.y)
  await page.keyboard.down(shortcutCopy.chord.other.alt)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await expect(layers).toHaveCount(4)
  await page.keyboard.up(shortcutCopy.chord.other.alt)
  await page.keyboard.press("Escape")
  await page.mouse.up()
  await expect(layers).toHaveCount(3)
  expect(await selectedIds(page)).toEqual(["t:1"])
})

test("a drag snaps a layer's edge to another's, and holding Ctrl stops the snap", async ({ page, context, stack }) => {
  covers("move", "snap-off")
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "q:1", type: "shape", parent: opened.slide, props: { box: spot(1000, 150, 200, 120), fills: accent } },
    { id: "q:2", type: "shape", parent: opened.slide, props: { box: spot(1500, 700, 200, 120), fills: accent } },
  ])
  const xOf = async () => ((await savedNode(stack, opened, "q:2"))?.box as Saved).x
  const from = await slidePoint(page, 1600, 760)
  const to = await slidePoint(page, 1103, 760)
  await dragFrom(page, from, to, ["Control"])
  await expect.poll(xOf).not.toBe(1500)
  expect(Math.abs((await xOf()) - 1003)).toBeLessThanOrEqual(2)
  expect(await xOf()).not.toBe(1000)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(xOf).toBe(1500)
  await dragFrom(page, from, to)
  await expect.poll(xOf).toBe(1000)
})
