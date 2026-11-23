import { expect } from "@playwright/test"
import { forward, test } from "./api-stack"
import { clickSlide, openDoomEditor, savedNode } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

test("an undo of typing in a layer another tab deleted does nothing, and the next undo takes back the nudge below it", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as Box
  const charsOf = async (id: string) => ((await savedNode(stack, opened, id))?.text as { chars?: string })?.chars
  const title = await boxOf("s:4")
  const subtitle = await boxOf("s:5")
  const centre = (box: Box) => [box.x + box.w / 2, box.y + box.h / 2] as const

  await clickSlide(page, ...centre(subtitle))
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x + 1)
  await page.keyboard.press("Escape")
  await clickSlide(page, ...centre(title))
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.type("Quarterly plan")
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-text-editor]")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect.poll(() => charsOf("s:4")).toContain("Quarterly plan")

  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(`/s/${opened.deck}`)
  await other.locator("[data-doom-ready]").waitFor()
  await clickSlide(other, ...centre(title))
  await other.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  const shownTitle = page.locator('[data-slide-box] [data-node="s:4"]')
  await expect(shownTitle).toHaveCount(0)

  await page.keyboard.press("ControlOrMeta+z")
  await expect(shownTitle).toHaveCount(0)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf("s:5")).x).toBe(subtitle.x)
  expect((await savedNode(stack, opened, "s:4"))?.parent).toBeNull()
  await other.close()
})
