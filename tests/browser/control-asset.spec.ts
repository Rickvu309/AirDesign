import { expect, test, type Locator, type Page } from "@playwright/test"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { boxFillPanel } from "./shape-fills"
import { openDeck, unfold } from "./design-panel"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

const iconKey = "ppt/slides/slide1.xml#5"

function picture(page: Page): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${iconKey}"]`)
}

function drawn(element: Locator): Promise<string> {
  return element.evaluate((node) => getComputedStyle(node).backgroundImage)
}

async function iconPanel(page: Page): Promise<Locator> {
  const { picturePanelCopy: pictureCopy } = await import("../../apps/web/src/copy/picture-panel-copy.ts")
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  await picture(page).click()
  const panel = page.locator("[data-design-element]")
  await expect(panel).toHaveAttribute("data-design-element", /\.5$/)
  await unfold(panel, pictureCopy.section)
  return panel.locator("section").filter({ has: page.getByRole("heading", { name: pictureCopy.section, exact: true }) })
}

test("an asset control finds an icon by a word, swaps the picture's icon, and Undo puts the first one back", async ({
  page,
}) => {
  await openDeck(page, "picture-png.pptx")
  await page.getByRole("button", { name: "Add icon", exact: true }).click()
  const tool = page.locator("[data-icon-tool]")
  await tool.getByRole("searchbox", { name: "Search icons" }).fill("rocket")
  await tool.getByRole("button", { name: "rocket", exact: true }).click()
  await expect.poll(() => drawn(picture(page))).toContain("blob:")
  const rocket = await drawn(picture(page))

  const section = await iconPanel(page)
  const icons = section.getByRole("group", { name: "Icon", exact: true })
  await expect(section.getByText("Shows the rocket icon")).toBeVisible()
  await expect(icons.getByRole("button", { name: "star", exact: true })).toHaveAttribute("aria-pressed", "false")
  await section.getByRole("searchbox", { name: "Search icons" }).fill("sta")
  await icons.getByRole("button", { name: "star", exact: true }).click()
  await expect.poll(() => drawn(picture(page))).not.toBe(rocket)
  await expect(section.getByText("Shows the star icon")).toBeVisible()
  await section.getByRole("searchbox", { name: "Search icons" }).fill("zzzz")
  await expect(section.getByRole("status")).toHaveText("No icon matches. Try another word.")

  await page.getByRole("button", { name: undoCopy.undoNamed.picture, exact: true }).click()
  await expect(section.getByText("Shows the rocket icon")).toBeVisible()
  await page.getByRole("button", { name: undoCopy.redoNamed.picture, exact: true }).click()
  await expect(section.getByText("Shows the star icon")).toBeVisible()
})

test("a shape's Fill takes an icon, which the asset control inside the fill's union swaps", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const shape = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  const fill = await boxFillPanel(page, shape)
  await fill
    .getByRole("group", { name: fillCopy.box, exact: true })
    .getByRole("button", { name: fillWords.image, exact: true })
    .click()
  await expect.poll(() => drawn(shape)).toContain("blob:")
  await expect(fill.getByText("Shows the star icon")).toBeVisible()
  const star = await drawn(shape)
  await fill.getByRole("searchbox", { name: "Search icons" }).fill("leaf")
  await fill.getByRole("button", { name: "leaf", exact: true }).click()
  await expect(fill.getByText("Shows the leaf icon")).toBeVisible()
  await expect.poll(() => drawn(shape)).not.toBe(star)
  await page.getByRole("button", { name: "Undo fill", exact: true }).click()
  await expect(fill.getByText("Shows the star icon")).toBeVisible()
})
