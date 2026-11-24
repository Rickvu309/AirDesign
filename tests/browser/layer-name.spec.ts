import { expect } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { test } from "./api-stack"
import { accent, clickSlide, spot } from "./editor-deck"
import { designDoom, panel, pick, reloadDesign, saved, undoOnStage } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a person renames one layer from the panel header, and a blank name or several layers do not", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: { name: "Card", box: spot(200, 200, 400, 300), geometry: { kind: "rect" }, fills: accent },
    },
    {
      id: "t:2",
      type: "shape",
      parent: slide,
      props: { box: spot(1000, 200, 300, 200), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  const nameOf = (id: string) => saved(stack, opened, id).then((node) => node.name)
  await pick(page, "t:1", 400, 350)
  const rename = () => panel(page).getByRole("button", { name: designCopy.renameLayer("Card"), exact: true })
  await expect(rename()).toBeVisible()
  await rename().click()
  const field = panel(page).getByRole("textbox", { name: designCopy.layerName, exact: true })
  await field.fill("Revenue")
  await field.press("Enter")
  await expect.poll(() => nameOf("t:1")).toBe("Revenue")
  await expect(panel(page).getByRole("button", { name: designCopy.renameLayer("Revenue"), exact: true })).toBeVisible()

  await undoOnStage(page)
  await expect.poll(() => nameOf("t:1")).toBe("Card")
  await pick(page, "t:1", 400, 350)
  await panel(page)
    .getByRole("button", { name: designCopy.renameLayer("Card"), exact: true })
    .click()
  await field.fill("Revenue")
  await field.press("Enter")
  await expect.poll(() => nameOf("t:1")).toBe("Revenue")
  await reloadDesign(page)
  await pick(page, "t:1", 400, 350)
  await expect(panel(page).getByRole("button", { name: designCopy.renameLayer("Revenue"), exact: true })).toBeVisible()
  await expect.poll(() => nameOf("t:1")).toBe("Revenue")

  await panel(page)
    .getByRole("button", { name: designCopy.renameLayer("Revenue"), exact: true })
    .click()
  await field.fill("   ")
  await field.press("Enter")
  await expect(panel(page).getByRole("alert")).toHaveText(designCopy.layerNameEmpty)
  await expect.poll(() => nameOf("t:1")).toBe("Revenue")
  await field.press("Escape")
  await expect(panel(page).getByRole("button", { name: designCopy.renameLayer("Revenue"), exact: true })).toBeVisible()

  await pick(page, "t:2", 1150, 300)
  await expect(
    panel(page).getByRole("button", { name: designCopy.renameLayer(designCopy.square), exact: true }),
  ).toBeVisible()
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await clickSlide(page, 400, 350)
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  await expect(panel(page).getByText(designCopy.selected(2), { exact: true })).toBeVisible()
  await expect(panel(page).locator("[data-layer-name]")).toHaveCount(0)
})
