import { expect, type Page } from "@playwright/test"
import { forward, openClean, signInBrowser, test } from "./api-stack"

const element = "ppt/slides/slide1.xml#2"
const emuPerPixel = 15_240
const thumbScale = 197 / 800
const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }

test.use({ viewport: { width: 1470, height: 923 } })

type Shown = { readonly canvas: readonly number[]; readonly thumb: readonly number[] }

async function shown(page: Page): Promise<Shown> {
  return page.evaluate((key) => {
    const read = (selector: string) => {
      const frame = document.querySelector<HTMLElement>(selector)
      if (frame === null) return []
      return [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) =>
        Number.parseFloat(each),
      )
    }
    return {
      canvas: read(`[data-slide-paint] [data-canvas-element="${key}"]`),
      thumb: read(`[data-slide-list] [data-thumb-element="${key}"]`),
    }
  }, element)
}

function inPixels(box: typeof start): readonly number[] {
  return [box.x, box.y, box.cx, box.cy].map((emu) => emu / emuPerPixel)
}

async function expectShownAt(page: Page, box: typeof start): Promise<void> {
  const now = await shown(page)
  const canvas = inPixels(box)
  expect(now.canvas).toHaveLength(4)
  expect(now.thumb).toHaveLength(4)
  canvas.forEach((pixels, index) => {
    expect(now.canvas[index]).toBeCloseTo(pixels, 3)
    expect(now.thumb[index]).toBeCloseTo(pixels * thumbScale, 3)
  })
}

async function opened(page: Page): Promise<string> {
  const deck = await openClean(page)
  await expect(page.locator(`[data-slide-list] [data-thumb-element="${element}"]`)).toBeAttached()
  return deck
}

async function corner(page: Page): Promise<{ x: number; y: number }> {
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  return { x: Math.round(slide.x), y: Math.round(slide.y) }
}

async function drag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

test("the slide list thumbnail follows a drag, a resize, a nudge and their undo in the same paint", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await opened(page)
  await expectShownAt(page, start)
  const origin = await corner(page)
  await page.locator('[data-slide-paint] [contenteditable="true"]').click()

  await drag(page, { x: origin.x + 300, y: origin.y + 120 }, { x: 30, y: 60 })
  const dragged = { ...start, x: start.x + 30 * emuPerPixel, y: start.y + 60 * emuPerPixel }
  await expectShownAt(page, dragged)

  await drag(page, { x: origin.x + 420, y: origin.y + 210 }, { x: -120, y: 60 })
  const resized = { ...dragged, cx: start.cx - 120 * emuPerPixel, cy: start.cy + 60 * emuPerPixel }
  await expectShownAt(page, resized)

  await expect(page.getByRole("group", { name: "Hello" })).toBeFocused()
  await page.keyboard.press("Shift+ArrowRight")
  const nudged = { ...resized, x: resized.x + 127_000 }
  await expectShownAt(page, nudged)

  await expect(page.getByRole("button", { name: "Undo move" })).toBeEnabled()
  await page.getByRole("button", { name: "Undo move" }).click()
  await expect.poll(async () => (await shown(page)).canvas[0]).toBeCloseTo(resized.x / emuPerPixel, 3)
  await expectShownAt(page, resized)
  await page.getByRole("button", { name: "Undo resize" }).click()
  await expect.poll(async () => (await shown(page)).canvas[2]).toBeCloseTo(start.cx / emuPerPixel, 3)
  await expectShownAt(page, dragged)
  await page.getByRole("button", { name: "Undo move" }).click()
  await expect.poll(async () => (await shown(page)).canvas[0]).toBeCloseTo(start.x / emuPerPixel, 3)
  await expectShownAt(page, start)
})

test("the slide list thumbnail follows a shape an agent moves", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await opened(page)
  await expectShownAt(page, start)
  await expect
    .poll(async () => (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)).index)
    .toBe("ready")
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const change = { op: "set", target: "256.2", box: { x: 144, y: 108 } }
  expect(await stack.callTool("airdesign_edit_deck", { deck, base, changes: [change] }, cookie)).toMatchObject({
    ok: true,
  })
  const moved = { ...start, x: 144 * 12_700, y: 108 * 12_700 }
  await expect.poll(async () => (await shown(page)).canvas[0]).toBeCloseTo(moved.x / emuPerPixel, 3)
  await expectShownAt(page, moved)
})
