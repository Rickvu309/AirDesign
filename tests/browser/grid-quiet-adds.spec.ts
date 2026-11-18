import { expect, test, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { entry, manySlides, openFile, openGrid } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 } })

const adds = "[data-add-gap], [data-add-row]"
const cards = "[data-slide-entry]"

async function open(page: Page, count = 7) {
  await openFile(page, {
    name: "seven-slides.pptx",
    mimeType: "application/octet-stream",
    buffer: await manySlides(count),
  })
  await openGrid(page)
}

async function zoom(page: Page, percent: number) {
  await page.locator("[data-zoom-readout]").click()
  await page.locator("[data-zoom-field]").fill(String(percent))
  await page.keyboard.press("Enter")
}

test("small zoom keeps all three adds out of the pointer and tab paths", async ({ page }) => {
  await open(page)
  for (const percent of [1, 4, 5, 9]) {
    await zoom(page, percent)
    await expect(page.locator(adds)).toHaveCount(0)
    await entry(page, 1).focus()
    await page.keyboard.press("Tab")
    await expect(page.locator(`:focus:is(${adds})`)).toHaveCount(0)
  }
  await zoom(page, 15)
  await expect(page.locator("[data-gap-insert='between']")).toHaveCount(5)
  await expect(page.locator("[data-gap-insert='end']")).toHaveCount(2)
  await expect(page.locator("[data-add-row]")).toHaveCount(2)
})

test("slide centres and corners keep their own hits across the zoom range", async ({ page }) => {
  await open(page)
  for (const percent of [1, 4, 5, 9, 15, 25, 100, 200]) {
    await zoom(page, percent)
    for (let index = 1; index <= 7; index++) {
      const hits = await entry(page, index).evaluate((slide) => {
        const host = slide.closest("[data-grid-viewport]")
        if (!host) throw new Error("grid viewport")
        const box = slide.getBoundingClientRect()
        const room = host.getBoundingClientRect()
        const points = [
          [1, 1],
          [box.width - 1, 1],
          [1, box.height - 1],
          [box.width - 1, box.height - 1],
          [box.width / 2, box.height / 2],
        ]
        const missed = points.filter(([dx, dy]) => {
          let face = slide.getBoundingClientRect()
          const x = face.left + dx
          const y = face.top + dy
          if (x <= room.left || x >= room.right || y <= room.top || y >= room.bottom) {
            host.dispatchEvent(
              new WheelEvent("wheel", {
                deltaX: x - (room.left + room.width / 2),
                deltaY: y - (room.top + room.height / 2),
              }),
            )
            face = slide.getBoundingClientRect()
          }
          const hit = document.elementFromPoint(face.left + dx, face.top + dy)
          return (
            hit?.closest("[data-grid-card]") !== slide.closest("[data-grid-card]") ||
            hit?.closest("[data-add-gap], [data-add-row]") !== null
          )
        })
        const face = slide.getBoundingClientRect()
        return {
          missed,
          overlap: [...host.querySelectorAll("[data-add-gap], [data-add-row]")].some((button) => {
            const hit = button.getBoundingClientRect()
            return (
              Math.min(face.right, hit.right) - Math.max(face.left, hit.left) > 0.02 &&
              Math.min(face.bottom, hit.bottom) - Math.max(face.top, hit.top) > 0.02
            )
          }),
        }
      })
      expect(hits, `slide ${index} at ${percent}%`).toEqual({ missed: [], overlap: false })
    }
  }
})

test("idle Grid and an edited slide leave the add marks quiet", async ({ page }) => {
  await open(page)
  await zoom(page, 25)
  await page.mouse.move(0, 0)
  await expect(page.locator("[data-add-row]").first()).toHaveCSS("opacity", "0")
  await entry(page, 1).focus()
  await page.keyboard.press("Enter")
  const live = page.locator("[data-grid-edit]")
  await live.locator("[data-canvas-element]").first().click()
  await expect(live.locator("[data-selection]")).toBeVisible()
  await expect(page.locator(adds)).toHaveCount(0)
  await live.locator("[data-canvas-element]").first().dblclick()
  await expect(live.locator('[contenteditable="true"]').first()).toBeFocused()
  await expect(page.locator(adds)).toHaveCount(0)
})

