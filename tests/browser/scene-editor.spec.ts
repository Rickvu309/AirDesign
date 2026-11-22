import { expect } from "@playwright/test"
import { sceneEditorCopy } from "../../apps/web/src/copy/scene-editor-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, dragSlide, openSceneEditor, savedNode, selectedIds, spot } from "./scene-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a new scene deck opens at its own address, paints its first slide and keeps what the person does after a reload", async ({
  page,
  context,
  stack,
}) => {
  covers("select", "move", "nudge", "nudge-far", "delete", "undo", "redo")
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const opened = await openSceneEditor(page, context, stack)
  await expect(page).toHaveURL(new RegExp(`/s/${opened.deck}$`))
  const title = page.locator("[data-slide-box] [data-node]")
  await expect(title).toHaveCount(1)
  const node = "s:4"
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as { x: number; y: number } | undefined
  expect(await boxOf(node)).toMatchObject(spot(160, 380, 1600, 160))

  await clickSlide(page, 600, 420)
  expect(await selectedIds(page)).toEqual([node])
  await dragSlide(page, { x: 600, y: 420 }, { x: 700, y: 520 })
  await expect.poll(async () => (await boxOf(node))?.x).not.toBe(160)
  const dragged = await boxOf(node)
  expect(dragged?.x).toBeGreaterThanOrEqual(258)
  expect(dragged?.x).toBeLessThanOrEqual(262)
  expect(dragged?.y).toBeGreaterThanOrEqual(478)
  expect(dragged?.y).toBeLessThanOrEqual(482)
  const { x, y } = dragged ?? { x: 0, y: 0 }

  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Shift+ArrowDown")
  await expect.poll(boxOf.bind(null, node)).toMatchObject({ x: x + 1, y: y + 10 })

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(boxOf.bind(null, node)).toMatchObject({ x: x + 1, y })
  await page.getByRole("button", { name: sceneEditorCopy.redo }).click()
  await expect.poll(boxOf.bind(null, node)).toMatchObject({ x: x + 1, y: y + 10 })

  await page.reload()
  await page.locator("[data-scene-ready]").waitFor()
  await expect(title).toHaveCount(1)
  const shown = await title.boundingBox()
  const slide = await page.locator("[data-slide-box]").boundingBox()
  expect((shown?.x ?? 0) - (slide?.x ?? 0)).toBeCloseTo(((x + 1) * (slide?.width ?? 0)) / 1920, 0)

  await clickSlide(page, 600, 500)
  await page.keyboard.press("Delete")
  await expect(title).toHaveCount(0)
  await expect.poll(async () => (await savedNode(stack, opened, node))?.parent).toBeNull()
  await page.getByRole("button", { name: sceneEditorCopy.undo }).click()
  await expect(title).toHaveCount(1)
  expect(faults).toEqual([])
})
