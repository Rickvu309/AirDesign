import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const clean = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }

type Row = { kind: string; property?: string; value: unknown; node?: string }

async function openClean(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(clean)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function boxRows(page: Page): Promise<string[]> {
  const rows = await page.evaluate(
    () =>
      new Promise<Row[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const all = request.result.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            request.result.close()
            resolve((all.result as unknown[]).filter((row) => typeof row === "object" && row !== null) as Row[])
          }
        }
      }),
  )
  return rows.filter((row) => row.property === "box").map((row) => `${row.node}:${JSON.stringify(row.value)}`)
}

async function slideBox(page: Page) {
  const box = await page.locator("[data-slide-paint]").boundingBox()
  if (box === null) throw new Error("no slide")
  return box
}

async function scrolled(page: Page): Promise<{ left: number; top: number }> {
  return page
    .locator("[data-canvas-stage]")
    .evaluate((stage) => ({ left: Math.round(stage.scrollLeft), top: Math.round(stage.scrollTop) }))
}

async function zoomTo(page: Page, step: string): Promise<void> {
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: step, exact: true }).click()
  await expect(page.getByRole("menu")).toHaveCount(0)
}

test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" })

test("the tools that do nothing yet are disabled, the grid toggle too, and Actions offers only Table", async ({
  page,
}) => {
  await openClean(page)
  for (const name of ["shape", "Grid"]) {
    await expect(page.getByRole("button", { name, exact: true }), name).toBeDisabled()
  }
  await expect(page.getByRole("button", { name: "Add text box", exact: true })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Add picture", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  await expect(page.getByRole("menuitem", { name: "Table", exact: true })).toBeEnabled()
  await expect(page.getByRole("menuitem")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Move", exact: true })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Move", exact: true })).toHaveAttribute("aria-pressed", "true")
  const look = await page
    .getByRole("button", { name: "shape", exact: true })
    .evaluate((tool) => [getComputedStyle(tool).opacity, getComputedStyle(tool).pointerEvents])
  expect(look).toEqual(["0.5", "none"])
})

test("the tool menu lists Move and Hand with their keys, and Hand pans the zoomed canvas without moving a box", async ({
  page,
}) => {
  await openClean(page)
  await page.getByRole("button", { name: "Tools" }).click()
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  await expect(page.getByRole("menuitemradio", { name: "Move" })).toHaveAttribute("aria-checked", "true")
  await expect(page.getByRole("menuitemradio", { name: "Hand tool" })).toHaveAttribute("aria-checked", "false")
  expect((await menu.innerText()).split(/\s+/)).toEqual(["Move", "V", "Hand", "tool", "H"])
  const motions = await page.evaluate(() =>
    document.getAnimations().map((animation) => animation.effect?.getComputedTiming().duration ?? 0),
  )
  expect(motions.filter((duration) => duration !== 0)).toEqual([])
  await page.getByRole("menuitemradio", { name: "Hand tool" }).click()
  await expect(page.getByRole("button", { name: "Hand tool", exact: true })).toHaveAttribute("aria-pressed", "true")

  await zoomTo(page, "200%")
  expect((await slideBox(page)).width).toBe(2560)
  const before = await scrolled(page)
  await page.mouse.move(700, 450)
  await page.mouse.down()
  await page.mouse.move(600, 400, { steps: 6 })
  await page.mouse.up()
  expect(await scrolled(page)).toEqual({ left: before.left + 100, top: before.top + 50 })
  await expect(page.locator("[data-selection]")).toHaveCount(0)
  expect(await boxRows(page)).toEqual([])
})

test("V and H pick the tool, but not while typing in a text box", async ({ page }) => {
  await openClean(page)
  const text = page.locator('[contenteditable="true"]')
  await text.click()
  await page.keyboard.press("End")
  await page.keyboard.type("h", { delay: 50 })
  await expect(text).toHaveText("Helloh")
  await expect(page.getByRole("button", { name: "Move", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await page.keyboard.press("h")
  await expect(page.getByRole("button", { name: "Hand tool", exact: true })).toBeVisible()
  await page.keyboard.press("v")
  await expect(page.getByRole("button", { name: "Move", exact: true })).toBeVisible()
})

test("zoom fits by default, each step sets the slide width, and a drag at another zoom lands on the exact EMU", async ({
  page,
}) => {
  await openClean(page)
  await expect(page.locator("[data-zoom-readout]")).toHaveText("63%")
  expect((await slideBox(page)).width).toBe(800)
  await zoomTo(page, "100%")
  await expect(page.locator("[data-zoom-readout]")).toHaveText("100%")
  expect((await slideBox(page)).width).toBe(1280)
  await zoomTo(page, "63%")
  expect((await slideBox(page)).width).toBe(800)
  await zoomTo(page, "50%")
  const slide = await slideBox(page)
  expect(slide.width).toBe(640)
  await page.locator('[contenteditable="true"]').click()
  const press = { x: slide.x + 240, y: slide.y + 120 }
  await page.mouse.move(press.x, press.y)
  await page.mouse.down()
  await page.mouse.move(press.x + 30, press.y + 60, { steps: 8 })
  await page.mouse.up()
  const perPixel = 12_192_000 / 640
  const moved = { ...start, x: start.x + 30 * perPixel, y: start.y + 60 * perPixel }
  await expect.poll(() => boxRows(page)).toEqual([`256.2:${JSON.stringify(moved)}`])
})
