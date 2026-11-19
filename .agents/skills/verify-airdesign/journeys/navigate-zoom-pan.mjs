import path from "node:path"
import { expect } from "@playwright/test"

const node = "256.2"
const slideWide = 12_192_000
const slideTall = 6_858_000
const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const middle = { x: (start.x + start.cx / 2) / slideWide, y: (start.y + start.cy / 2) / slideTall }

function lastBox(register) {
  const rows = register?.elements?.[node]?.landed ?? []
  return rows.filter((row) => row.visible && row.property === "box").at(-1)?.value ?? null
}

async function slideBox(page) {
  return page.locator("[data-slide-paint]").boundingBox()
}

async function percent(page) {
  return Number.parseFloat((await page.locator("[data-zoom-readout]").textContent()) ?? "")
}

async function scrolled(page) {
  return page.locator("[data-canvas-stage]").evaluate((stage) => ({ left: stage.scrollLeft, top: stage.scrollTop }))
}

async function zoomWheel(page, at, turns) {
  await page.mouse.move(at.x, at.y)
  await page.keyboard.down("Control")
  for (let turn = 0; turn < turns; turn++) await page.mouse.wheel(0, -100)
  await page.keyboard.up("Control")
}

async function selectionInView(page) {
  return page.evaluate(() => {
    const stage = document.querySelector("[data-canvas-stage]").getBoundingClientRect()
    const overlay = document.querySelector("[data-canvas-overlay]").getBoundingClientRect()
    const frame = document.querySelector("[data-selection]").getBoundingClientRect()
    return {
      dx: frame.left + frame.width / 2 - (stage.left + stage.width / 2),
      dy: frame.top + frame.height / 2 - (stage.top + (overlay.top - stage.top) / 2),
      margin: stage.width - frame.width,
    }
  })
}

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  const fit = await percent(page)
  const before = await slideBox(page)
  await capture("fit")
  note(`imported clean.pptx as deck ${deck}; slide view opens at zoom to fit, ${fit}%`)

  const cursor = {
    x: Math.round(before.x + middle.x * before.width),
    y: Math.round(before.y + middle.y * before.height),
  }
  await zoomWheel(page, cursor, 5)
  await expect.poll(() => percent(page)).toBeGreaterThan(fit * 1.5)
  const zoomed = await slideBox(page)
  const drift = {
    x: zoomed.x + middle.x * zoomed.width - cursor.x,
    y: zoomed.y + middle.y * zoomed.height - cursor.y,
  }
  expect(Math.abs(drift.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(drift.y)).toBeLessThanOrEqual(1)
  await capture("zoomed-about-cursor")
  note(
    `Ctrl+scroll over the text box's middle zoomed ${fit}% to ${await percent(page)}%; that point stayed under the cursor (drift ${drift.x.toFixed(2)}, ${drift.y.toFixed(2)} px)`,
  )

  const panFrom = await scrolled(page)
  await page.keyboard.down("Space")
  await expect(page.locator("[data-hand-pan]")).toBeVisible()
  await page.mouse.move(cursor.x, cursor.y)
  await page.mouse.down()
  await page.mouse.move(cursor.x - 120, cursor.y - 60, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up("Space")
  await expect(page.locator("[data-hand-pan]")).toHaveCount(0)
  const panTo = await scrolled(page)
  expect(Math.round(panTo.left - panFrom.left)).toBe(120)
  expect(Math.round(panTo.top - panFrom.top)).toBe(60)
  await capture("panned")
  note("holding Space and dragging by -120,-60 px moved the view by 120,60 px and moved nothing on the slide")

  await page.locator('[contenteditable="true"]').click()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await page.keyboard.press("Shift+Digit2")
  await expect.poll(async () => Math.round((await selectionInView(page)).margin)).toBeLessThanOrEqual(100)
  const fitted = await selectionInView(page)
  expect(Math.abs(fitted.dx)).toBeLessThanOrEqual(1)
  expect(Math.abs(fitted.dy)).toBeLessThanOrEqual(1)
  await capture("zoom-to-selection")
  note(
    `Shift+2 zoomed to ${await percent(page)}%: the selected text box fills the canvas 48 px in from its sides and sits in its middle (off by ${fitted.dx.toFixed(2)}, ${fitted.dy.toFixed(2)} px)`,
  )

  await page.keyboard.press("Shift+Digit1")
  await expect.poll(() => percent(page)).toBe(fit)
  expect((await slideBox(page)).width).toBe(before.width)
  await capture("back-to-fit")
  note(`Shift+1 went back to zoom to fit, ${fit}%, the slide ${before.width} px wide again`)

  await zoomWheel(page, cursor, 3)
  await expect.poll(() => percent(page)).toBeGreaterThan(fit)
  const slide = await slideBox(page)
  const grip = { x: slide.x + slide.width * 0.3, y: slide.y + (slide.height * (start.y + start.cy)) / slideTall }
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(grip.x + 40, grip.y + 70, { steps: 8 })
  await page.mouse.up()
  const perPixel = slideWide / slide.width
  const wanted = { x: start.x + 40 * perPixel, y: start.y + 70 * perPixel }
  let kept = null
  await expect
    .poll(
      async () => {
        kept = lastBox((await post(deckRoutes.open, { deck }, cookie)).json.register)
        return kept !== null && Math.abs(kept.x - wanted.x) <= perPixel && Math.abs(kept.y - wanted.y) <= perPixel
      },
      { timeout: 20_000 },
    )
    .toBe(true)
  await capture("dragged-at-zoom")
  note(
    `at ${await percent(page)}% a drag of the frame's bottom edge by 40,70 px saved the box at ${kept.x},${kept.y} EMU on the server (${deckRoutes.open.path}); the pointer says ${Math.round(wanted.x)},${Math.round(wanted.y)}, within one pixel of ${Math.round(perPixel)} EMU`,
  )
}
