import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { openRegister } from "../../packages/document/src/index.ts"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const clean = join(fixtures, "clean.pptx")
const element = "ppt/slides/slide1.xml#2"
const emuPerPixel = 15_240
const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }

type Row = { kind: string; property?: string; value: unknown; node?: string }

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function open(page: Page, file: string): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
}

async function rowsOf(page: Page): Promise<Row[]> {
  return page.evaluate(
    () =>
      new Promise<Row[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(
              (all.result as unknown[]).filter(
                (row) => typeof row === "object" && row !== null && "kind" in row,
              ) as Row[],
            )
          }
        }
      }),
  )
}

async function boxRows(page: Page): Promise<string[]> {
  return (await rowsOf(page))
    .filter((row) => row.property === "box")
    .map((row) => `${row.kind}:${row.node}:${JSON.stringify(row.value)}`)
}

async function corner(page: Page): Promise<{ x: number; y: number }> {
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  return { x: Math.round(slide.x), y: Math.round(slide.y) }
}

async function placed(page: Page): Promise<number[]> {
  return page
    .locator(`[data-canvas-element="${element}"]`)
    .evaluate((frame: HTMLElement) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
}

async function drag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

async function answerOpens(page: Page): Promise<void> {
  await page.route("**/decks/{open,index}", async (route) => {
    const body = route.request().postDataJSON() as { deck: string }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, deck: body.deck, revision: 0, register: openRegister("", "") }),
    })
  })
}

async function answerCommits(page: Page): Promise<unknown[]> {
  const sent: unknown[] = []
  await page.unroute("**/decks/commit")
  let revision = 0
  await page.route("**/decks/commit", async (route) => {
    const body = route.request().postDataJSON() as { deck: string; batch: unknown[] }
    sent.push(...body.batch)
    revision += 1
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, deck: body.deck, revision, key: `${body.deck}:${revision}` }),
    })
  })
  return sent
}

const moved = { ...start, x: start.x + 30 * emuPerPixel, y: start.y + 60 * emuPerPixel }

test.use({ viewport: { width: 1600, height: 1000 } })

test("a click selects an element with a frame and four handles, and the empty slide or Escape clears it", async ({
  page,
}) => {
  await open(page, clean)
  const text = page.locator('[contenteditable="true"]')
  const frame = page.getByRole("group", { name: "Hello" })
  await expect(page.locator("[data-selection]")).toHaveCount(0)
  await text.click()
  await expect(text).toBeFocused()
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await expect(page.locator("[data-grip]:not([data-grip=move])")).toHaveCount(4)
  await page.keyboard.press("Escape")
  await expect(frame).toBeFocused()
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-selection]")).toHaveCount(0)
  await text.click()
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  const origin = await corner(page)
  await page.mouse.click(origin.x + 700, origin.y + 400)
  await expect(page.locator("[data-selection]")).toHaveCount(0)
  await expect(text).not.toBeFocused()
})

test("typing still goes into the text after the element is selected and nudged", async ({ page }) => {
  await open(page, clean)
  const text = page.locator('[contenteditable="true"]')
  await text.click()
  await page.keyboard.press("Escape")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Enter")
  await page.keyboard.press("End")
  await page.keyboard.type("!", { delay: 50 })
  await expect(text).toHaveText("Hello!")
  await expect.poll(() => boxRows(page)).toHaveLength(1)
})

test("a drag follows the pointer, keeps one box edit when it ends, and the box stays after reload", async ({
  page,
}) => {
  await open(page, clean)
  const origin = await corner(page)
  await page.locator('[contenteditable="true"]').click()
  const press = { x: origin.x + 300, y: origin.y + 150 }
  await page.mouse.move(press.x, press.y)
  await page.mouse.down()
  await page.mouse.move(press.x + 15, press.y + 30, { steps: 4 })
  expect(await placed(page)).toEqual([45, 60, 360, 120])
  await page.mouse.move(press.x + 30, press.y + 60, { steps: 4 })
  expect(await placed(page)).toEqual([60, 90, 360, 120])
  expect(await boxRows(page)).toEqual([])
  await page.mouse.up()
  await expect.poll(() => boxRows(page)).toEqual([`pending:256.2:${JSON.stringify(moved)}`])
  await page.reload()
  await settled(page)
  expect(await placed(page)).toEqual([60, 90, 360, 120])
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
})

test("a corner handle resizes, the arrows nudge, and Shift nudges ten times as far", async ({ page }) => {
  await open(page, clean)
  const origin = await corner(page)
  await page.locator('[contenteditable="true"]').click()
  await drag(page, { x: origin.x + 390, y: origin.y + 150 }, { x: -120, y: 60 })
  expect(await placed(page)).toEqual([30, 30, 240, 180])
  await expect(page.getByRole("group", { name: "Hello" })).toBeFocused()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Shift+ArrowDown")
  const resized = { ...start, cx: 3_657_600, cy: 2_743_200 }
  const nudged = { ...resized, x: start.x + 12_700, y: start.y + 127_000 }
  await expect.poll(() => boxRows(page)).toEqual([`pending:256.2:${JSON.stringify(nudged)}`])
  await page.reload()
  await settled(page)
  const shown = await placed(page)
  ;[nudged.x, nudged.y, nudged.cx, nudged.cy].forEach((emu, index) =>
    expect(shown[index]).toBeCloseTo(emu / emuPerPixel, 3),
  )
})

