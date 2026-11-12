import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"

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
  readonly ZipWriter: new (writer: unknown) => {
    add(name: string, reader: unknown): Promise<unknown>
    close(): Promise<Uint8Array>
  }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function partsOf(file: string | Uint8Array): Promise<Map<string, string>> {
  const bytes = typeof file === "string" ? new Uint8Array(await readFile(file)) : file
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(bytes))
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

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const id = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return id !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === id
  })
}

async function open(page: Page, file: Parameters<Locator["setInputFiles"]>[0] = deck): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await settled(page)
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

const corpusDeck = (name: string): string => join(process.cwd(), "scripts/pptx-fixtures/corpus", name)
const emuPerPoint = 12_700
const styleNames = ["font-size", "font-weight", "font-style", "font-family", "color"] as const

type Computed = Record<(typeof styleNames)[number], string>

function slideNumber(parts: ReadonlyMap<string, string>, slide: string): number {
  const target = slide.replace(/^ppt\//, "")
  const relationship = [...part(parts, "ppt/_rels/presentation.xml.rels").matchAll(/<Relationship\s[^>]*>/g)].find(
    (each) => each[0].includes(`Target="${target}"`),
  )
  const id = relationship === undefined ? undefined : /Id="([^"]+)"/.exec(relationship[0])?.[1]
  const order = [...part(parts, "ppt/presentation.xml").matchAll(/<p:sldId\s[^>]*r:id="([^"]+)"/g)].map(
    (each) => each[1],
  )
  if (id === undefined || !order.includes(id)) throw new Error(`no order for ${slide}`)
  return order.indexOf(id) + 1
}

function themeColor(parts: ReadonlyMap<string, string>, slide: string, scheme: string): string {
  const master = relationshipTarget(parts, relationshipTarget(parts, slide, "slideLayout"), "slideMaster")
  const map = /<p:clrMap\s[^>]*>/.exec(part(parts, master))?.[0] ?? ""
  const slot = new RegExp(`\\s${scheme}="(\\w+)"`).exec(map)?.[1] ?? scheme
  const theme = part(parts, relationshipTarget(parts, master, "theme"))
  const color = new RegExp(`<a:${slot}>(.*?)</a:${slot}>`, "s").exec(theme)?.[1] ?? ""
  const value = /(?:lastClr|srgbClr val)="([0-9A-Fa-f]{6})"/.exec(color)?.[1]
  if (value === undefined) throw new Error(`no colour for ${scheme}`)
  return value
}

function rgb(hex: string): string {
  return `rgb(${[0, 2, 4].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(", ")})`
}

function paragraphsIn(shape: string): readonly string[] {
  return [...shape.matchAll(/<a:p(?:\/>|>.*?<\/a:p>)/gs)].map((each) => each[0])
}

function inlinesIn(paragraph: string): readonly string[] {
  return [...paragraph.matchAll(/<a:(r|br|fld)(?:\s[^>]*)?(?:\/>|>.*?<\/a:\1>)/gs)].map((each) => each[0])
}

function textOf(inline: string): string {
  return /<a:t>(.*?)<\/a:t>/s.exec(inline)?.[1] ?? ""
}

function formatOf(inline: string): string {
  return /<a:rPr(?:[^>]*\/>|.*?<\/a:rPr>)/s.exec(inline)?.[0] ?? ""
}

function pointsOf(markup: string): number {
  const found = /\ssz="(\d+)"/.exec(markup)?.[1]
  if (found === undefined) throw new Error("no size")
  return Number(found) / 100
}

async function computed(element: Locator): Promise<Computed> {
  return element.evaluate(
    (node, names) => {
      const style = getComputedStyle(node)
      return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)])) as Computed
    },
    [...styleNames],
  )
}

async function canvasScale(page: Page, parts: ReadonlyMap<string, string>): Promise<number> {
  const canvas = await page.locator("[data-slide-paint]").boundingBox()
  if (canvas === null) throw new Error("no canvas")
  return canvas.width / slideSize(parts)[0]
}

