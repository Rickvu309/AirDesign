import { expect, test, type Locator, type Page } from "@playwright/test"
import { openDeck } from "./design-panel"

test.use({ viewport: { width: 1600, height: 1000 } })

const slidePart = "ppt/slides/slide10.xml"

function frame(page: Page, shape: string): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${shape}"]`)
}

function placement(element: Locator): Promise<readonly string[]> {
  return element.evaluate((node: HTMLElement) => [node.style.left, node.style.top, node.style.width, node.style.height])
}

async function connectorPanel(page: Page): Promise<Locator> {
  await page.locator('[data-slide-entry="10"]').click()
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  const line = await frame(page, "26").boundingBox()
  if (line === null) throw new Error("no connector")
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2)
  await expect(page.locator("[data-design-element]")).toHaveAttribute("data-design-element", /\.26$/)
  return page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: "Connector", exact: true }) })
}

test("a site control names each site in plain words, moves the end to the one picked, and Undo puts it back", async ({
  page,
}) => {
  await openDeck(page, "census-updating-spm.pptx")
  const section = await connectorPanel(page)
  const start = section.locator('[data-control="union"]').filter({ hasText: "Start" })
  const end = section.locator('[data-control="union"]').filter({ hasText: "End" })
  await expect(start.getByRole("combobox", { name: "Site", exact: true })).toHaveText(/^Bottom/)
  const site = end.getByRole("combobox", { name: "Site", exact: true })
  await expect(site).toHaveText(/^Top/)
  const before = await placement(frame(page, "26"))

  await site.click()
  await expect(page.getByRole("option")).toHaveText(["Top", "Left", "Bottom", "Right"])
  await page.getByRole("option", { name: "Right", exact: true }).click()
  await expect(site).toHaveText(/^Right/)
  await expect.poll(() => placement(frame(page, "26"))).not.toEqual(before)

  await page.getByRole("button", { name: "Undo connector", exact: true }).click()
  await expect(site).toHaveText(/^Top/)
  await expect.poll(() => placement(frame(page, "26"))).toEqual(before)
  await expect(section).not.toContainText(/Site \d/)
})
