import { zoomCopy } from "../../apps/web/src/copy/product-copy"
import type { Page } from "@playwright/test"

async function zoomTo(page: Page, percent: number | "fit") {
  await page.locator("[data-zoom-readout]").click()
  if (percent === "fit") await page.getByRole("menuitemradio", { name: zoomCopy.fit, exact: true }).click()
  else {
    await page.getByRole("textbox", { name: zoomCopy.field }).fill(String(percent))
    await page.getByRole("textbox", { name: zoomCopy.field }).press("Enter")
  }
}
import { expect } from "@playwright/test"
import { clean, entry, numberText, openGrid, manySlides } from "./slide-grid-deck"
import { test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test.beforeEach(async ({ page }) => {
  if (process.env.AIRDESIGN_GRID_CPU_RATE !== "4") return
  const device = await page.context().newCDPSession(page)
  await device.send("Emulation.setCPUThrottlingRate", { rate: 4 })
})

test("edits a slide in Grid view and keeps the text after reopening", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  await page.locator("[data-editor-grid] [data-thumb-node]").first().dblclick({ force: true })
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  const text = page.locator('[data-grid-edit] [contenteditable="true"]').first()
  await text.fill("Edited on the grid")
  await text.press("Tab")
  await page.reload()
  await decks.ready()
  await openGrid(page)
  await expect(page.locator("[data-editor-grid] [data-thumb-node]").first()).toHaveText("Edited on the grid")
})

test("keeps slide numbers above the canvas", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  const card = await entry(page, 1).boundingBox()
  const number = await numberText(page.locator("[data-slide-number]").first())
  expect(card).not.toBeNull()
  expect(number.bottom).toBeLessThan(card?.y ?? 0)
})

test("pans beyond the slide layout and zooms without reflowing it", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  const first = await entry(page, 1).boundingBox()
  await page.mouse.move(800, 350)
  await page.mouse.wheel(1600, 1800)
  await expect.poll(async () => (await entry(page, 1).boundingBox())?.x).toBeLessThan(0)
  await expect.poll(async () => (await entry(page, 1).boundingBox())?.y).toBeLessThan(0)
  await page.mouse.wheel(-1600, -1800)
  await expect.poll(async () => (await entry(page, 1).boundingBox())?.x).toBeCloseTo(first?.x ?? 0, 0)
  await page.keyboard.press("ControlOrMeta+Equal")
  await expect.poll(async () => (await entry(page, 1).boundingBox())?.width).toBeGreaterThan(first?.width ?? 0)
})

for (const count of [7, 50]) {
  test(`fits all ${count} slides inside the visible canvas`, async ({ page, decks }) => {
    await decks.open({
      name: "fit.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      buffer: await manySlides(count),
    })
    await openGrid(page)
    const room = await page.locator("[data-grid-viewport]").boundingBox()
    const last = await entry(page, count).boundingBox()
    expect(last!.y + last!.height).toBeLessThan(room!.y + room!.height - 24)
    await zoomTo(page, "fit")
    await expect(entry(page, count)).toBeInViewport()
  })
}
test("keeps chrome constant and numbers visible while they fit", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  const rim = async () =>
    entry(page, 1).evaluate(
      (el) =>
        (Number.parseFloat(getComputedStyle(el).borderRadius) * el.getBoundingClientRect().width) / el.offsetWidth,
    )
  expect(await rim()).toBeGreaterThanOrEqual(2)
  await zoomTo(page, 200)
  expect(await rim()).toBeCloseTo(26, 1)
  await entry(page, 1).focus()
  const focusWidth = await entry(page, 1).evaluate(
    (el) => (Number.parseFloat(getComputedStyle(el).outlineWidth) * el.getBoundingClientRect().width) / el.offsetWidth,
  )
  expect(focusWidth).toBeCloseTo(3, 1)
  await zoomTo(page, 10)
  await expect(page.locator("[data-slide-number]").first()).toBeVisible()
})
test("keeps slide groups fixed across resize and panel changes", async ({ page, decks }) => {
  await page.setViewportSize({ width: 900, height: 923 })
  await decks.open({
    name: "rows.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(7),
  })
  await openGrid(page)
  const row = () =>
    page.evaluate(() =>
      [1, 4].map((number) => document.querySelector(`[data-slide-entry="${number}"]`)!.getBoundingClientRect().y),
    )
  const [first, fourth] = await row()
  expect(fourth).toBeCloseTo(first!)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await zoomTo(page, "fit")
  await expect(entry(page, 7)).toBeInViewport()
  await page.setViewportSize({ width: 1470, height: 923 })
  const [resizedFirst, resizedFourth] = await row()
  expect(resizedFourth).toBeCloseTo(resizedFirst!)
})
test("selects without opening a side panel", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  await entry(page, 1).click()
  await expect(page.locator("[data-editor-panel]")).toHaveCount(0)
})
test("keeps the selected slide visible when menu and keys zoom", async ({ page, decks }) => {
  await decks.open({
    name: "selected.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(7),
  })
  await openGrid(page)
  await entry(page, 7).click()
  await zoomTo(page, 200)
  await expect(entry(page, 7)).toBeInViewport()
  await zoomTo(page, 10)
  await page.keyboard.press("ControlOrMeta+Equal")
  await expect(entry(page, 7)).toBeInViewport()
})

