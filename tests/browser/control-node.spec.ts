import { connectionCopy } from "../../apps/web/src/copy/connection-copy"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { openDeck, settled, unfold } from "./design-panel"
import { importTitleDeck } from "./new-deck"

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
  await unfold(page.locator("[data-design-element]"), connectionCopy.section)
  return page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: connectionCopy.section, exact: true }) })
}

async function attached(row: Locator, end: string, name: string) {
  await row.getByRole("combobox", { name: `${end} shape`, exact: true }).click()
  await row.page().getByRole("option", { name, exact: true }).click()
}

test("a node control names the shape a connector's end attaches to, moves the end to another shape, Undo puts it back, and None leaves the end where the connector's own box draws it", async ({
  page,
}) => {
  await openDeck(page, "census-updating-spm.pptx")
  const section = await connectorPanel(page)
  const start = section.locator('[data-control="union"]').filter({ hasText: "Start" })
  const end = section.locator('[data-control="union"]').filter({ hasText: "End" })
  await expect(start.getByRole("button", { name: "Shape", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(start.getByRole("combobox", { name: "Start shape", exact: true })).toHaveText(/^Content Placeholder 5/)
  await expect(end.getByRole("combobox", { name: "End shape", exact: true })).toHaveText(/^Graphic 14/)
  await expect(end.getByRole("combobox", { name: "End site", exact: true })).toHaveText(/^Top/)
  const before = await placement(frame(page, "26"))

  await attached(end, "End", "Graphic 22")
  await expect(end.getByRole("combobox", { name: "End shape", exact: true })).toHaveText(/^Graphic 22/)
  await expect.poll(() => placement(frame(page, "26"))).not.toEqual(before)
  const moved = await placement(frame(page, "26"))

  await page.getByRole("button", { name: "Undo connector", exact: true }).click()
  await expect.poll(() => placement(frame(page, "26"))).toEqual(before)
  await expect(end.getByRole("combobox", { name: "End shape", exact: true })).toHaveText(/^Graphic 14/)
  await page.getByRole("button", { name: "Redo connector", exact: true }).click()
  await expect.poll(() => placement(frame(page, "26"))).toEqual(moved)

  await end.getByRole("button", { name: "None", exact: true }).click()
  await expect(end.getByRole("combobox", { name: "End shape", exact: true })).toHaveCount(0)
  await expect.poll(() => placement(frame(page, "26"))).toEqual(before)
})

test("a node control reads an imported deck's placeholders as Title and Subtitle, never as their file ids", async ({
  page,
}) => {
  await page.goto("/")
  await importTitleDeck(page)
  await settled(page)
  for (const name of ["Rectangle", "Line"]) {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
  }
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  const line = await page.locator("[data-slide-paint] [data-canvas-line]").last().boundingBox()
  if (line === null) throw new Error("no line")
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2)
  await unfold(page.locator("[data-design-element]"), connectionCopy.section)
  const section = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: connectionCopy.section, exact: true }) })
  await section
    .locator('[data-control="union"]')
    .filter({ hasText: "Start" })
    .getByRole("button", { name: "Shape", exact: true })
    .click()
  await section.getByRole("combobox", { name: "Start shape", exact: true }).click()
  await expect(page.getByRole("option")).toHaveText(["Title", "Subtitle", /^Rectangle/])
})
