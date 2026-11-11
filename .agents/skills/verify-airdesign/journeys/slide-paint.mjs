import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, signIn, capture, note }) {
  await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const canvas = page.locator("[data-slide-paint]")
  await expect(canvas).toBeVisible()
  const elements = page.locator("[data-canvas-element]")
  await expect(elements.first()).toBeVisible()
  const box = await canvas.boundingBox()
  const count = await elements.count()
  const outside = []
  for (let at = 0; at < count; at += 1) {
    const element = await elements.nth(at).boundingBox()
    const key = await elements.nth(at).getAttribute("data-canvas-element")
    if (element === null || box === null) continue
    const inside =
      element.x >= box.x - 1 &&
      element.y >= box.y - 1 &&
      element.x + element.width <= box.x + box.width + 1 &&
      element.y + element.height <= box.y + box.height + 1
    if (!inside) outside.push(key)
  }
  await capture("painted-slide")
  expect(outside).toEqual([])
  note(
    `slide canvas ${String(Math.round(box?.width ?? 0))}x${String(Math.round(box?.height ?? 0))} paints ${String(count)} elements, all inside the slide`,
  )
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  note('the imported text "Hello" is on the slide')
}