async function expectSize(element: Locator, points: number, scale: number): Promise<void> {
  const size = Number.parseFloat((await computed(element))["font-size"])
  expect(Math.abs(size - points * emuPerPoint * scale)).toBeLessThan(0.02)
}

async function recoloredDeck(file: string, slot: string, hex: string): Promise<Uint8Array> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue
    let bytes = await entry.getData(new zip.Uint8ArrayWriter())
    if (/^ppt\/theme\/[^/]+\.xml$/.test(entry.filename)) {
      const theme = Buffer.from(bytes).toString("utf8")
      const pattern = new RegExp(`<a:${slot}>.*?</a:${slot}>`, "s")
      bytes = Buffer.from(theme.replace(pattern, `<a:${slot}><a:srgbClr val="${hex}"/></a:${slot}>`), "utf8")
    }
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  return writer.close()
}

test("a slide paints the background its XML names, through the theme", async ({ page }) => {
  const source = join(process.cwd(), "scripts/pptx-fixtures/nasa-1d-cnn.pptx")
  const bytes = await recoloredDeck(source, "lt1", "1A2B3C")
  const parts = await partsOf(bytes)
  const slide = "ppt/slides/slide1.xml"
  const named = /<p:bg>.*?<a:schemeClr val="(\w+)"/s.exec(part(parts, slide))?.[1]
  if (named === undefined) throw new Error("no background")
  await open(page, {
    name: "recolored.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: Buffer.from(bytes),
  })
  await showSlide(page, slideNumber(parts, slide))
  await expect(page.locator("[data-slide-paint]")).toHaveCSS("background-color", rgb(themeColor(parts, slide, named)))
})

test("a white background from the file stays white", async ({ page }) => {
  await open(page, join(process.cwd(), "scripts/pptx-fixtures/nasa-1d-cnn.pptx"))
  await expect(page.locator("[data-slide-paint]")).toHaveCSS("background-color", "rgb(255, 255, 255)")
})

test("a shape paints its own fill and its own line", async ({ page }) => {
  const file = corpusDeck("nasa-aqua-senior-review.pptx")
  const parts = await partsOf(file)
  const slide = "ppt/slides/slide6.xml"
  const shape = shapeXml(part(parts, slide), "6")
  const properties = /<p:spPr>.*?<\/p:spPr>/s.exec(shape)?.[0] ?? ""
  const fill = /<\/a:prstGeom><a:solidFill><a:srgbClr val="(\w+)"><a:alpha val="(\d+)"/.exec(properties)
  const line = /<a:ln>.*?<a:srgbClr val="(\w+)"/s.exec(properties)?.[1]
  const lineStyle = /<a:lnRef idx="(\d+)"/.exec(shape)?.[1]
  if (fill === null || line === undefined || lineStyle === undefined) throw new Error("no fill or line")
  const master = relationshipTarget(parts, relationshipTarget(parts, slide, "slideLayout"), "slideMaster")
  const styles = /<a:lnStyleLst>(.*?)<\/a:lnStyleLst>/s.exec(
    part(parts, relationshipTarget(parts, master, "theme")),
  )?.[1]
  const widths = [...(styles ?? "").matchAll(/<a:ln\s[^>]*w="(\d+)"/g)].map((each) => Number(each[1]))
  const width = widths[Number(lineStyle) - 1]
  if (width === undefined) throw new Error("no line width")
  await open(page, file)
  await showSlide(page, slideNumber(parts, slide))
  const scale = await canvasScale(page, parts)
  const element = page.locator(`[data-canvas-element="${slide}#6"]`)
  const opaque = rgb(fill[1] ?? "")
    .replace("rgb(", "rgba(")
    .replace(")", "")
  await expect(element).toHaveCSS("background-color", `${opaque}, ${Number(fill[2]) / 100_000})`)
  const stroke = element.locator("[data-canvas-line] rect")
  await expect(stroke).toHaveCSS("stroke", rgb(line))
  const drawn = await stroke.evaluate((node) => Number.parseFloat(getComputedStyle(node).strokeWidth))
  expect(Math.abs(drawn - width * scale)).toBeLessThan(0.02)
})

