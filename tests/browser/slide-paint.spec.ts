import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const deck = join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx")

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
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function partsOf(file: string): Promise<Map<string, string>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, string>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory && /\.(xml|rels)$/.test(entry.filename)) {
      parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())).toString("utf8"))
    }
  }
  await reader.close()
  return parts
}

function part(parts: ReadonlyMap<string, string>, name: string): string {
  const text = parts.get(name)
  if (text === undefined) throw new Error(`no part ${name}`)
  return text
}

function numbers(text: string, tag: string, first: string, second: string): readonly [number, number] {
  const found = new RegExp(`<a:${tag}\\s[^>]*${first}="(-?\\d+)"[^>]*${second}="(-?\\d+)"`).exec(text)
  if (found === null) throw new Error(`no ${tag}`)
  return [Number(found[1]), Number(found[2])]
}

function boxIn(xfrm: string): Rect {
  const [x, y] = numbers(xfrm, "off", "x", "y")
  const [width, height] = numbers(xfrm, "ext", "cx", "cy")
  return { x, y, width, height }
}

function shapeXml(sheet: string, shape: string): string {
  const named = sheet.indexOf(`<p:cNvPr id="${shape}"`)
  if (named < 0) throw new Error(`no shape ${shape}`)
  const open = Math.max(sheet.lastIndexOf("<p:sp>", named), sheet.lastIndexOf("<p:pic>", named))
  const close = /<\/p:(sp|pic)>/.exec(sheet.slice(named))
  if (close === null) throw new Error(`no end of ${shape}`)
  return sheet.slice(open, named + close.index)
}

function xfrmOf(shape: string): string | null {
  return /<a:xfrm[\s>].*?<\/a:xfrm>/s.exec(shape)?.[0] ?? null
}

function ownBox(sheet: string, shape: string): Rect {
  const xfrm = xfrmOf(shapeXml(sheet, shape))
  if (xfrm === null) throw new Error(`no xfrm on ${shape}`)
  return boxIn(xfrm)
}

function openGroups(sheet: string, before: number): readonly string[] {
  const open: number[] = []
  for (const tag of sheet.slice(0, before).matchAll(/<(\/?)p:grpSp>/g)) {
    if (tag[1] === "/") open.pop()
    else open.push(tag.index)
  }
  return open.map((start) => {
    const xfrm = xfrmOf(sheet.slice(start))
    if (xfrm === null) throw new Error("no group xfrm")
    return xfrm
  })
}

function groupedBox(sheet: string, shape: string): Rect {
  let box = ownBox(sheet, shape)
  for (const group of [...openGroups(sheet, sheet.indexOf(`<p:cNvPr id="${shape}"`))].reverse()) {
    const outer = boxIn(group)
    const [childX, childY] = numbers(group, "chOff", "x", "y")
    const [childWidth, childHeight] = numbers(group, "chExt", "cx", "cy")
    const scaleX = outer.width / childWidth
    const scaleY = outer.height / childHeight
    box = {
      x: outer.x + (box.x - childX) * scaleX,
      y: outer.y + (box.y - childY) * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY,
    }
  }
  return box
}

function relationshipTarget(parts: ReadonlyMap<string, string>, source: string, type: string): string {
  const folders = source.split("/")
  const name = folders.pop()
  const rels = part(parts, `${folders.join("/")}/_rels/${name}.rels`)
  const relationship = [...rels.matchAll(/<Relationship\s[^>]*>/g)].find((each) => each[0].includes(`/${type}"`))
  const target = relationship === undefined ? undefined : /Target="([^"]+)"/.exec(relationship[0])?.[1]
  if (target === undefined) throw new Error(`no ${type} of ${source}`)
  return `ppt/${target.replace(/^\.\.\//, "")}`
}

