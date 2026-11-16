import { expect, test } from "@playwright/test"

test("presenter controls fit a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto("/screens/s52-01-present-presenter-view")
  await expect(page.getByRole("button", { name: "Stop presenting", exact: true })).toBeVisible()
  const boxes = []
  for (const button of await page.getByRole("button").all()) {
    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    if (box !== null) boxes.push(box)
    expect(box?.x).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320)
  }
  for (const [index, left] of boxes.entries()) {
    for (const right of boxes.slice(index + 1)) {
      expect(
        left.x + left.width <= right.x ||
          right.x + right.width <= left.x ||
          left.y + left.height <= right.y ||
          right.y + right.height <= left.y,
      ).toBe(true)
    }
  }
})
