import { expect, test } from "@playwright/test"
import { fillWords } from "../../apps/web/src/copy/fill-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { openDeck, pickColor, shownColor } from "./design-panel"
import { fillPanel, filled, shapeAt } from "./shape-fills"
import { holdableDevice } from "./slow-device"

test.use({ viewport: { width: 1470, height: 923 } })

test("the colour pick helper returns the chosen colour while the device is slow", async ({ page }) => {
  await holdableDevice(page)
  await openDeck(page, "shapes-added.pptx")
  const rectangle = shapeAt(page, "4")
  const panel = await fillPanel(page, rectangle)
  const colors = panel.getByRole("group", { name: fillWords.color, exact: true })
  await expect(shownColor(colors)).toHaveText(formatCopy.colors.accent1)
  await page.evaluate(() => {
    window.deviceDelay = 1000
  })
  await pickColor(page, colors, formatCopy.colors.accent2)
  expect(await shownColor(colors).textContent()).toBe(formatCopy.colors.accent2)
  expect(await filled(rectangle)).toBe("rgb(96, 96, 96)")
})