test("centres the occupied slide group including chrome even with one slide", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  const card = await page.locator("[data-grid-card]").boundingBox()
  const room = await page.locator("[data-grid-viewport]").boundingBox()
  const grip = await page.locator("[data-group-handle]").boundingBox()
  const end = await page.locator('[data-gap-insert="end"] [data-add-mark]').boundingBox()
  if (card === null || room === null || grip === null || end === null) throw new Error("row bounds")
  expect(grip.x).toBeGreaterThanOrEqual(48)
  expect(end.x + end.width).toBeLessThanOrEqual(room.x + room.width - 47)
  expect((grip.x + end.x + end.width) / 2).toBeCloseTo(room.x + room.width / 2, 0)
  expect(card.y + card.height / 2).toBeCloseTo(room.y + room.height / 2, 0)
})

test("numbers clear the preceding slide group at fit", async ({ page, decks }) => {
  await decks.open({ name: "numbers.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  const first = await entry(page, 1).boundingBox()
  const fifth = await page.locator("[data-slide-number]").nth(4).boundingBox()
  expect(fifth!.y).toBeGreaterThan(first!.y + first!.height + 4)
})

async function resizedGrid(page: Page, resize: () => Promise<void>) {
  const beforeRoom = (await page.locator("[data-grid-viewport]").boundingBox())!
  const recording = await page.locator("[data-grid-viewport]").evaluateHandle((host) => {
    const positions = () =>
      [...host.querySelectorAll("[data-slide-entry]")].map((entry) => {
        const { x, y, width, height } = entry.getBoundingClientRect()
        return { x, y, width, height }
      })
    const width = host.clientWidth
    const height = host.clientHeight
    return {
      before: positions(),
      resized: new Promise<ReturnType<typeof positions>[]>((resolve) => {
        const observer = new ResizeObserver(() => {
          if (host.clientWidth === width && host.clientHeight === height) return
          observer.disconnect()
          const frames = [positions()]
          const sample = () => {
            frames.push(positions())
            if (frames.length === 13) resolve(frames)
            else requestAnimationFrame(sample)
          }
          requestAnimationFrame(sample)
        })
        observer.observe(host)
      }),
    }
  })
  await resize()
  const result = await recording.evaluate(async ({ before, resized }) => ({ before, frames: await resized }))
  await recording.dispose()
  const afterRoom = (await page.locator("[data-grid-viewport]").boundingBox())!
  return { ...result, beforeRoom, afterRoom }
}

test("refits in the resize paint without moving again on later frames", async ({ page, decks }) => {
  await decks.open({ name: "resize.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  for (const resize of [
    () => page.setViewportSize({ width: 900, height: 923 }),
    () => page.setViewportSize({ width: 1470, height: 923 }),
    () => page.getByRole("button", { name: "Design", exact: true }).click(),
    () => page.getByRole("button", { name: "Design", exact: true }).click(),
  ]) {
    const { before, frames } = await resizedGrid(page, resize)
    expect(frames[0]).not.toEqual(before)
    for (const frame of frames) {
      expect(frame).toEqual(frames[0])
      expect(frame[3]!.y).toEqual(frame[0]!.y)
    }
    await expect(entry(page, 7)).toBeInViewport()
  }
})

test("keeps a chosen zoom and pans only when resize newly clips the working slide", async ({ page, decks }) => {
  await decks.open({ name: "resize.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  await zoomTo(page, 50)
  await entry(page, 7).focus()
  for (const resize of [
    () => page.setViewportSize({ width: 900, height: 923 }),
    () => page.setViewportSize({ width: 1470, height: 923 }),
    () => page.getByRole("button", { name: "Design", exact: true }).click(),
    () => page.getByRole("button", { name: "Design", exact: true }).click(),
  ]) {
    const { before, frames, beforeRoom, afterRoom } = await resizedGrid(page, resize)
    const working = before[6]!
    const right = working.x + working.width
    const visible =
      working.x >= beforeRoom.x &&
      working.y >= beforeRoom.y &&
      right <= beforeRoom.x + beforeRoom.width &&
      working.y + working.height <= beforeRoom.y + beforeRoom.height
    const dx = visible ? Math.max(afterRoom.x - working.x, Math.min(0, afterRoom.x + afterRoom.width - right)) : 0
    const dy = visible
      ? Math.max(afterRoom.y - working.y, Math.min(0, afterRoom.y + afterRoom.height - working.y - working.height))
      : 0
    for (const frame of frames) {
      for (const [index, card] of frame.entries()) {
        expect(card.width).toBeCloseTo(before[index]!.width, 3)
        expect(card.height).toBeCloseTo(before[index]!.height, 3)
        expect(card.x).toBeCloseTo(before[index]!.x + dx, 1)
        expect(card.y).toBeCloseTo(before[index]!.y + dy, 1)
      }
    }
  }
})

test("resize leaves a deliberately panned-off working slide alone", async ({ page, decks }) => {
  await decks.open({ name: "resize.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  await zoomTo(page, 50)
  await entry(page, 7).focus()
  await page.locator("[data-grid-viewport]").dispatchEvent("wheel", { deltaX: 2400, deltaY: 1200 })
  for (const resize of [
    () => page.setViewportSize({ width: 900, height: 923 }),
    () => page.setViewportSize({ width: 1470, height: 923 }),
    () => page.getByRole("button", { name: "Design", exact: true }).click(),
    () => page.getByRole("button", { name: "Design", exact: true }).click(),
  ]) {
    const { before, frames } = await resizedGrid(page, resize)
    for (const frame of frames) expect(frame).toEqual(before)
  }
})

test("typed Grid zoom accepts low values and keeps them after reload", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  for (const percent of [1, 4, 5, 7, 9]) {
    await zoomTo(page, percent)
    await expect(page.locator("[data-zoom-readout]")).toContainText(`${percent}%`)
  }
  await zoomTo(page, 5)
  await page.reload()
  await decks.ready()
  await openGrid(page)
  await expect(page.locator("[data-zoom-readout]")).toContainText("5%")
  await page.keyboard.press("ControlOrMeta+Minus")
  await expect(page.locator("[data-zoom-readout]")).toContainText("1%")
})

test("zoom reveals the whole slide group handle after panning past it", async ({ page, decks }) => {
  await decks.open({
    name: "seven.pptx",
    mimeType: "application/octet-stream",
    buffer: await manySlides(7),
  })
  await openGrid(page)
  const canvas = page.locator("[data-grid-viewport]")
  await canvas.dispatchEvent("wheel", { deltaX: 385 })
  await zoomTo(page, 25)
  await entry(page, 1).hover()
  const grip = await page.locator("[data-group-handle]").first().boundingBox()
  const room = await canvas.boundingBox()
  if (grip === null || room === null) throw new Error("row grip")
  expect(grip.x - room.x).toBeCloseTo(24, 0)
  expect(grip.width).toBeCloseTo(28, 0)
})