test("a shape's fill comes through the theme", async ({ page }) => {
  const file = corpusDeck("nasa-on-orbit-failures.pptx")
  const parts = await partsOf(file)
  const slide = "ppt/slides/slide18.xml"
  const named = /<\/a:prstGeom><a:solidFill><a:schemeClr val="(\w+)"\/>/.exec(shapeXml(part(parts, slide), "5"))?.[1]
  if (named === undefined) throw new Error("no theme fill")
  await open(page, file)
  await showSlide(page, slideNumber(parts, slide))
  await expect(page.locator(`[data-canvas-element="${slide}#5"]`)).toHaveCSS(
    "background-color",
    rgb(themeColor(parts, slide, named)),
  )
})

const nesc = corpusDeck("nasa-cots-parts-nesc.pptx")
const nescSlide = "ppt/slides/slide11.xml"

type Marked = { readonly at: number; readonly markup: string }

function markedRuns(parts: ReadonlyMap<string, string>): {
  readonly blue: Marked
  readonly bold: Marked
  readonly plain: Marked
} {
  const inlines = inlinesIn(paragraphsIn(shapeXml(part(parts, nescSlide), "3"))[1] ?? "")
  const pick = (test: (inline: string) => boolean): Marked => {
    const at = inlines.findIndex(test)
    const markup = inlines[at]
    if (markup === undefined) throw new Error("no such run")
    return { at, markup }
  }
  const heavy = (inline: string) => /\sb="1"/.test(formatOf(inline))
  const tinted = (inline: string) => /srgbClr/.test(formatOf(inline))
  return {
    blue: pick((inline) => tinted(inline) && !heavy(inline)),
    bold: pick((inline) => heavy(inline) && !tinted(inline)),
    plain: pick((inline) => !heavy(inline) && !tinted(inline)),
  }
}

test("three runs each paint the size, weight and colour their XML names", async ({ page }) => {
  const parts = await partsOf(nesc)
  const { blue, bold, plain } = markedRuns(parts)
  expect(shapeXml(part(parts, nescSlide), "3")).not.toContain("fontScale")
  await open(page, nesc)
  await showSlide(page, slideNumber(parts, nescSlide))
  const scale = await canvasScale(page, parts)
  const run = (at: number) => page.locator(`[data-canvas-element="${nescSlide}#3"] [data-run="1.${at}"]`)
  for (const each of [blue, bold, plain]) {
    await expect(run(each.at)).toHaveText(textOf(each.markup))
    await expectSize(run(each.at), pointsOf(formatOf(each.markup)), scale)
  }
  const tint = /srgbClr val="(\w+)"/.exec(formatOf(blue.markup))?.[1] ?? ""
  await expect(run(blue.at)).toHaveCSS("color", rgb(tint))
  await expect(run(bold.at)).not.toHaveCSS("color", rgb(tint))
  await expect(run(bold.at)).toHaveCSS("font-weight", "700")
  await expect(run(plain.at)).toHaveCSS("font-weight", "400")
})

test("a title with no size of its own paints its layout's size and its theme's font", async ({ page }) => {
  const file = corpusDeck("nasa-accp-visualizations.pptx")
  const parts = await partsOf(file)
  const slide = "ppt/slides/slide9.xml"
  const shape = shapeXml(part(parts, slide), "2")
  expect(formatOf(inlinesIn(paragraphsIn(shape)[0] ?? "")[0] ?? "")).not.toContain(" sz=")
  const layout = relationshipTarget(parts, slide, "slideLayout")
  const title = [...part(parts, layout).matchAll(/<p:sp>.*?<\/p:sp>/gs)].find((each) =>
    each[0].includes('<p:ph type="title"'),
  )?.[0]
  const size = /<a:lstStyle>.*?<a:defRPr[^>]*\ssz="(\d+)"/s.exec(title ?? "")?.[1]
  if (size === undefined) throw new Error("no layout size")
  const master = relationshipTarget(parts, layout, "slideMaster")
  const theme = part(parts, relationshipTarget(parts, master, "theme"))
  const font = /<a:majorFont><a:latin typeface="([^"]+)"/.exec(theme)?.[1] ?? ""
  await open(page, file)
  await showSlide(page, slideNumber(parts, slide))
  const scale = await canvasScale(page, parts)
  const run = page.locator(`[data-canvas-element="${slide}#2"] [data-run="0.0"]`)
  await expectSize(run, Number(size) / 100, scale)
  expect((await computed(run))["font-family"]).toContain(font)
  await expect(run).toHaveCSS("color", rgb(themeColor(parts, slide, "tx1")))
})