function placeholderBox(sheet: string, type: string): Rect | null {
  for (const shape of sheet.matchAll(/<p:sp>.*?<\/p:sp>/gs)) {
    if (!shape[0].includes(`<p:ph type="${type}"`)) continue
    const xfrm = xfrmOf(shape[0])
    return xfrm === null ? null : boxIn(xfrm)
  }
  return null
}

function inheritedBox(parts: ReadonlyMap<string, string>, slide: string, shape: string, type: string): Rect {
  expect(xfrmOf(shapeXml(part(parts, slide), shape))).toBeNull()
  const layout = relationshipTarget(parts, slide, "slideLayout")
  const own = placeholderBox(part(parts, layout), type)
  if (own !== null) return own
  const master = placeholderBox(part(parts, relationshipTarget(parts, layout, "slideMaster")), type)
  if (master === null) throw new Error(`no ${type} above ${slide}`)
  return master
}

async function open(page: Page): Promise<void> {
  await page.goto("/thin")
  await page.locator("input[type=file]").setInputFiles(deck)
  await page.waitForFunction(() => {
    const id = location.pathname.match(/^\/thin\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return id !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === id
  })
}

async function showSlide(page: Page, number: number): Promise<void> {
  const entry = page.locator(`[data-slide-entry="${number}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}

function slideSize(parts: ReadonlyMap<string, string>): readonly [number, number] {
  const found = /<p:sldSz\s[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(part(parts, "ppt/presentation.xml"))
  if (found === null) throw new Error("no slide size")
  return [Number(found[1]), Number(found[2])]
}

async function expectPlaced(page: Page, parts: ReadonlyMap<string, string>, key: string, box: Rect): Promise<void> {
  const canvas = await page.locator("[data-slide-paint]").boundingBox()
  const element = await page.locator(`[data-canvas-element="${key}"]`).boundingBox()
  if (canvas === null || element === null) throw new Error(`${key} is not on the page`)
  const scale = canvas.width / slideSize(parts)[0]
  expect(Math.abs(element.x - canvas.x - box.x * scale), `${key} left`).toBeLessThanOrEqual(1)
  expect(Math.abs(element.y - canvas.y - box.y * scale), `${key} top`).toBeLessThanOrEqual(1)
  expect(Math.abs(element.width - box.width * scale), `${key} width`).toBeLessThanOrEqual(1)
  expect(Math.abs(element.height - box.height * scale), `${key} height`).toBeLessThanOrEqual(1)
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("the canvas keeps the deck's aspect ratio at the shell's slide width", async ({ page }) => {
  const parts = await partsOf(deck)
  await open(page)
  const canvas = await page.locator("[data-slide-paint]").boundingBox()
  if (canvas === null) throw new Error("no canvas")
  const [width, height] = slideSize(parts)
  expect(canvas.width).toBe(800)
  expect(Math.abs(canvas.height - (canvas.width * height) / width)).toBeLessThanOrEqual(1)
})

test("a shape with its own box paints at that box", async ({ page }) => {
  const parts = await partsOf(deck)
  await open(page)
  const slide = "ppt/slides/slide1.xml"
  await expectPlaced(page, parts, `${slide}#2`, ownBox(part(parts, slide), "2"))
  await expectPlaced(page, parts, `${slide}#3`, ownBox(part(parts, slide), "3"))
})

test("a title with no box of its own paints at its layout placeholder's box", async ({ page }) => {
  const parts = await partsOf(deck)
  await open(page)
  await showSlide(page, 4)
  const slide = "ppt/slides/slide4.xml"
  await expectPlaced(page, parts, `${slide}#2`, inheritedBox(parts, slide, "2", "title"))
})

test("a picture paints as a box of its right size at its place", async ({ page }) => {
  const parts = await partsOf(deck)
  await open(page)
  await showSlide(page, 4)
  const slide = "ppt/slides/slide4.xml"
  await expectPlaced(page, parts, `${slide}#8`, ownBox(part(parts, slide), "8"))
})

test("a shape inside nested groups paints through every group's transform", async ({ page }) => {
  const parts = await partsOf(deck)
  const number = 24
  const slide = `ppt/slides/slide${number}.xml`
  await open(page)
  await showSlide(page, number)
  const sheet = part(parts, slide)
  expect(openGroups(sheet, sheet.indexOf('<p:cNvPr id="10"')).length).toBeGreaterThan(1)
  await expectPlaced(page, parts, `${slide}#10`, groupedBox(sheet, "10"))
})

test("only the open slide's shapes are on the page", async ({ page }) => {
  await open(page)
  await showSlide(page, 4)
  const keys = await page
    .locator("[data-canvas-element]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-canvas-element") ?? ""))
  expect(keys.some((key) => key.startsWith("ppt/slides/slide4.xml#"))).toBe(true)
  expect(keys.filter((key) => key.startsWith("ppt/slides/") && !key.startsWith("ppt/slides/slide4.xml#"))).toEqual([])
})

