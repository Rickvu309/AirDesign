import { expect, test, type Locator, type Page } from "@playwright/test"
import { openDeck } from "./design-panel"

test.use({ viewport: { width: 1600, height: 1000 } })

const iconKey = "ppt/slides/slide1.xml#5"

function picture(page: Page): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${iconKey}"]`)
}

function drawn(element: Locator): Promise<string> {
  return element.evaluate((node) => getComputedStyle(node).backgroundImage)
}

async function iconPanel(page: Page): Promise<Locator> {
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  await picture(page).click()
  const panel = page.locator("[data-design-element]")
  await expect(panel).toHaveAttribute("data-design-element", /\.5$/)
  return panel.locator("section").filter({ has: page.getByRole("heading", { name: "Picture", exact: true }) })
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

  await page.getByRole("button", { name: "Undo picture", exact: true }).click()
  await expect(section.getByText("Shows the rocket icon")).toBeVisible()
  await page.getByRole("button", { name: "Redo picture", exact: true }).click()
  await expect(section.getByText("Shows the star icon")).toBeVisible()
})

test("a shape's Fill takes an icon, which the asset control inside the fill's union swaps", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  const shape = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await shape.click({ position: { x: 4, y: 4 } })
  const fill = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: "Fill", exact: true }) })
  await fill
    .getByRole("group", { name: "Fill", exact: true })
    .getByRole("button", { name: "Icon", exact: true })
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