test("a move made offline is kept on the device and sent when the page comes back online", async ({
  page,
  context,
}) => {
  await answerOpens(page)
  await open(page, clean)
  await page.route("**/decks/commit", (route) => route.abort("internetdisconnected"))
  await context.setOffline(true)
  const origin = await corner(page)
  await page.locator('[contenteditable="true"]').click()
  await drag(page, { x: origin.x + 300, y: origin.y + 150 }, { x: 30, y: 60 })
  expect(await placed(page)).toEqual([60, 90, 360, 120])
  await expect.poll(() => boxRows(page)).toEqual([`pending:256.2:${JSON.stringify(moved)}`])
  await expect(page.getByText("You're offline. Edits are saved on this device.")).toBeVisible()
  const sent = await answerCommits(page)
  await context.setOffline(false)
  await expect.poll(() => boxRows(page)).toEqual([`confirmed:256.2:${JSON.stringify(moved)}`])
  expect(sent).toEqual([{ node: "256.2", property: "box", value: moved, floor: expect.any(String) }])
})

test("text inside a group can be typed in but shows no handles and does not move", async ({ page }) => {
  await open(page, join(fixtures, "census-updating-spm.pptx"))
  await page.locator('[data-slide-entry="5"]').click()
  const text = page.locator('[contenteditable="true"]').filter({ hasText: /^2026$/ })
  await expect(text).toHaveCount(1)
  await text.click()
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await expect(page.locator("[data-grip]")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowDown")
  expect(await boxRows(page)).toEqual([])
})

test("Tab reaches the slide number, which can move, and then the empty unfilled box the pointer passes through", async ({
  page,
}) => {
  await open(page, join(fixtures, "doe-heat-pumps.pptx"))
  await page.locator('[data-slide-entry="29"]').click()
  const slide = "ppt/slides/slide29.xml"
  const title = page.locator(`[data-canvas-element="${slide}#2"] [contenteditable="true"]`)
  const point = await title.evaluate((box) => {
    const range = box.ownerDocument.createRange()
    range.selectNodeContents(box)
    const words = range.getBoundingClientRect()
    return { x: words.x + words.width / 2, y: words.y + words.height / 2 }
  })
  await page.mouse.click(point.x, point.y)
  await expect(title).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("group", { name: "29" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(page.locator(`[data-canvas-element="${slide}#4"] [contenteditable="true"]`)).toBeFocused()
})

test("a picture moves by a drag anywhere on it and keeps the arrows once selected", async ({ page }) => {
  await open(page, join(fixtures, "doe-heat-pumps.pptx"))
  await page.locator('[data-slide-entry="4"]').click()
  const picture = page.locator('[data-canvas-element="ppt/slides/slide4.xml#6"]')
  await expect(picture).toHaveAttribute(
    "aria-label",
    "A picture containing object, clock\n\nDescription automatically generated",
  )
  const before = await picture.evaluate((frame: HTMLElement) =>
    [frame.style.left, frame.style.top].map(Number.parseFloat),
  )
  const origin = await corner(page)
  await drag(page, { x: origin.x + 100, y: origin.y + 300 }, { x: 20, y: 10 })
  await expect(picture).toBeFocused()
  await page.keyboard.press("ArrowLeft")
  const after = await picture.evaluate((frame: HTMLElement) =>
    [frame.style.left, frame.style.top].map(Number.parseFloat),
  )
  expect(after[0]).toBeCloseTo((before[0] ?? 0) + 20 - 12_700 / 11_430, 3)
  expect(after[1]).toBeCloseTo((before[1] ?? 0) + 10, 3)
  await expect.poll(async () => (await boxRows(page)).length).toBe(1)
})

const pictured = "ppt/slides/slide4.xml#6"

async function dragAndPressAtOnce(page: Page, from: { x: number; y: number }, by: { x: number; y: number }) {
  await page.evaluate(
    ({ id, start, step }) => {
      const frame = document.querySelector<HTMLElement>(`[data-canvas-element="${id}"]`)
      if (frame === null) throw new Error("no frame")
      const options = { bubbles: true, cancelable: true, pointerId: 1, button: 0, isPrimary: true }
      frame.dispatchEvent(new PointerEvent("pointerdown", { ...options, clientX: start.x, clientY: start.y }))
      const end = { clientX: start.x + step.x, clientY: start.y + step.y }
      document.dispatchEvent(new PointerEvent("pointermove", { ...options, ...end }))
      document.dispatchEvent(new PointerEvent("pointerup", { ...options, ...end, buttons: 0 }))
      frame.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }))
    },
    { id: pictured, start: from, step: by },
  )
}

test("a nudge made as a drag lands is kept when the drag's own commit paints after it", async ({ page }) => {
  await answerOpens(page)
  await open(page, join(fixtures, "doe-heat-pumps.pptx"))
  await page.locator('[data-slide-entry="4"]').click()
  const picture = page.locator(`[data-canvas-element="${pictured}"]`)
  const left = () => picture.evaluate((frame: HTMLElement) => Number.parseFloat(frame.style.left))
  const before = await left()
  await answerCommits(page)
  const dragSent = page.waitForRequest((request) => request.url().endsWith("/decks/commit"))
  await dragAndPressAtOnce(page, { x: 100, y: 100 }, { x: 20, y: 10 })
  await dragSent
  await expect.poll(left).toBeCloseTo(before + 20 - 12_700 / 11_430, 3)
  await page.keyboard.up("ArrowLeft")
  await expect.poll(() => boxRows(page)).toHaveLength(2)
  await expect.poll(left).toBeCloseTo(before + 20 - 12_700 / 11_430, 3)
})
