import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { colorCopy } from "../../apps/web/src/copy/color-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { entry, fixtures, manySlides, openGrid } from "./slide-grid-deck"
import { decksOn } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const card = (page: Page, number: number) => page.locator("[data-editor-grid] [data-grid-card]").nth(number - 1)
const live = (page: Page) => page.locator("[data-editor-grid] [data-grid-edit]")

async function pictureWords() {
  return (await import("../../apps/web/src/copy/picture-copy.ts")).pictureCopy
}

async function threeSlides(page: Page) {
  await decksOn(page).open({ name: "three.pptx", mimeType: "application/octet-stream", buffer: await manySlides(3) })
}

const tools: Record<string, (page: Page) => Promise<void>> = {
  text: async (page) => {
    await page.getByRole("button", { name: "Add text", exact: true }).click()
  },
  shape: async (page) => {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name: shapeCopy.shapes.square, exact: true }).click()
    await page.keyboard.press("Enter")
  },
  icon: async (page) => {
    const pictureCopy = await pictureWords()
    await page.getByRole("button", { name: pictureCopy.addIcon, exact: true }).click()
    const tool = page.locator("[data-icon-tool]")
    await tool.getByRole("searchbox", { name: pictureCopy.search }).fill("rocket")
    await tool.getByRole("button", { name: "rocket", exact: true }).click()
  },
  picture: async (page) => {
    const pictureCopy = await pictureWords()
    const choosing = page.waitForEvent("filechooser")
    await page.getByRole("button", { name: pictureCopy.add, exact: true }).click()
    await (await choosing).setFiles(join(fixtures, "picture.png"))
  },
}

for (const [tool, insert] of Object.entries(tools)) {
  test(`the ${tool} tool in Grid adds to the selected slide and opens it there`, async ({ page }) => {
    await threeSlides(page)
    await openGrid(page)
    for (const at of [1, 2, 3]) await expect(card(page, at).locator("[data-thumb-node]")).toHaveCount(1)
    await card(page, 2).locator("[data-slide-number]").click()
    await expect(live(page)).toHaveCount(0)
    await insert(page)
    await expect(card(page, 2).locator("[data-grid-edit] [data-canvas-element]")).toHaveCount(2)
    await expect(live(page)).toHaveCount(1)
    await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
    await expect(card(page, 1).locator("[data-thumb-node]")).toHaveCount(1)
    await expect(card(page, 3).locator("[data-thumb-node]")).toHaveCount(1)
  })
}

test("Grid's toolbar offers the shape tray, the icon search and the deck's colours, as Slides view does", async ({
  page,
}) => {
  const pictureCopy = await pictureWords()
  await threeSlides(page)
  const deckSwatches = async () => {
    await page.locator('[contenteditable="true"]').first().dblclick()
    await page.getByRole("button", { name: formatCopy.color, exact: true }).click()
    const swatches = await page.getByRole("group", { name: colorCopy.others, exact: true }).getByRole("button").count()
    await page.keyboard.press("Escape")
    return swatches
  }
  const slidesView = await deckSwatches()
  await openGrid(page)
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: pictureCopy.addIcon, exact: true }).click()
  await expect(page.locator("[data-icon-tool]").getByRole("searchbox", { name: pictureCopy.search })).toBeVisible()
  await page.keyboard.press("Escape")
  await card(page, 1).locator("[data-thumb-node]").first().dblclick({ force: true })
  await page.getByRole("button", { name: formatCopy.color, exact: true }).click()
  await expect(page.getByRole("group", { name: colorCopy.others, exact: true }).getByRole("button")).toHaveCount(
    slidesView,
  )
})
