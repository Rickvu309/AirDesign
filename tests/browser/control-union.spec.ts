import { openFillDetails } from "./design-panel"
import { expect, test } from "@playwright/test"
import { fillCopy } from "../../apps/web/src/copy/fill-copy"
import { openDeck, settled } from "./design-panel"
import { boxFillPanel, filled, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a union picks one case of a field, shows the pick and its own controls, and Undo goes back to the case before", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const own = await filled(shape)
  const panel = await boxFillPanel(page, shape)
  const kinds = panel.getByRole("group", { name: fillCopy.box, exact: true })
  const kind = (name: string) => kinds.getByRole("button", { name, exact: true })
  await expect(kind("Color")).toHaveAttribute("aria-pressed", "true")
  await expect(panel.getByRole("group", { name: "Color", exact: true }).getByRole("button")).toHaveText("Accent 1")
  await kind("None").click()
  await expect.poll(() => filled(shape)).toBe("rgba(0, 0, 0, 0)")
  await expect(kind("None")).toHaveAttribute("aria-pressed", "true")
  await expect(kind("Color")).toHaveAttribute("aria-pressed", "false")
  await expect(panel.getByRole("group", { name: "Color", exact: true })).toHaveCount(0)
  await openFillDetails(panel)
  await panel.getByRole("button", { name: "Pattern", exact: true }).click()
  await expect(panel.getByRole("button", { name: "Pattern", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(panel.getByRole("combobox", { name: "Pattern" })).toHaveText(/^5%/)
  await expect.poll(() => filled(shape)).not.toBe("rgba(0, 0, 0, 0)")
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect.poll(() => filled(shape)).toBe("rgba(0, 0, 0, 0)")
  await expect(kind("None")).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect.poll(() => filled(shape)).toBe(own)
  await kind("None").click()
  await expect.poll(() => filled(shape)).toBe("rgba(0, 0, 0, 0)")
  await page.reload()
  await settled(page)
  await expect.poll(() => filled(shapeAt(page, "2"))).toBe("rgba(0, 0, 0, 0)")
})