test("typing in a placed box keeps the box at its place and shows the text past the slide's edge", async ({ page }) => {
  const parts = await partsOf(deck)
  await open(page)
  await showSlide(page, 4)
  const slide = "ppt/slides/slide4.xml"
  const key = `${slide}#2`
  const canvas = page.locator("[data-slide-paint]")
  const editor = page.locator(`[data-canvas-element="${key}"] [contenteditable="true"]`)
  await expect(canvas).toHaveCSS("overflow-x", "clip")
  await editor.click()
  await page.keyboard.press("End")
  await page.keyboard.type("!")
  await expect(editor).toHaveText("What is a heat pump?!")
  await expect(canvas).toHaveCSS("overflow-x", "visible")
  await expectPlaced(page, parts, key, inheritedBox(parts, slide, "2", "title"))
})

async function clickOnText(page: Page, key: string): Promise<void> {
  const point = await page.locator(`[data-canvas-element="${key}"] [contenteditable="true"]`).evaluate((box) => {
    const range = box.ownerDocument.createRange()
    range.selectNodeContents(box)
    const words = range.getBoundingClientRect()
    return { x: words.x + words.width / 2, y: words.y + words.height / 2 }
  })
  await page.mouse.click(point.x, point.y)
}

test("a click on a title under an empty unfilled box edits the title and leaves the box alone", async ({ page }) => {
  await open(page)
  await showSlide(page, 29)
  const slide = "ppt/slides/slide29.xml"
  const title = page.locator(`[data-canvas-element="${slide}#2"] [contenteditable="true"]`)
  const cover = page.locator(`[data-canvas-element="${slide}#4"] [contenteditable="true"]`)
  const before = (await title.textContent()) ?? ""
  expect(before).not.toBe("")
  await clickOnText(page, `${slide}#2`)
  await expect(title).toBeFocused()
  await page.keyboard.press("Control+End")
  await page.keyboard.type("Zq")
  await expect(title).toHaveText(`${before}Zq`)
  await expect(cover).toHaveText("")
})

test("every text under an empty unfilled box takes its own click", async ({ page }) => {
  await open(page)
  for (const [number, shape] of [
    [29, "3"],
    [8, "8"],
    [8, "13"],
  ] as const) {
    await showSlide(page, number)
    const key = `ppt/slides/slide${number}.xml#${shape}`
    await clickOnText(page, key)
    await expect(page.locator(`[data-canvas-element="${key}"] [contenteditable="true"]`)).toBeFocused()
  }
})

test("an empty unfilled box the pointer passes through is still reached by Tab", async ({ page }) => {
  await open(page)
  await showSlide(page, 29)
  const slide = "ppt/slides/slide29.xml"
  await clickOnText(page, `${slide}#2`)
  await page.keyboard.press("Tab")
  await expect(page.locator(`[data-canvas-element="${slide}#4"] [contenteditable="true"]`)).toBeFocused()
})
