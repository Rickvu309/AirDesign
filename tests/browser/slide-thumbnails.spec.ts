import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const varied = join(fixtures, "doe-heat-pumps.pptx")
const clean = join(fixtures, "clean.pptx")
const deckAddress = /\/deck\/[A-Za-z0-9_-]{1,64}$/
const slideCount = 50

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

function mark(number: number): string {
  return `Mark ${String(number).padStart(2, "0")}`
}

async function fiftySlides(): Promise<Buffer> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(clean))))
  const files = new Map<string, Uint8Array>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) files.set(entry.filename, await entry.getData(new zip.Uint8ArrayWriter()))
  }
  await reader.close()
  const slide = Buffer.from(files.get("ppt/slides/slide1.xml") ?? new Uint8Array()).toString("utf8")
  const rels = files.get("ppt/slides/_rels/slide1.xml.rels")
  if (rels === undefined || !slide.includes("<a:t>Hello</a:t>")) throw new Error("clean slide")
  for (let number = 1; number <= slideCount; number += 1) {
    files.set(
      `ppt/slides/slide${number}.xml`,
      Buffer.from(slide.replace("<a:t>Hello</a:t>", `<a:t>${mark(number)}</a:t>`)),
    )
    files.set(`ppt/slides/_rels/slide${number}.xml.rels`, rels)
  }
  const ids = Array.from({ length: slideCount }, (_, index) => {
    return `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`
  }).join("")
  files.set(
    "ppt/presentation.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    ),
  )
  const relationships = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    ...Array.from(
      { length: slideCount },
      (_, index) =>
        `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
    ),
    `<Relationship Id="rId${slideCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>`,
    `<Relationship Id="rId${slideCount + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>`,
    `<Relationship Id="rId${slideCount + 4}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>`,
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
  const overrides = Array.from({ length: slideCount }, (_, index) =>
    slideType.replace("/ppt/slides/slide1.xml", `/ppt/slides/slide${index + 1}.xml`),
  ).join("")
  files.set("[Content_Types].xml", Buffer.from(types.replace(slideType, overrides)))
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const [name, bytes] of files) await writer.add(name, new zip.Uint8ArrayReader(bytes))
  return Buffer.from(await writer.close())
}

async function showSlide(page: Page, number: number): Promise<void> {
  const entry = page.locator(`[data-slide-entry="${number}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}

async function blobUrls(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluate((root) => {
    const found = new Set<string>()
    const nodes = [root, ...root.querySelectorAll("*")]
    for (const node of nodes) {
      if (!(node instanceof Element)) continue
      for (const match of getComputedStyle(node).backgroundImage.matchAll(/blob:[^"')]+/g)) found.add(match[0])
    }
    return [...found]
  })
}

test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" })

test("slide list entries paint different slides and follow an edit", async ({ page, decks }) => {
  await decks.open(varied)
  const first = page.locator('[data-slide-entry="1"] [data-thumb-paint]')
  const second = page.locator('[data-slide-entry="2"] [data-thumb-paint]')
  await expect(first).toContainText("Introduction to Heat Pumps")
  await expect(second).toContainText("Basic Principles of Heat Pump Operations")
  expect((await first.innerText()).trim().length).toBeGreaterThan(0)
  expect(await first.innerText()).not.toBe(await second.innerText())
  await expect(page.locator('[data-slide-entry="1"]')).toHaveAccessibleName("Slide 1 of 41")
  await expect(page.locator('[data-slide-entry="2"]')).toHaveAccessibleName("Slide 2 of 41")
  await expect(page.locator("[data-thumb-paint] [contenteditable]")).toHaveCount(0)
  await page.locator('[data-slide-entry="1"]').focus()
  await page.keyboard.press("ArrowDown")
  await expect(page.locator("[data-group-head]").nth(1)).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(page.locator('[data-slide-entry="2"]')).toBeFocused()
  const motions = await page
    .locator("[data-slide-list]")
    .evaluate((list) =>
      list.getAnimations({ subtree: true }).map((animation) => animation.effect?.getComputedTiming().duration ?? 0),
    )
  expect(motions.filter((duration) => duration !== 0)).toEqual([])
  await page.locator('[data-slide-entry="1"]').click()
  const title = page.locator('[contenteditable="true"]').filter({ hasText: "Introduction to Heat Pumps" })
  await title.dblclick()
  await page.keyboard.press("End")
  await title.pressSequentially(" today", { delay: 30 })
  await expect(first).toContainText("Introduction to Heat Pumps today")
})

test("a picture address is shared by the open slide and its thumbnail", async ({ page, decks }) => {
  await page.addInitScript(() => {
    const made: string[] = []
    Reflect.set(window, "pictureAddresses", { made })
    const create = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      const url = create(object)
      if (object instanceof Blob && object.type.startsWith("image/")) made.push(url)
      return url
    }
  })
  const addresses = () => page.evaluate(() => Reflect.get(window, "pictureAddresses") as { made: string[] })
  await decks.open(varied)
  await expect(page.locator('[data-slide-entry="2"] [data-thumb-paint]')).toContainText(
    "Basic Principles of Heat Pump Operations",
  )
  await showSlide(page, 2)
  const seen = (await addresses()).made.length
  const main = await blobUrls(page, "[data-slide-paint]")
  const thumb = await blobUrls(page, '[data-slide-entry="2"] [data-thumb-paint]')
  expect(main.length).toBeGreaterThan(0)
  expect(thumb.length).toBeGreaterThan(0)
  for (const url of thumb) expect(main).toContain(url)
  const made = (await addresses()).made
  for (const url of main) expect(made.filter((item) => item === url)).toHaveLength(1)
  await showSlide(page, 1)
  await showSlide(page, 2)
  expect((await addresses()).made.length).toBe(seen)
})

test("opening a 50-slide deck does not paint every thumbnail", async ({ page, decks }) => {
  await decks.open({
    name: "fifty.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await fiftySlides(),
  })
  await expect(page.locator("[data-slide-entry]")).toHaveCount(slideCount)
  await expect(page.locator("[data-slide-paint]")).toHaveCount(1)
  await expect(page.locator("[data-slide-paint]")).toContainText(mark(1))
  await expect.poll(async () => page.locator("[data-thumb-paint]").count()).toBeGreaterThan(0)
  const painted = await page.locator("[data-thumb-paint]").count()
  expect(painted, `painted ${painted} thumbs`).toBeLessThan(slideCount)
  const list = await page.locator("[data-slide-list]").innerText()
  expect(list).toContain(mark(1))
  expect(list).not.toContain(mark(slideCount))
})
