import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../bin/new-deck.mjs"
import { productCopy, shapeCopy, shortcutCopy } from "../bin/product-copy.mjs"

const part = "ppt/slides/slide1.xml"
const emuPerPoint = 12_700

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const { cookie } = await signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page
    .url()
    .split(/\/deck\//)
    .at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const paint = page.locator("[data-slide-paint]")
  const slide = await paint.boundingBox()
  if (slide === null) throw new Error("no slide")
  const points = slide.width / 960
  const at = (x, y) => ({ x: slide.x + x * points, y: slide.y + y * points })
  const layer = (shape) => paint.locator(`[data-canvas-element="${part}#${shape}"]`)
  const drawing = page.locator("[data-shape-drawing]")
  const shift = shortcutCopy.chord.other.shift
  const alt = shortcutCopy.chord.other.alt
  const drag = async (from, to, steps = 12) => {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps })
  }
  const boxOf = async (shape) => {
    const box = await layer(shape).boundingBox()
    return box === null
      ? null
      : { x: (box.x - slide.x) / points, y: (box.y - slide.y) / points, w: box.width / points, h: box.height / points }
  }

  await paint.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("r")
  await expect(drawing).toHaveAttribute("data-shape-drawing", "box")
  await drag(at(80, 120), at(380, 270))
  await expect(page.locator('[data-shape-drawn="box"]')).toBeVisible()
  await capture("rectangle-drawing")
  await page.mouse.up()
  await expect(layer(2)).toBeVisible()
  await expect(drawing).toHaveCount(0)
  await expect.poll(async () => (await boxOf(2))?.w ?? 0).toBeCloseTo(300, 0)
  note(`R and a drag from 80,120 to 380,270 drew ${JSON.stringify(await boxOf(2))} and the tool went back to Move`)

  await page.keyboard.press("o")
  await page.keyboard.down(shift)
  await drag(at(480, 120), at(640, 200))
  await page.mouse.up()
  await page.keyboard.up(shift)
  await expect(layer(3)).toBeVisible()
  const circle = await boxOf(3)
  expect(Math.abs((circle?.w ?? 0) - (circle?.h ?? 1))).toBeLessThan(1)
  note(`O with Shift drew a circle ${JSON.stringify(circle)}`)

  await page.keyboard.press("l")
  await page.keyboard.down(alt)
  await drag(at(500, 400), at(620, 400))
  await page.mouse.up()
  await page.keyboard.up(alt)
  await expect(layer(4)).toHaveCount(1)
  const line = await boxOf(4)
  expect(line?.x ?? 0).toBeCloseTo(380, 0)
  expect(line?.w ?? 0).toBeCloseTo(240, 0)
  note(`L with Alt drew a line from its centre: ${JSON.stringify(line)}`)

  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.square, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  await expect(drawing).toHaveAttribute("data-shape-drawing", "box")
  const click = at(120, 380)
  await page.mouse.click(click.x, click.y)
  await expect(layer(5)).toBeVisible()
  const clicked = await boxOf(5)
  expect([Math.round(clicked?.x ?? 0), Math.round(clicked?.y ?? 0)]).toEqual([120, 380])
  note(`The Shapes menu's Rectangle and a click placed the default square at the click: ${JSON.stringify(clicked)}`)

  await page.keyboard.press("o")
  await page.keyboard.press("Enter")
  await expect(layer(6)).toBeVisible()
  await expect(drawing).toHaveCount(0)
  note(`O then Enter placed an ellipse without the pointer: ${JSON.stringify(await boxOf(6))}`)
  await capture("shapes-drawn")

  const lineBox = await layer(4).boundingBox()
  if (lineBox === null) throw new Error("no line")
  await page.mouse.click(lineBox.x + lineBox.width / 2, lineBox.y + lineBox.height / 2)
  const end = page.locator('[data-connector-end="end"]')
  await expect(end).toBeVisible()
  const grip = await end.boundingBox()
  if (grip === null) throw new Error("no end grip")
  await drag({ x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }, at(620, 300), 10)
  await expect(layer(4)).toHaveCSS("visibility", "hidden")
  await expect(paint.locator('[data-selection="256.4"]')).toHaveCSS("visibility", "hidden")
  const live = page.locator("[data-connector-aim]")
  await expect(live.locator("[stroke]").first()).toBeVisible()
  await expect(live.locator('[stroke-dasharray="4 3"]')).toHaveCount(0)
  await capture("line-end-dragging")
  note("While its end is dragged the line itself moves in its own stroke, and the resting line is hidden")
  await page.mouse.up()
  await capture("line-end-released")
  await expect(live).toHaveCount(0)
  await expect(layer(4)).toHaveCSS("visibility", "visible")

  const register = (await post(deckRoutes.open, { deck }, cookie)).json.register
  const adds = register.order.filter((command) => command.slide === "element-add").map((command) => command.element.box)
  note(`The server holds ${String(adds.length)} adds: ${JSON.stringify(adds)}`)
  expect(adds).toHaveLength(5)
  expect(adds[0]).toEqual({ x: 80 * emuPerPoint, y: 120 * emuPerPoint, cx: 300 * emuPerPoint, cy: 150 * emuPerPoint })

  const downloading = page.waitForEvent("download")
  const exportName = shortcutCopy.gestures.export
  await page.getByRole("button", { name: exportName, exact: true }).click()
  await expect(page.getByRole("dialog", { name: exportName }).getByRole("button", { name: exportName })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "shape-draw.pptx")
  await (await downloading).saveAs(exported)
  const xml = new TextDecoder().decode((await pptx.readParts(await readFile(exported))).get(part))
  expect(xml).toContain(
    `<a:off x="${String(80 * emuPerPoint)}" y="${String(120 * emuPerPoint)}"/><a:ext cx="${String(300 * emuPerPoint)}" cy="${String(150 * emuPerPoint)}"/>`,
  )
  note("The export writes the drawn rectangle at the box the drag drew")
}