test("an empty paragraph paints the size its end mark names", async ({ page }) => {
  const parts = await partsOf(nesc)
  const slide = "ppt/slides/slide10.xml"
  const shape = shapeXml(part(parts, slide), "3")
  const empty = paragraphsIn(shape)[11] ?? ""
  expect(empty).not.toContain("<a:r>")
  const shrink = Number(/fontScale="(\d+)"/.exec(shape)?.[1]) / 100_000
  const size = pointsOf(/<a:endParaRPr[^>]*>/.exec(empty)?.[0] ?? "") * shrink
  await open(page, nesc)
  await showSlide(page, slideNumber(parts, slide))
  const scale = await canvasScale(page, parts)
  await expectSize(page.locator(`[data-canvas-element="${slide}#3"] [data-paragraph="11"]`), size, scale)
})

async function caretIn(box: Locator, run: string, offset: number): Promise<void> {
  await box.focus()
  await box.locator(`[data-run="${run}"]`).evaluate((span, at) => {
    const text = span.firstChild
    if (text === null) throw new Error("no text")
    span.ownerDocument.getSelection()?.collapse(text, at)
  }, offset)
}

async function runStyles(box: Locator): Promise<Record<string, Computed & { text: string }>> {
  return box.locator("[data-run]").evaluateAll(
    (nodes, names) => {
      const shown: Record<string, unknown> = {}
      for (const node of nodes) {
        const style = getComputedStyle(node)
        shown[node.getAttribute("data-run") ?? ""] = {
          text: node.textContent,
          ...Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)])),
        }
      }
      return shown as Record<string, Computed & { text: string }>
    },
    [...styleNames],
  )
}

async function storedBox(page: Page, box: Locator): Promise<void> {
  const text = await box
    .locator("[data-paragraph]")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent).join("\n"))
  await page.waitForFunction(async (expected) => {
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = indexedDB.open("airdesign")
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const all = request.result.transaction("rows", "readonly").objectStore("rows").getAll()
        all.onerror = () => reject(all.error)
        all.onsuccess = () => {
          request.result.close()
          resolve(all.result as unknown[])
        }
      }
    })
    return rows.some((row) => {
      const value = (row as { value?: unknown }).value
      if (typeof value !== "string" || !value.startsWith("[")) return false
      const paragraphs = JSON.parse(value) as { runs: { text: string }[] }[]
      return paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n") === expected
    })
  }, text)
}

async function exportedParts(page: Page, file: string): Promise<Map<string, string>> {
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  await (await download).saveAs(file)
  return partsOf(file)
}

async function allPartsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

