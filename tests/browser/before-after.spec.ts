import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { fillCopy } from "../../apps/web/src/copy/fill-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { creditsCopy } from "../../apps/web/src/copy/credits-copy"

type Box = { x: number; y: number; width: number; height: number }
type Callout = { at: string; note: string }
type Block = { state: string; title: string; crop: string | null; click: string[]; callouts: Callout[] }
type Shot = { full: Buffer; frame: Box; boxes: (Box | null)[] }
type Side = { key: string; label: string; missing: string }
type Composer = {
  composeBlock: (block: Block, sides: Side[], shots: Shot[]) => { block: unknown }
  clickEach: (page: Page, selectors: string[]) => Promise<string[]>
}
type Drawer = { blockHtml: (block: unknown) => string; pageHtml: (articles: string[], css: string) => string }

const look = join(process.cwd(), ".agents/skills/verify-airdesign/look")
const load = async <T>(name: string) => (await import(pathToFileURL(join(look, name)).href)) as T

test("verification states share copy after a spec loads it through CommonJS", async () => {
  expect(creditsCopy.add).toBeTruthy()
  const { states } = await load<{ states: { name: string }[] }>("states.mjs")
  const copy = await load<{
    productCopy: typeof productCopy
    undoCopy: typeof undoCopy
    creditsCopy: typeof creditsCopy
  }>("../bin/product-copy.mjs")
  expect(copy.productCopy).toBe(productCopy)
  expect(copy.undoCopy).toBe(undoCopy)
  expect(copy.creditsCopy).toBe(creditsCopy)
  for (const name of ["deck-list-trash", "sign-in-pages", "aira-panel"]) {
    const journey = await load<{ default: unknown }>(`../journeys/${name}.mjs`)
    expect(journey.default).toBeInstanceOf(Function)
  }
  expect(states.some((state) => state.name === "decks-all")).toBe(true)
})

test("verification states load after a spec reads fill copy through CommonJS", async () => {
  expect(fillCopy.reset).toBeTruthy()
  const { states } = await load<{ states: { name: string }[] }>("states.mjs")
  expect(states.some((state) => state.name === "design-border")).toBe(true)
})

const fixture = `<body style="margin:0;font:16px sans-serif">
<button id="save" style="position:absolute;left:40px;top:30px;width:90px;height:32px">Save</button>
<p id="note" style="position:absolute;left:600px;top:400px;margin:0;width:300px">A sentence in the middle of the page.</p>
<div id="edge" style="position:absolute;left:1400px;top:880px;width:60px;height:36px;background:silver"></div>
<div id="wide" style="position:absolute;left:0;top:200px;width:1470px;height:40px;background:gainsboro"></div></body>`

const targets = ["#save", "#note", "#edge", "#wide"]

test("annotate puts each arrow tip a few px from its target and no circle on any target", async ({ browser }) => {
  const { composeBlock } = await load<Composer>("before-after.mjs")
  const { blockHtml, pageHtml } = await load<Drawer>("annotate.mjs")
  const app = await browser.newContext({ viewport: { width: 1470, height: 923 }, deviceScaleFactor: 2 })
  const page = await app.newPage()
  await page.setContent(fixture)
  const boxes = await Promise.all(targets.map(async (selector) => page.locator(selector).boundingBox()))
  const full = await page.screenshot()
  await app.close()
  const block = {
    state: "fixture",
    title: "Fixture",
    crop: null,
    click: [],
    callouts: targets.map((at) => ({ at, note: `Points at ${at}` })),
  }
  const { block: composed } = composeBlock(
    block,
    [{ key: "page", label: "", missing: "missing" }],
    [{ full, frame: { x: 0, y: 0, width: 1470, height: 923 }, boxes }],
  )
  const sheet = await browser.newContext({ viewport: { width: 850, height: 1000 } })
  const drawn = await sheet.newPage()
  await drawn.setContent(pageHtml([blockHtml(composed)], ":root{--limit:red;--background:white}"))
  const image = await drawn.locator(".frame img").boundingBox()
  const frame = await drawn.locator(".frame").boundingBox()
  expect(image).not.toBeNull()
  expect(frame).not.toBeNull()
  const scale = image!.width / 1470
  const shown = boxes.map((box) => ({
    x: image!.x - frame!.x + box!.x * scale,
    y: image!.y - frame!.y + box!.y * scale,
    width: box!.width * scale,
    height: box!.height * scale,
  }))
  const gap = (box: Box, x: number, y: number) =>
    Math.hypot(Math.max(box.x - x, 0, x - box.x - box.width), Math.max(box.y - y, 0, y - box.y - box.height))
  for (const [index, box] of shown.entries()) {
    const tip = drawn.locator(`[data-tip="${String(index + 1)}"]`)
    const x = Number(await tip.getAttribute("data-x"))
    const y = Number(await tip.getAttribute("data-y"))
    expect(gap(box, x, y)).toBeGreaterThan(1)
    expect(gap(box, x, y)).toBeLessThan(5)
    const circle = drawn.locator(`[data-callout="${String(index + 1)}"]`)
    const cx = Number(await circle.getAttribute("data-cx"))
    const cy = Number(await circle.getAttribute("data-cy"))
    expect(gap(box, cx, cy)).toBeLessThan(60)
    for (const other of shown) expect(gap(other, cx, cy)).toBeGreaterThan(13)
  }
  await expect(drawn.locator("li")).toHaveCount(targets.length)
  await sheet.close()
})

test("a click waits for what the click before it opens, and skips what never shows", async ({ page }) => {
  const { clickEach } = await load<Composer>("before-after.mjs")
  await page.setContent(`<body><button id="open" onclick="setTimeout(() => {
    const item = document.createElement('button')
    item.id = 'item'
    item.onclick = () => item.textContent = 'picked'
    document.body.append(item)
  }, 300)">Open</button></body>`)
  expect(await clickEach(page, ["#open", "#item", "#never"])).toEqual(["#never"])
  await expect(page.locator("#item")).toHaveText("picked")
})
