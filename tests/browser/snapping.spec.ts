import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { covers } from "./gesture"
import { test } from "./deck-test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/shapes-added.pptx")
const oval = "ppt/slides/slide1.xml#5"
const emuPerPixel = 15_240

test.use({ viewport: { width: 1470, height: 923 } })

async function corner(page: Page): Promise<{ x: number; y: number }> {
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  return { x: Math.round(slide.x), y: Math.round(slide.y) }
}

async function placed(page: Page): Promise<number[]> {
  return page
    .locator(`[data-slide-paint] [data-canvas-element="${oval}"]`)
    .evaluate((frame: HTMLElement) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
}

async function boxRows(page: Page): Promise<unknown[]> {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(
              (all.result as { property?: string; node?: string; value?: unknown }[])
                .filter((row) => row.property === "box" && row.node === "256.5")
                .map((row) => row.value),
            )
          }
        }
      }),
  )
}

test("a dragged layer snaps to a nearby edge with a red guide, saves the snapped box, and undoes in one step", async ({
  page,
  decks,
}) => {
  covers("move")
  await decks.open(fixture)
  const origin = await corner(page)
  expect(await placed(page)).toEqual([270, 90, 180, 120])
  const press = { x: origin.x + 360, y: origin.y + 150 }
  await page.mouse.move(press.x, press.y)
  await page.mouse.down()
  await page.mouse.move(press.x + 20, press.y + 137, { steps: 6 })
  await expect(page.locator('[data-guides] [data-guide="snap y 225"]')).toHaveCount(1)
  expect(await placed(page)).toEqual([290, 225, 180, 120])
  await page.mouse.up()
  await expect(page.locator("[data-guides]")).toHaveCount(0)
  const snapped = { x: 290 * emuPerPixel, y: 225 * emuPerPixel, cx: 180 * emuPerPixel, cy: 120 * emuPerPixel }
  await expect.poll(() => boxRows(page)).toEqual([snapped])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => placed(page)).toEqual([270, 90, 180, 120])
})

test("holding Control during a drag places the layer where the pointer leaves it, with no guides", async ({
  page,
  decks,
}) => {
  covers("snap-off")
  await decks.open(fixture)
  const origin = await corner(page)
  const press = { x: origin.x + 360, y: origin.y + 150 }
  await page.mouse.move(press.x, press.y)
  await page.mouse.down()
  await page.keyboard.down("Control")
  await page.mouse.move(press.x + 20, press.y + 137, { steps: 6 })
  await expect(page.locator("[data-guides]")).toHaveCount(0)
  expect(await placed(page)).toEqual([290, 227, 180, 120])
  await page.mouse.up()
  await page.keyboard.up("Control")
  const free = { x: 290 * emuPerPixel, y: 227 * emuPerPixel, cx: 180 * emuPerPixel, cy: 120 * emuPerPixel }
  await expect.poll(() => boxRows(page)).toEqual([free])
})

test("holding Alt with a layer selected shows the distances to the layer under the pointer, then to the slide's edges", async ({
  page,
  decks,
}) => {
  covers("measure")
  await decks.open(fixture)
  const origin = await corner(page)
  await page.mouse.click(origin.x + 360, origin.y + 150)
  await expect(page.locator(`[data-slide-paint] [data-selection="256.5"]`)).toHaveCount(1)
  await page.keyboard.down("Alt")
  await page.mouse.move(origin.x + 150, origin.y + 150)
  await expect(page.locator("[data-guides] [data-distance]")).toHaveText(["36"])
  await expect(page.locator('[data-guides] [data-guide="distance x 240 270"]')).toHaveCount(1)
  await page.mouse.move(origin.x + 700, origin.y + 420)
  await expect(page.locator("[data-guides] [data-distance]")).toHaveText(["324", "420", "108", "288"])
  await page.keyboard.up("Alt")
  await expect(page.locator("[data-guides]")).toHaveCount(0)
})