test("fit shows the end plus without a clipped preview or a pan", async ({ page }) => {
  await open(page)
  const viewport = page.locator("[data-grid-viewport]")
  const view = () =>
    viewport.evaluate((host) => ({
      left: host.scrollLeft,
      top: host.scrollTop,
      transform: host.querySelector("[data-focus-edge]")?.getAttribute("style"),
    }))
  const before = await view()
  const tail = page.getByRole("button", { name: slideListCopy.addAfter(4), exact: true })
  const box = await tail.boundingBox()
  if (!box) throw new Error("row-end button")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect(tail.locator("[data-add-mark]")).toHaveCSS("width", "24px")
  await expect(page.locator("[data-gap-placeholder]:visible")).toHaveCount(0)
  expect(await view()).toEqual(before)
})

test("a menu, pan and slide drag block every add", async ({ page }) => {
  await open(page)
  await zoom(page, 25)
  const controls = page.locator(adds)
  await entry(page, 1).focus()
  await page.keyboard.press("Shift+F10")
  await expect(page.getByRole("menu")).toBeVisible()
  await expect(controls).toHaveCount(0)
  await page.keyboard.press("Escape")

  await page.locator("[data-zoom-readout]").click()
  await expect(page.getByRole("menu")).toBeVisible()
  await expect(page.locator(`:is(${adds}):visible`)).toHaveCount(0)
  await page.keyboard.press("Escape")

  const first = await entry(page, 1).boundingBox()
  if (!first) throw new Error("slide")
  const x = first.x + first.width / 2
  const y = first.y + first.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down({ button: "middle" })
  await page.mouse.move(x + 20, y + 20)
  await expect(page.locator("[data-grid-viewport]")).toHaveAttribute("data-panning", "true")
  await expect(page.locator(`:is(${adds}):visible`)).toHaveCount(0)
  await page.mouse.up({ button: "middle" })
  await expect(controls).toHaveCount(9)

  await page.locator("[data-slide-number]").first().hover()
  await page.mouse.down()
  await page.mouse.move(x + 100, y + 20, { steps: 5 })
  await expect(page.locator("[data-drag-ghost]")).toBeVisible()
  await expect(controls).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.mouse.up()
})

test("row tint clears in the first frame with slide hover", async ({ page }) => {
  await open(page)
  await zoom(page, 25)
  const first = await entry(page, 1).boundingBox()
  const second = await entry(page, 2).boundingBox()
  if (!first || !second) throw new Error("slide boxes")
  const y = first.y + first.height / 2
  await page.mouse.move((first.x + first.width + second.x) / 2, y)
  const frame = page.locator("[data-grid-row-frame]").first()
  const halo = frame.locator("[data-grid-halo]")
  await expect(halo.first()).toHaveCSS("opacity", "1")
  for (let x = Math.ceil(second.x) - 4; x <= second.x + 12; x += 2) {
    await page.mouse.move(x, y)
    const overlap = await frame.evaluate(
      (row) =>
        new Promise<boolean>((resolve) => {
          const [other, slide] = row.querySelectorAll("[data-grid-halo]")
          if (!other || !slide) throw new Error("row halos")
          requestAnimationFrame(() => {
            const entered =
              other.closest("[data-grid-card]")?.matches(":hover") === false &&
              slide.closest("[data-grid-card]")?.matches(":hover") === true
            resolve(entered && Number(getComputedStyle(other).opacity) > 0)
          })
        }),
    )
    expect(overlap, `pointer x=${x}`).toBe(false)
  }
  await expect(halo.nth(1)).toHaveCSS("opacity", "1")
})
