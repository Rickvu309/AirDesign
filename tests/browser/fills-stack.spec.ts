import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { PNG } from "pngjs"
import { format, type Register } from "../../packages/document/src/index.ts"
import { forward, signInBrowser, test, type Stack } from "./api-stack"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"
import { decksOn } from "./deck-test"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const slidePart = "ppt/slides/slide1.xml"
const shade = {
  gradient: {
    stops: [
      { pos: 0, color: { rgb: "000000", transforms: [{ op: "alpha", val: 0 }] } },
      { pos: 100_000, color: { rgb: "000000", transforms: [{ op: "alpha", val: 80_000 }] } },
    ],
    shade: { linear: { angle: 5_400_000, scaled: false } },
    rotateWithShape: true,
  },
} as const

const scale = 3

function cut(image: PNG, left: number, top: number, width: number, height: number): PNG {
  const part = new PNG({ width, height })
  PNG.bitblt(image, part, left, top, width, height, 0, 0)
  return part
}

function inner(image: PNG): PNG {
  const margin = Math.ceil(image.width * 0.01)
  return cut(image, margin, margin, image.width - margin * 2, image.height - margin * 2)
}

async function exactShot(element: Locator): Promise<PNG> {
  const box = await element.boundingBox()
  if (box === null) throw new Error("box")
  const shot = PNG.sync.read(await element.screenshot())
  const left = Math.round(box.x * scale - Math.floor(box.x * scale))
  const top = Math.round(box.y * scale - Math.floor(box.y * scale))
  const width = Math.min(shot.width - left, Math.round(box.width * scale))
  const height = Math.min(shot.height - top, Math.round(box.height * scale))
  return cut(shot, left, top, width, height)
}

test.use({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: scale })

async function imported(page: Page, file: string): Promise<string> {
  await decksOn(page).open(file)
  return new URL(page.url()).pathname.slice("/deck/".length)
}

async function stacked(stack: Stack, cookie: string, deck: string, shape: string, fills: unknown): Promise<void> {
  let node: string | undefined
  await expect
    .poll(async () => {
      const { register } = (await stack.post("/decks/open", { deck }, cookie)).json as { register: Register }
      node = register.index?.elements.find((element) => element.node.endsWith(`.${shape}`))?.node
      return node
    })
    .toBeDefined()
  const answer = await stack.post("/decks/commit", { deck, batch: [{ node, v: format, patch: { fills } }] }, cookie)
  expect(answer.json.ok).toBe(true)
}

async function signedIn(page: Page, context: Parameters<typeof signInBrowser>[0], stack: Stack): Promise<string> {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  return cookie
}

test("a gradient over a photo paints on the canvas as it bakes into the photo's one image fill @export", async ({
  page,
  context,
  stack,
  decks,
}, testInfo) => {
  const { slideDiff } = await import("../../scripts/slide-diff.mjs")
  const cookie = await signedIn(page, context, stack)
  const deck = await imported(page, join(fixtures, "picture-png.pptx"))
  await stacked(stack, cookie, deck, "4", { p1: { set: shade } })
  await page.reload()
  await decks.ready()
  const photo = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#4"]`)
  await expect.poll(() => photo.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain("gradient")
  const painted = await exactShot(photo)
  const file = testInfo.outputPath("stacked-photo.pptx")
  await savedExport(page, file)
  const parts = await partsOf(file)
  const slide = parts.get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain("<p:pic>")
  expect(slide).not.toContain("airdesign.app/2026/fills")
  const embed = /<p:blipFill><a:blip r:embed="(rId\d+)"\/>/.exec(slide)?.[1]
  const rels = parts.get("ppt/slides/_rels/slide1.xml.rels")?.toString("utf8") ?? ""
  const target = new RegExp(`Id="${embed ?? ""}"[^>]*Target="\\.\\./media/([^"]+)"`).exec(rels)?.[1]
  const baked = PNG.sync.read(parts.get(`ppt/media/${target ?? ""}`) ?? Buffer.alloc(0))
  await writeFile(testInfo.outputPath("canvas.png"), PNG.sync.write(painted))
  await writeFile(testInfo.outputPath("baked.png"), PNG.sync.write(baked))
  const result = slideDiff(inner(baked), inner(painted))
  testInfo.annotations.push({ type: "slide-diff", description: JSON.stringify(result) })
  expect(result.match, JSON.stringify(result)).toBe(true)
})

test("a text box with two paints exports as one image fill and opens again with its text editable @export", async ({
  page,
  context,
  stack,
  decks,
}, testInfo) => {
  const cookie = await signedIn(page, context, stack)
  const deck = await imported(page, join(fixtures, "clean.pptx"))
  await stacked(stack, cookie, deck, "2", { p0: { set: { solid: { scheme: "accent1" } } }, p1: { set: shade } })
  await page.reload()
  await decks.ready()
  const title = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#2"]`)
  await expect.poll(() => title.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain("gradient")
  const words = (await title.textContent()) ?? ""
  const file = testInfo.outputPath("stacked-text.pptx")
  await savedExport(page, file)
  const slide = (await partsOf(file)).get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain('<a:blipFill rotWithShape="1">')
  expect(slide).toContain("<p:txBody>")
  await imported(page, file)
  const reopened = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#2"]`)
  await expect(reopened).toContainText(words.trim())
  await reopened.dblclick()
  await page.keyboard.press("End")
  await page.keyboard.type(" again")
  await expect(reopened).toContainText(`${words.trim()} again`)
})
