import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { covers } from "./gesture"

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

type Spot = { readonly x: number; readonly y: number }

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const fixture = join(process.cwd(), "scripts/pptx-fixtures/shapes-added.pptx")
const part = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

function frame(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

function spots(shapes: readonly Locator[]): Promise<Spot[]> {
  return Promise.all(
    shapes.map((shape) =>
      shape.evaluate((node: HTMLElement) => ({
        x: Number.parseFloat(node.style.left),
        y: Number.parseFloat(node.style.top),
      })),
    ),
  )
}

function shifted(from: readonly Spot[], to: readonly Spot[]): string[] {
  return from.map(
    (spot, at) => `${String(Math.round((to[at]?.x ?? 0) - spot.x))} ${String(Math.round((to[at]?.y ?? 0) - spot.y))}`,
  )
}

test("three selected shapes move by one drag and one nudge, each undone in one step, and the export keeps the file @export", async ({
  page,
}, testInfo) => {
  covers("move", "nudge-far")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const shapes = [frame(page, 4), frame(page, 5), frame(page, 3)]
  const start = await spots(shapes)
  await shapes[0]!.click()
  await shapes[1]!.click({ modifiers: ["ControlOrMeta"] })
  await shapes[2]!.click({ modifiers: ["ControlOrMeta"] })
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(3)
  await expect(page.locator("[data-slide-paint] [data-selection-around]")).toHaveAttribute("data-selection-around", "3")

  const grabbed = await shapes[0]!.boundingBox()
  if (grabbed === null) throw new Error("no rectangle")
  await page.mouse.move(grabbed.x + grabbed.width / 2, grabbed.y + grabbed.height / 2)
  await page.mouse.down()
  await page.mouse.move(grabbed.x + grabbed.width / 2 + 60, grabbed.y + grabbed.height / 2 + 30, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByRole("button", { name: "Undo move", exact: true })).toBeEnabled()
  const dragged = await spots(shapes)
  expect(new Set(shifted(start, dragged)).size).toBe(1)
  expect(shifted(start, dragged)[0]).not.toBe("0 0")

  await page.keyboard.press("Shift+ArrowRight")
  await expect(page.locator("[data-slide-paint] [role=status]")).toHaveText("Moved 3 elements")
  await expect.poll(async () => new Set(shifted(dragged, await spots(shapes))).size).toBe(1)
  expect(shifted(dragged, await spots(shapes))[0]).not.toBe("0 0")

  await page.getByRole("button", { name: "Undo move", exact: true }).click()
  await expect.poll(() => spots(shapes)).toEqual(dragged)
  await page.getByRole("button", { name: "Undo move", exact: true }).click()
  await expect.poll(() => spots(shapes)).toEqual(start)
  await expect(page.getByRole("button", { name: "Redo move", exact: true })).toBeEnabled()

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("three-undone.pptx")
  await (await saving).saveAs(file)
  const original = await partsOf(fixture)
  const saved = await partsOf(file)
  expect([...saved.keys()]).toEqual([...original.keys()])
  expect(
    [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name),
  ).toEqual([])
})
