import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { PNG } from "pngjs"

const deck = join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx")
const otherDeck = join(process.cwd(), "scripts/pptx-fixtures/nasa-1d-cnn.pptx")
const slide = "ppt/slides/slide4.xml"
const pictureKey = `${slide}#8`
const picturePart = "ppt/media/image10.png"
const kept = [0, 0, 255] as const
const cropped = [255, 0, 0] as const

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => {
    getEntries(): Promise<ZipEntry[]>
    close(): Promise<void>
  }
  readonly ZipWriter: new (writer: unknown) => {
    add(name: string, reader: unknown): Promise<unknown>
    close(): Promise<Uint8Array>
  }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

function halves(): Uint8Array {
  const image = new PNG({ width: 200, height: 100 })
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const at = (y * image.width + x) * 4
      const [red, green, blue] = x < image.width / 2 ? cropped : kept
      image.data[at] = red
      image.data[at + 1] = green
      image.data[at + 2] = blue
      image.data[at + 3] = 255
    }
  }
  return new Uint8Array(PNG.sync.write(image))
}

async function croppedDeck(): Promise<Buffer> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(deck))))
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue
    let bytes = await entry.getData(new zip.Uint8ArrayWriter())
    if (entry.filename === picturePart) bytes = halves()
    if (entry.filename === slide) {
      const sheet = Buffer.from(bytes).toString("utf8")
      const blip = '<a:blip r:embed="rId3"/>'
      if (!sheet.includes(blip)) throw new Error("no picture to crop")
      bytes = Buffer.from(sheet.replace(blip, `${blip}<a:srcRect l="50000"/>`), "utf8")
    }
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  return Buffer.from(await writer.close())
}

async function settled(page: Page, before: string | null = null): Promise<string> {
  const handle = await page.waitForFunction((previous) => {
    const id = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    const ready = document.querySelector(".thin-page")?.getAttribute("data-deck-ready")
    return id !== undefined && ready === id && id !== previous ? id : false
  }, before)
  return (await handle.jsonValue()) as string
}

async function showSlide(page: Page, number: number): Promise<void> {
  const entry = page.locator(`[data-slide-entry="${number}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}

type Shares = { readonly kept: number; readonly cropped: number }

function near(data: Buffer, at: number, color: readonly [number, number, number]): boolean {
  return color.every((channel, index) => Math.abs((data[at + index] ?? 0) - channel) < 24)
}

async function shares(page: Page): Promise<Shares> {
  const image = PNG.sync.read(await page.locator(`[data-canvas-element="${pictureKey}"]`).screenshot())
  let keptCount = 0
  let croppedCount = 0
  let counted = 0
  for (let y = 2; y < image.height - 2; y += 1) {
    for (let x = 2; x < image.width - 2; x += 1) {
      const at = (y * image.width + x) * 4
      counted += 1
      if (near(image.data, at, kept)) keptCount += 1
      if (near(image.data, at, cropped)) croppedCount += 1
    }
  }
  return { kept: keptCount / counted, cropped: croppedCount / counted }
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a cropped picture paints the part of the picture its crop keeps", async ({ page }) => {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "cropped.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await croppedDeck(),
  })
  await settled(page)
  await showSlide(page, 4)
  await expect.poll(async () => (await shares(page)).kept).toBeGreaterThan(0.9)
  expect((await shares(page)).cropped).toBe(0)
})

test("a deck reuses picture addresses across slide switches and navigation releases them", async ({ page }) => {
  await page.addInitScript(() => {
    const made: string[] = []
    const released: string[] = []
    Reflect.set(window, "pictureAddresses", { made, released })
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      const url = create(object)
      if (object instanceof Blob && object.type.startsWith("image/")) made.push(url)
      return url
    }
    URL.revokeObjectURL = (url) => {
      released.push(url)
      revoke(url)
    }
  })
  const addresses = () =>
    page.evaluate(() => Reflect.get(window, "pictureAddresses") as { made: string[]; released: string[] })
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(deck)
  const first = await settled(page)
  await showSlide(page, 4)
  await showSlide(page, 5)
  const seen = (await addresses()).made.length
  expect(seen).toBeGreaterThan(0)
  await showSlide(page, 4)
  await showSlide(page, 5)
  expect((await addresses()).made.length).toBe(seen)
  const previous = (await addresses()).made
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(otherDeck)
  await settled(page, first)
  expect(
    await page.evaluate(async (urls) => {
      return Promise.all(
        urls.map(async (url) =>
          fetch(url).then(
            () => true,
            () => false,
          ),
        ),
      )
    }, previous),
  ).toEqual(previous.map(() => false))
})
