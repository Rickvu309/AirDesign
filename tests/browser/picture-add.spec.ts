import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { importTitleDeck } from "./new-deck"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"

const pictureWords = async () => (await import("../../apps/web/src/copy/picture-copy.ts")).pictureCopy

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const pictureFile = join(process.cwd(), "scripts/pptx-fixtures/picture.png")
const pictureKey = "ppt/slides/slide1.xml#4"

async function partsOf(file: string): Promise<Map<string, Uint8Array>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Uint8Array>()
  for (const entry of await reader.getEntries())
    parts.set(entry.filename, await entry.getData(new zip.Uint8ArrayWriter()))
  await reader.close()
  return parts
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function painted(picture: Locator): Promise<void> {
  await expect(picture).toBeVisible()
  await expect.poll(async () => picture.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain("blob:")
}

async function size(picture: Locator): Promise<{ readonly width: number; readonly height: number }> {
  const box = await picture.boundingBox()
  if (box === null) throw new Error("no picture box")
  return { width: box.width, height: box.height }
}

test("adds a PNG to a blank deck, moves and resizes it at its ratio, and keeps it through reload, export and a new import", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await importTitleDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const choosing = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: (await pictureWords()).add, exact: true }).click()
  await (await choosing).setFiles(pictureFile)
  const picture = page.locator(`[data-canvas-element="${pictureKey}"]`)
  await painted(picture)
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  const placed = await picture.boundingBox()
  if (slide === null || placed === null) throw new Error("no boxes")
  expect(placed.width / placed.height).toBeCloseTo(1.5, 1)
  expect(Math.abs(placed.x + placed.width / 2 - (slide.x + slide.width / 2))).toBeLessThan(3)
  await picture.click()
  await page.keyboard.press("Shift+ArrowRight")
  await expect.poll(async () => (await picture.boundingBox())?.x ?? 0).toBeGreaterThan(placed.x + 5)
  const before = await size(picture)
  const grip = page.locator('[data-selection] [data-grip="bottom-right"]')
  const corner = await grip.boundingBox()
  if (corner === null) throw new Error("no grip")
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
  await page.mouse.down()
  await page.mouse.move(corner.x + 120, corner.y + 10, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => (await size(picture)).width).toBeGreaterThan(before.width + 60)
  const resized = await size(picture)
  expect(resized.width / resized.height).toBeCloseTo(before.width / before.height, 1)
  await page.reload()
  await settled(page)
  await painted(picture)
  expect((await size(picture)).width).toBeCloseTo(resized.width, 0)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("picture-add.pptx")
  await (await saving).saveAs(file)
  const parts = await partsOf(file)
  const slideXml = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  expect(slideXml).toMatch(/<p:pic><p:nvPicPr><p:cNvPr id="4" name="Picture 4"\/>/)
  const media = [...parts.keys()].filter((name) => name.startsWith("ppt/media/"))
  expect(media).toHaveLength(1)
  expect(Buffer.from(parts.get(media[0] ?? "") ?? [])).toEqual(await readFile(pictureFile))
  expect(new TextDecoder().decode(parts.get("[Content_Types].xml"))).toContain('<Default Extension="png"')
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await settled(page)
  await painted(picture)
})

test("refuses a file that is not a PNG, JPEG or GIF and says what to choose", async ({ page }) => {
  await page.goto("/")
  await importTitleDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const choosing = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: (await pictureWords()).add, exact: true }).click()
  await (
    await choosing
  ).setFiles({
    name: "drawing.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
  })
  await expect(page.getByText((await pictureWords())["picture-type"])).toBeVisible()
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(2)
})

test("Undo takes back an added picture and Redo paints it again, through a reload", async ({ page }) => {
  await page.goto("/")
  await importTitleDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const choosing = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: (await pictureWords()).add, exact: true }).click()
  await (await choosing).setFiles(pictureFile)
  const picture = page.locator(`[data-canvas-element="${pictureKey}"]`)
  await painted(picture)
  await page.getByRole("button", { name: undoCopy.undoNamed["add-picture"], exact: true }).click()
  await expect(picture).toHaveCount(0)
  await page.getByRole("button", { name: "Redo add picture", exact: true }).click()
  await painted(picture)
  await page.reload()
  await settled(page)
  await painted(picture)
})

test("a picture added to a new title slide lands clear of the empty title and subtitle", async ({ page }) => {
  await page.goto("/")
  await importTitleDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const placeholders = page.locator("[data-slide-paint] [data-canvas-element]")
  await expect(placeholders).toHaveCount(2)
  const empty = await placeholders.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom }
    }),
  )
  const choosing = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: (await pictureWords()).add, exact: true }).click()
  await (await choosing).setFiles(pictureFile)
  const picture = page.locator(`[data-canvas-element="${pictureKey}"]`)
  await painted(picture)
  const placed = await picture.boundingBox()
  if (placed === null) throw new Error("no picture box")
  expect(placed.width / placed.height).toBeCloseTo(1.5, 1)
  for (const held of empty) {
    const crossing =
      placed.x < held.right &&
      held.left < placed.x + placed.width &&
      placed.y < held.bottom &&
      held.top < placed.y + placed.height
    expect(crossing).toBe(false)
  }
})