test("typing keeps each run's style on its own words through a reload and the export", async ({ page }, testInfo) => {
  const parts = await partsOf(nesc)
  const { blue: next, bold } = markedRuns(parts)
  expect(bold.at + 1).toBe(next.at)
  const number = slideNumber(parts, nescSlide)
  await open(page, nesc)
  await showSlide(page, number)
  const box = page.locator(`[data-canvas-element="${nescSlide}#3"] [contenteditable="true"]`)
  const before = await runStyles(box)
  const boldName = `1.${bold.at}`
  const nextName = `1.${next.at}`
  const boldText = textOf(bold.markup)
  const nextText = textOf(next.markup)

  await caretIn(box, nextName, 2)
  await page.keyboard.type("Zq")
  await caretIn(box, boldName, boldText.length)
  await page.keyboard.type("Wy")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.type("K")

  const typedBold = `${boldText}Wy`
  const typedNext = `${nextText.slice(0, 1)}K${nextText.slice(1, 2)}Zq${nextText.slice(2)}`
  const expectTyped = async () => {
    const after = await runStyles(box)
    expect(after[boldName]?.text).toBe(typedBold)
    expect(after[nextName]?.text).toBe(typedNext)
    for (const [name, shown] of Object.entries(before)) {
      const { text: oldText, ...oldStyle } = shown
      const now = after[name]
      if (now === undefined) throw new Error(`no run ${name}`)
      const { text: newText, ...newStyle } = now
      expect(newStyle, name).toEqual(oldStyle)
      if (name !== boldName && name !== nextName) expect(newText, name).toBe(oldText)
    }
  }
  await expectTyped()
  await storedBox(page, box)
  await page.reload()
  await settled(page)
  await showSlide(page, number)
  await expectTyped()

  const file = testInfo.outputPath("styled.pptx")
  const saved = await exportedParts(page, file)
  const original = await allPartsOf(nesc)
  const written = await allPartsOf(file)
  expect([...written.keys()]).toEqual([...original.keys()])
  expect(
    [...original].filter(([name, bytes]) => written.get(name)?.equals(bytes) !== true).map(([name]) => name),
  ).toEqual([nescSlide])
  const inlines = inlinesIn(paragraphsIn(shapeXml(part(saved, nescSlide), "3"))[1] ?? "")
  expect(textOf(inlines[bold.at] ?? "")).toBe(typedBold)
  expect(textOf(inlines[next.at] ?? "")).toBe(typedNext)
  expect(formatOf(inlines[bold.at] ?? "")).toBe(formatOf(bold.markup))
  expect(formatOf(inlines[next.at] ?? "")).toBe(formatOf(next.markup))
})

test("a run deleted key by key leaves the next words in the style the export writes", async ({ page }) => {
  const parts = await partsOf(nesc)
  const { bold } = markedRuns(parts)
  await open(page, nesc)
  await showSlide(page, slideNumber(parts, nescSlide))
  const box = page.locator(`[data-canvas-element="${nescSlide}#3"] [contenteditable="true"]`)
  const name = `1.${bold.at}`
  const text = textOf(bold.markup)
  await caretIn(box, name, text.length)
  for (const _ of text) await page.keyboard.press("Backspace")
  await page.keyboard.type("Q")
  await expect(box.locator("[data-paragraph] span:not([data-run])")).toHaveCount(0)
  await expect(box.locator("[data-paragraph] b, [data-paragraph] i, [data-paragraph] font")).toHaveCount(0)
})

test("typing past the bottom of a styled box shows the words below it", async ({ page }) => {
  const parts = await partsOf(nesc)
  await open(page, nesc)
  await showSlide(page, slideNumber(parts, nescSlide))
  const element = page.locator(`[data-canvas-element="${nescSlide}#3"]`)
  const box = element.locator('[contenteditable="true"]')
  await box.focus()
  await page.keyboard.press("Control+End")
  for (let line = 0; line < 14; line += 1) {
    await page.keyboard.press("Enter")
    await page.keyboard.type("Zq")
  }
  const last = box.locator("[data-paragraph]").last()
  await expect(last).toHaveText("Zq")
  const lastBox = await last.boundingBox()
  const frameBox = await element.boundingBox()
  if (lastBox === null || frameBox === null) throw new Error("no box")
  expect(lastBox.y).toBeGreaterThan(frameBox.y + frameBox.height)
  const clipped = await last.evaluate((node) => {
    const held: string[] = []
    for (let at = node.parentElement; at !== null; at = at.parentElement) {
      const overflow = getComputedStyle(at).overflowY
      if (overflow !== "visible") held.push(overflow)
      if (at.hasAttribute("data-slide-paint")) break
    }
    return held
  })
  expect(clipped).toEqual([])
})
