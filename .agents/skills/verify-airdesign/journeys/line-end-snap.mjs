import path from "node:path"
import { expect } from "@playwright/test"
import { shortcutCopy } from "../bin/product-copy.mjs"

const part = "ppt/slides/slide1.xml"
const emuPerPixel = 15_240
const slideWidth = 12_192_000
const shift = shortcutCopy.chord.other.shift

function lastEndBox(register, node) {
  const rows = register?.elements?.[node]?.landed ?? []
  const box = rows.filter((row) => row.visible && row.patch?.box !== undefined).at(-1)?.patch.box ?? null
  return box === null ? null : { x: box.x.set, y: box.y.set, w: box.w.set, h: box.h.set }
}

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("./")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().match(/\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const canvas = page.locator("[data-slide-paint]")
  const guide = (name) => page.locator(`[data-guides] [data-guide="${name}"]`)
  const preview = page.locator("[data-connector-aim]")
  const previewEnds = async () => ((await preview.getAttribute("data-ends")) ?? "").split(" ")
  const previewEnd = async () => (await previewEnds()).slice(2)
  const previewStart = async () => (await previewEnds()).slice(0, 2)
  const point = async (x, y) => {
    const paint = await canvas.boundingBox()
    if (paint === null) throw new Error("no slide")
    const scale = paint.width / slideWidth
    return { x: paint.x + x * emuPerPixel * scale, y: paint.y + y * emuPerPixel * scale }
  }
  const saved = async () => lastEndBox((await post(deckRoutes.open, { deck }, cookie)).json.register, "256.6")

  const middle = await point(420, 300)
  await page.mouse.click(middle.x, middle.y)
  const grip = page.locator('[data-connector-end="end"]')
  await expect(grip).toBeVisible()
  note("imported shapes-added.pptx; the line runs from 300,300 to 540,300 and the ellipse's right edge is at x 450")

  const end = await point(540, 300)
  await page.mouse.move(end.x, end.y)
  await page.mouse.down()
  const nearEdge = await point(452, 303)
  await page.mouse.move(nearEdge.x, nearEdge.y, { steps: 8 })
  await expect(guide("snap x 450")).toHaveCount(1)
  await expect(guide("snap y 300")).toHaveCount(1)
  await expect.poll(previewEnd).toEqual(["450", "300"])
  await capture("line-end-snap-held")
  note(
    "dragging the end to 452,303 snapped it to the ellipse's right edge at x 450 and to the other end's height at y 300, with two red snap guides",
  )

  await page.keyboard.down("Control")
  await expect(page.locator("[data-guides]")).toHaveCount(0)
  await expect.poll(previewEnd).toEqual(["452", "303"])
  await capture("line-end-control-held")
  note("holding Control let the end go back under the pointer at 452,303 and the guides went")
  await page.keyboard.up("Control")
  await expect(guide("snap x 450")).toHaveCount(1)

  await page.keyboard.down(shift)
  const slanted = await point(600, 318)
  await page.mouse.move(slanted.x, slanted.y, { steps: 8 })
  await expect.poll(previewEnd).toEqual(["600", "300"])
  expect(await previewStart()).toEqual(["300", "300"])
  await capture("line-end-shift-held")
  note("with Shift held, the pointer at 600,318 kept the line level: the end sits at 600,300")

  const diagonal = await point(410, 205)
  await page.mouse.move(diagonal.x, diagonal.y, { steps: 8 })
  await expect.poll(previewEnd).toEqual(["400", "200"])
  await expect(guide("snap x 400")).toHaveCount(1)
  await capture("line-end-shift-diagonal")
  note(
    "with Shift held, the pointer at 410,205 held the line at 45 degrees, and the end slid along that ray to the slide's centre line at x 400, landing on 400,200",
  )

  await page.mouse.move(slanted.x, slanted.y, { steps: 8 })
  await expect.poll(previewEnd).toEqual(["600", "300"])
  await page.mouse.up()
  await page.keyboard.up(shift)
  await expect(page.locator("[data-guides]")).toHaveCount(0)
  await expect(page.locator("[data-connector-aim]")).toHaveCount(0)
  const level = { x: 300 * emuPerPixel, y: 300 * emuPerPixel, w: 300 * emuPerPixel, h: 0 }
  await expect.poll(saved, { timeout: 20_000 }).toEqual(level)
  note(`on release the server's last box row for the line is ${JSON.stringify(level)}: level, 300 px long`)
}
