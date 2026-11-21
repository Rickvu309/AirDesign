import { expect, type Locator, type Page } from "@playwright/test"
import { tableCopy } from "../../apps/web/src/copy/table-copy"
import { test } from "./deck-test"
import { openDeck, storedRows } from "./design-panel"
import { holdableDevice, holdDevice, openDevice } from "./slow-device"

type PendingRow = {
  readonly kind: string
  readonly order?: number
  readonly node?: string
  readonly slideEdit?: { readonly slide?: string; readonly element?: { readonly node?: string } }
}

async function rowsBeforeTheirInsert(page: Page): Promise<string[]> {
  const rows = ((await storedRows(page)) as PendingRow[])
    .filter((row) => row.kind === "pending")
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
  const added = new Map<string, number>()
  rows.forEach((row, at) => {
    const node = row.slideEdit?.slide === "element-add" ? row.slideEdit.element?.node : undefined
    if (node !== undefined) added.set(node, at)
  })
  return rows.flatMap((row, at) =>
    row.node !== undefined && (added.get(row.node) ?? -1) > at ? [`${String(row.order)} ${row.node}`] : [],
  )
}

test.beforeEach(async ({ page }) => {
  await holdableDevice(page)
})

async function blankSlide(page: Page): Promise<{ readonly paint: Locator; readonly layers: Locator }> {
  await openDeck(page, "blank.pptx")
  const paint = page.locator("[data-slide-paint]")
  await paint.click({ position: { x: 4, y: 4 } })
  return { paint, layers: paint.locator("[data-canvas-element]") }
}

async function insertShape(page: Page, layers: Locator, count: number): Promise<void> {
  await page.keyboard.press("r")
  await page.keyboard.press("Enter")
  await expect(layers).toHaveCount(count)
}

test("words typed into a table inserted while an earlier insert is still storing stay with it after a reload", async ({
  page,
  decks,
}) => {
  const { paint, layers } = await blankSlide(page)
  const before = await layers.count()
  await holdDevice(page)
  await insertShape(page, layers, before + 1)
  await page.getByRole("button", { name: tableCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: tableCopy.sizeOf(2, 2), exact: true }).click()
  const table = paint.locator("[data-canvas-table]")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  await page.keyboard.type("Region")
  await page.keyboard.press("Escape")
  await openDevice(page)
  await decks.ready()
  expect(await rowsBeforeTheirInsert(page)).toEqual([])
  await page.reload()
  await decks.ready()
  await expect(layers).toHaveCount(before + 2)
  await expect(table.locator('[data-table-cell="0.0"]')).toContainText("Region")
})

test("a shape dragged while its insert waits behind an earlier one keeps the place it was dragged to", async ({
  page,
  decks,
}) => {
  const { layers } = await blankSlide(page)
  const before = await layers.count()
  await holdDevice(page)
  await insertShape(page, layers, before + 1)
  await insertShape(page, layers, before + 2)
  const dragged = layers.last()
  const start = await dragged.boundingBox()
  if (start === null) throw new Error("not painted")
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 120, start.y + start.height / 2 + 80, { steps: 6 })
  await page.mouse.up()
  await openDevice(page)
  await decks.ready()
  expect(await rowsBeforeTheirInsert(page)).toEqual([])
  const moved = await dragged.boundingBox()
  expect(Math.round((moved?.x ?? 0) - start.x)).toBe(120)
  await page.reload()
  await decks.ready()
  await expect(layers).toHaveCount(before + 2)
  await expect.poll(async () => Math.round(((await layers.last().boundingBox())?.x ?? 0) - start.x)).toBe(120)
})
