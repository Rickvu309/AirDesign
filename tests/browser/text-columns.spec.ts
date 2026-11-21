import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { openDeck, unfold } from "./design-panel"
import { shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

type Columns = {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly columns: number
  readonly textLeft: number
  readonly textRight: number
  readonly textTop: number
  readonly textBottom: number
}

const hangingSpace = 16

function columns(shape: Locator): Promise<Columns> {
  return shape.evaluate((node, words) => {
    const frame = node.getBoundingClientRect()
    const lines = [...node.querySelectorAll("[data-paragraph] span")]
      .flatMap((span) => [...span.getClientRects()])
      .filter((line) => line.width > words)
    return {
      left: frame.left,
      right: frame.right,
      top: frame.top,
      bottom: frame.bottom,
      columns: new Set(lines.map((line) => Math.round(line.left))).size,
      textLeft: Math.min(...lines.map((line) => line.left)),
      textRight: Math.max(...lines.map((line) => line.right)),
      textTop: Math.min(...lines.map((line) => line.top)),
      textBottom: Math.max(...lines.map((line) => line.bottom)),
    }
  }, hangingSpace)
}

const middleOf = (top: number, bottom: number) => (top + bottom) / 2

function section(page: Page, name: string): Locator {
  return page.locator("[data-design-element] section").filter({ has: page.getByRole("heading", { name, exact: true }) })
}

test("a text box set to two columns paints two columns inside its width and runs text they cannot hold down below the box, at its anchor", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await shape.click({ position: { x: 4, y: 4 } })
  await unfold(page.locator("[data-design-element]"), "Text box")
  const body = section(page, "Text box")
  const count = body.getByRole("textbox", { name: "Columns", exact: true })
  await count.fill("2")
  await count.press("Enter")
  await expect(count).toHaveValue("2")
  const anchor = body.getByRole("group", { name: "Vertical alignment", exact: true })
  await anchor.getByRole("button", { name: "Middle" }).click()
  await expect
    .poll(async () => {
      const short = await columns(shape)
      return Math.abs(middleOf(short.textTop, short.textBottom) - middleOf(short.top, short.bottom))
    })
    .toBeLessThan(3)
  expect((await columns(shape)).columns).toBe(1)

  await shape.locator('[contenteditable="true"]').focus()
  await page.keyboard.press("Control+End")
  await page.keyboard.type(` ${"The quick brown fox jumps over the lazy dog while the team writes more. ".repeat(8)}`)
  await expect.poll(async () => (await columns(shape)).textBottom).toBeGreaterThan((await columns(shape)).bottom)
  const long = await columns(shape)
  expect(long.columns).toBe(2)
  expect(long.textLeft).toBeGreaterThanOrEqual(long.left)
  expect(long.textRight).toBeLessThanOrEqual(long.right)
  expect(long.textTop).toBeLessThan(long.top)
  expect(Math.abs(middleOf(long.textTop, long.textBottom) - middleOf(long.top, long.bottom))).toBeLessThan(3)

  await page.keyboard.press("Escape")
  const top = anchor.getByRole("button", { name: "Top" })
  await top.click()
  await expect(top).toHaveAttribute("aria-pressed", "true")
  await expect.poll(async () => (await columns(shape)).textTop).toBeGreaterThanOrEqual(long.top)
  const held = await columns(shape)
  expect(held.columns).toBe(2)
  expect(held.textRight).toBeLessThanOrEqual(held.right)
  expect(held.textBottom).toBeGreaterThan(held.bottom)
})
