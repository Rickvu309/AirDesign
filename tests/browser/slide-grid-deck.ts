import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"

const deckAddress = /\/deck\/[A-Za-z0-9_-]{1,64}$/
export const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
export const sectioned = join(fixtures, "sections-before.pptx")
export const clean = join(fixtures, "clean.pptx")
export const fifty = 50

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

export function mark(number: number, count: number): string {
  return `Mark ${String(number).padStart(String(count).length, "0")}`
}

export async function manySlides(count: number, sections = false): Promise<Buffer> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(clean))))
  const files = new Map<string, Uint8Array>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) files.set(entry.filename, await entry.getData(new zip.Uint8ArrayWriter()))
  }
  await reader.close()
  const slide = Buffer.from(files.get("ppt/slides/slide1.xml") ?? new Uint8Array()).toString("utf8")
  const rels = files.get("ppt/slides/_rels/slide1.xml.rels")
  if (rels === undefined || !slide.includes("<a:t>Hello</a:t>")) throw new Error("clean slide")
  for (let number = 1; number <= count; number += 1) {
    files.set(
      `ppt/slides/slide${number}.xml`,
      Buffer.from(slide.replace("<a:t>Hello</a:t>", `<a:t>${mark(number, count)}</a:t>`)),
    )
    files.set(`ppt/slides/_rels/slide${number}.xml.rels`, rels)
  }
  const ids = Array.from({ length: count }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join(
    "",
  )
  files.set(
    "ppt/presentation.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    ),
  )
  if (sections) {
    const xml = Buffer.from(files.get("ppt/presentation.xml")!).toString("utf8")
    const groups = ["Opening", "Results"]
      .map((name, group) => {
        const first = group === 0 ? 0 : Math.floor(count / 2)
        const last = group === 0 ? Math.floor(count / 2) : count
        const members = Array.from({ length: last - first }, (_, i) => `<p14:sldId id="${256 + first + i}"/>`).join("")
        return `<p14:section name="${name}" id="{00000000-0000-0000-0000-00000000000${group + 1}}"><p14:sldIdLst>${members}</p14:sldIdLst></p14:section>`
      })
      .join("")
    const extension = `<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">${groups}</p14:sectionLst></p:ext></p:extLst>`
    files.set("ppt/presentation.xml", Buffer.from(xml.replace("</p:presentation>", extension + "</p:presentation>")))
  }
  const relationships = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    ...Array.from(
      { length: count },
      (_, index) =>
        `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
    ),
    `<Relationship Id="rId${count + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>`,
    `<Relationship Id="rId${count + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>`,
    `<Relationship Id="rId${count + 4}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>`,
  ].join("")
  files.set(
    "ppt/_rels/presentation.xml.rels",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
    ),
  )
  const types = Buffer.from(files.get("[Content_Types].xml") ?? new Uint8Array()).toString("utf8")
  const slideType = `<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  if (!types.includes(slideType)) throw new Error("content type")
  const overrides = Array.from({ length: count }, (_, index) =>
    slideType.replace("/ppt/slides/slide1.xml", `/ppt/slides/slide${index + 1}.xml`),
  ).join("")
  files.set("[Content_Types].xml", Buffer.from(types.replace(slideType, overrides)))
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const [name, bytes] of files) await writer.add(name, new zip.Uint8ArrayReader(bytes))
  return Buffer.from(await writer.close())
}

export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

export async function openFile(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await expect(page).toHaveURL(deckAddress)
  await settled(page)
}

export function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

export async function openGrid(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Grid" }).click()
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
}

export function rowNumbers(page: Page): Promise<number[][]> {
  return page
    .locator("[data-grid-viewport]")
    .evaluate((canvas) =>
      [...canvas.querySelectorAll<HTMLElement>("[data-grid-row]")].map((row) =>
        [
          ...canvas.querySelectorAll<HTMLElement>(`[data-grid-row-member="${row.dataset.gridRow}"] [data-slide-entry]`),
        ].map((slide) => Number(slide.dataset.slideEntry)),
      ),
    )
}
