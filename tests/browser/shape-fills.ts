import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"

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

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

export async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

export function shapeAt(page: Page, shape: string, part = "ppt/slides/slide1.xml"): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${shape}"]`)
}

export function filled(shape: Locator): Promise<string> {
  return shape.evaluate((node) => {
    const style = getComputedStyle(node)
    const drawn = node.querySelector("[data-canvas-line] g > path[fill], [data-canvas-line] defs linearGradient")
    if (style.backgroundImage !== "none") return style.backgroundImage
    if (drawn?.tagName === "linearGradient") return `gradient ${drawn.outerHTML}`
    return drawn?.getAttribute("fill") ?? style.backgroundColor
  })
}

export async function fillPanel(page: Page, shape: Locator): Promise<Locator> {
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  await shape.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await expect(panel.getByRole("group", { name: "Fill", exact: true })).toBeVisible()
  return panel
}
