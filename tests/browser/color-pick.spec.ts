import { expect, test } from "@playwright/test"
import { fillWords } from "../../apps/web/src/copy/fill-copy"
import { colorWords } from "./color-words"
import { openDeck, pickColor, shownColor } from "./design-panel"
import { fillPanel, filled, shapeAt } from "./shape-fills"
import { holdableDevice } from "./slow-device"

test.use({ viewport: { width: 1470, height: 923 } })

test("the colour pick helper returns the chosen colour while the device is slow", async ({ page }) => {
  await holdableDevice(page)
  await openDeck(page, "shapes-added.pptx")
  const names = await colorWords("shapes-added.pptx")
  const rectangle = shapeAt(page, "4")
  const panel = await fillPanel(page, rectangle)
  const colors = panel.getByRole("group", { name: fillWords.color, exact: true })
  await expect(shownColor(colors)).toHaveText(names.accent1)
  await page.evaluate(() => {
    window.deviceDelay = 1000
  })
  await pickColor(page, colors, names.accent2)
  expect(await shownColor(colors).textContent()).toBe(names.accent2)
  expect(await filled(rectangle)).toBe("rgb(96, 96, 96)")
})
