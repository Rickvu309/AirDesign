import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { elementId, landedPatch, type ElementId, type Register } from "../../packages/document/src/index.ts"
import { forward, settled, signInBrowser, test, type Stack } from "./api-stack"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"
import { holdableDevice } from "./slow-device"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const slidePart = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

async function serverCrop(stack: Stack, deck: string, node: ElementId, cookie: string): Promise<unknown> {
  const { register } = (await stack.post("/decks/open", { deck }, cookie)).json as { register: Register }
  const body = register.elements[node]
  return body === undefined ? undefined : landedPatch(body, "text").crop?.rect
}

function width(photo: Locator): Promise<number> {
  return photo.evaluate((frame: HTMLElement) => Number.parseFloat(frame.style.width))
}

async function cropped(page: Page, photo: Locator): Promise<Locator> {
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await photo.click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toHaveAttribute("data-design-element", /\.4$/)
  return panel.locator("section").filter({ has: page.getByRole("heading", { name: "Crop", exact: true }) })
}

test("two crop sides typed one after another on a slow device both land, on the server and in the export @export", async ({
  page,
  context,
  stack,
}, testInfo) => {
  test.setTimeout(90_000)
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await holdableDevice(page)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(fixtures, "picture-png.pptx"))
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const deck = new URL(page.url()).pathname.slice("/deck/".length)
  const photo = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#4"]`)
  const crop = await cropped(page, photo)
  const framed = await width(photo)
  const node = elementId((await page.locator("[data-design-element]").getAttribute("data-design-element")) ?? "")
  await page.evaluate(() => {
    window.deviceDelay = 300
  })
  for (const side of ["Left", "Right"]) {
    const input = crop.getByRole("textbox", { name: side, exact: true })
    await input.fill("10")
    await input.press("Enter")
  }
  await expect.poll(async () => Math.round(((await width(photo)) / framed) * 100)).toBe(80)
  await expect(crop.getByRole("textbox", { name: "Left", exact: true })).toHaveValue("10")
  await expect(crop.getByRole("textbox", { name: "Right", exact: true })).toHaveValue("10")
  await page.evaluate(() => {
    window.deviceDelay = undefined
  })
  await expect.poll(() => serverCrop(stack, deck, node, cookie)).toEqual({ set: { l: 10_000, t: 0, r: 10_000, b: 0 } })

  const file = testInfo.outputPath("cropped-picture.pptx")
  await savedExport(page, file)
  const slide = (await partsOf(file)).get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain('<a:srcRect l="10000" r="10000"/>')
})
