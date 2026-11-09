import {expect, it} from "vitest"
import {chromium} from "playwright"
import sharp from "sharp"
import {readFile, mkdir, writeFile} from "node:fs/promises"
import path from "node:path"
import {captureDocument} from "../src/capture-document.tsx"
import {layoutTextShadows} from "../src/text/shadow-layout.ts"
import {shadowTextSource} from "../../pptx/test/text-cascade-fixture.ts"
import {importPptx} from "../../pptx/src/index.ts"
import {importedNativeDeck} from "../../pptx/src/import-deck.ts"
import {flatten} from "../../deck/src/elements.ts"

async function ink(bytes: Buffer) {
  const {data, info} = await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject: true})
  let left = info.width, top = info.height, right = 0, bottom = 0, count = 0, minimum = 255
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const offset = (y * info.width + x) * info.channels
    if (data[offset]! >= 254 || data[offset + 1]! >= 254 || data[offset + 2]! >= 254) continue
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); count++; minimum = Math.min(minimum, data[offset]!)
  }
  return {left, top, right, bottom, count, minimum}
}

it("renders actual glyph masks with affine scale/skew, alignment, alpha and blur under nested coordinate scales", async () => {
  const deck = importedNativeDeck(await shadowTextSource()), text = flatten(deck.slides[0]!.elements).find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("shadow-text-required")
  const original = text.body.paragraphs[9]!, shadow = original.runs[0]!.style.outerShadow
  if (!shadow) throw new Error("source-shadow-required")
  const style = {...original.runs[0]!.style, font: "Geist", symbolFont: undefined, size: 30, color: "#000000", bold: true, outerShadow: {...shadow, blur: 0}}
  text.body.paragraphs = [{...original, indentation: {left: 0, right: 0, firstLine: 0}, marker: {kind: "none"}, spacing: {before: 0, after: 0, line: {kind: "multiple", value: 1.2}}, endStyle: style, runs: [{kind: "text", text: "Hawk", style}]}]
  text.body.frame = {...text.body.frame, anchor: "top", insets: {top: 0, right: 0, bottom: 0, left: 0}, autofit: {kind: "none"}}
  deck.slides[0]!.elements = deck.slides[0]!.elements.filter(element => element.kind === "group")
  const font = await readFile(new URL("../../ui/fonts/geist-latin-600.woff2", import.meta.url)), browser = await chromium.launch({args: ["--no-sandbox"]})
  try {
    const page = await browser.newPage({viewport: {width: 960, height: 720}, offline: true})
    await page.setContent(captureDocument(deck, deck.slides[0]!.id, `@font-face{font-family:Geist;font-weight:600;src:url(data:font/woff2;base64,${font.toString("base64")})}body{background:white}`, {}))
    await page.evaluate(async () => {await document.fonts.ready})
    await page.evaluate(layoutTextShadows)
    expect(await page.locator("[data-text-shadow-layer]").count()).toBe(1)
    const geometry = await page.evaluate(() => {
      const run = document.querySelector<HTMLElement>("[data-text-shadow]")!, paragraph = run.closest<HTMLElement>("[data-paragraph]")!, layer = document.querySelector<HTMLElement>("[data-text-shadow-layer]")!, clone = layer.firstElementChild!
      return {matrix: getComputedStyle(clone).transform, filter: getComputedStyle(layer).filter, opacity: getComputedStyle(layer).opacity, run: run.getBoundingClientRect().toJSON(), paragraph: paragraph.getBoundingClientRect().toJSON(), localWidth: paragraph.offsetWidth, localHeight: paragraph.offsetHeight}
    })
    const matrix = geometry.matrix.slice(7, -1).split(",").map(Number), nestedScaleX = geometry.paragraph.width / geometry.localWidth, nestedScaleY = geometry.paragraph.height / geometry.localHeight
    expect(matrix[0]).toBe(1)
    expect(matrix[1]).toBe(0)
    expect(matrix[2]).toBeCloseTo(Math.tan(21.67 * Math.PI / 180) * 0.3, 5)
    expect(matrix[3]).toBe(0.3)
    expect(geometry.opacity).toBe("0.32")
    expect(geometry.filter).toBe("blur(0px)")
    expect(nestedScaleX).toBe(4)
    await page.locator("[data-text-shadow-layers]").evaluate(element => {element.setAttribute("style", "display:none")})
    const glyphs = await ink(await page.screenshot())
    await page.locator("[data-text-shadow-layers]").evaluate(element => {element.setAttribute("style", "position:absolute;inset:0;pointer-events:none;z-index:-1")})
    await page.locator("[data-text]").evaluate(element => {element.setAttribute("style", element.getAttribute("style") + ";visibility:hidden")})
    const effect = await ink(await page.screenshot())
    expect(effect.count).toBeGreaterThan(100)
    expect(effect.minimum).toBeGreaterThanOrEqual(172)
    expect(effect.minimum).toBeLessThanOrEqual(176)
    expect(effect.bottom - effect.top).toBeLessThan((glyphs.bottom - glyphs.top) * 0.4)
    const expected = (x: number, y: number) => ({x: geometry.paragraph.x + matrix[0]! * (x - geometry.paragraph.x) + matrix[2]! * (y - geometry.paragraph.y) * nestedScaleX / nestedScaleY + matrix[4]! * nestedScaleX, y: geometry.paragraph.y + matrix[3]! * (y - geometry.paragraph.y) + matrix[5]! * nestedScaleY})
    const corners = [expected(glyphs.left, glyphs.top), expected(glyphs.right, glyphs.bottom)]
    expect(Math.abs(effect.top - Math.min(...corners.map(value => value.y)))).toBeLessThan(3)
    expect(Math.abs(effect.bottom - Math.max(...corners.map(value => value.y)))).toBeLessThan(3)
    expect(Math.abs(effect.left - Math.min(...corners.map(value => value.x)))).toBeLessThan(6)
    await page.locator("[data-text-shadow]").evaluate((element, blur) => {element.setAttribute("data-shadow-blur", String(blur))}, shadow.blur)
    await page.evaluate(layoutTextShadows)
    const blurred = await ink(await page.screenshot())
    expect(blurred.count).toBeGreaterThan(effect.count)
    expect(blurred.bottom - blurred.top).toBeGreaterThan(effect.bottom - effect.top)
    await page.evaluate(layoutTextShadows)
    expect(await ink(await page.screenshot())).toEqual(blurred)
    await page.locator("[data-text-shadow]").evaluate(element => {
      element.dataset.shadowAlignment = "br"
      element.dataset.shadowSx = "0.75"
      element.dataset.shadowSy = "0.5"
      element.dataset.shadowKx = "-8"
      element.dataset.shadowKy = "12"
      element.dataset.shadowDirection = "90"
    })
    await page.evaluate(layoutTextShadows)
    const bottomRight = await page.evaluate(() => {
      const run = document.querySelector<HTMLElement>("[data-text-shadow]")!, paragraph = run.closest<HTMLElement>("[data-paragraph]")!, range = document.createRange()
      range.selectNodeContents(run)
      const glyphs = range.getBoundingClientRect(), box = paragraph.getBoundingClientRect(), sx = box.width / paragraph.offsetWidth, sy = box.height / paragraph.offsetHeight
      return {matrix: getComputedStyle(document.querySelector("[data-text-shadow-layer]")!.firstElementChild!).transform.slice(7, -1).split(",").map(Number), x: (glyphs.right - box.x) / sx, y: (glyphs.bottom - box.y) / sy, distance: Number(run.dataset.shadowDistance)}
    })
    const a = 0.75, b = Math.tan(12 * Math.PI / 180) * a, c = Math.tan(-8 * Math.PI / 180) * 0.5, d = 0.5
    expect(bottomRight.matrix[0]).toBe(a)
    expect(bottomRight.matrix[1]).toBeCloseTo(b, 5)
    expect(bottomRight.matrix[2]).toBeCloseTo(c, 5)
    expect(bottomRight.matrix[4]).toBeCloseTo(bottomRight.x - a * bottomRight.x - c * bottomRight.y, 3)
    expect(bottomRight.matrix[5]).toBeCloseTo(bottomRight.y - b * bottomRight.x - d * bottomRight.y + bottomRight.distance, 3)
    const artifacts = process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS
    if (artifacts) {await mkdir(artifacts, {recursive: true}); await page.screenshot({path: path.join(artifacts, "affine-text-shadow-nested.png")})}
  } finally {await browser.close()}
})

it.each([{name: "dalrrd", slideNumber: 3}, {name: "dalrrd", slideNumber: 22}, {name: "performance", slideNumber: 1}])("captures actual $name slide $slideNumber glyph shadows through the shared Slide snapshot", async ({name, slideNumber}) => {
  const source = await importPptx(await readFile(new URL(`../../pptx/test/corpus/${name}.pptx`, import.meta.url))), deck = importedNativeDeck(source), slide = deck.slides.find(slide => slide.source.kind === "original" && slide.source.part === `ppt/slides/slide${slideNumber}.xml`)!
  const browser = await chromium.launch({args: ["--no-sandbox"]})
  try {
    const page = await browser.newPage({viewport: {width: Math.ceil(slide.size.width), height: Math.ceil(slide.size.height)}, offline: true})
    await page.setContent(captureDocument(deck, slide.id, name === "performance" ? "[data-slide]{background:#7694a4!important}" : "body{background:white}", {}))
    await page.evaluate(async () => {await document.fonts.ready})
    await page.evaluate(layoutTextShadows)
    expect(await page.locator("[data-text-shadow-layer]").count()).toBeGreaterThan(0)
    const withShadow = await page.screenshot(), artifacts = process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS
    if (artifacts) {await mkdir(artifacts, {recursive: true}); await page.screenshot({path: path.join(artifacts, `${name}-slide${slideNumber}-shadow.png`)})}
    await page.locator("[data-text-shadow-layers]").evaluateAll(elements => elements.forEach(element => {element.setAttribute("style", "display:none")}))
    const withoutShadow = await page.screenshot(), original = await sharp(withShadow).removeAlpha().raw().toBuffer(), hidden = await sharp(withoutShadow).removeAlpha().raw().toBuffer()
    let differences = 0
    for (let index = 0; index < original.length; index += 3) if (original[index] !== hidden[index] || original[index + 1] !== hidden[index + 1] || original[index + 2] !== hidden[index + 2]) differences++
    expect(differences).toBeGreaterThan(10)
    if (artifacts) {
      const layers = await page.locator("[data-text-shadow-layer]").evaluateAll(layers => layers.map(layer => ({bounds: layer.getBoundingClientRect().toJSON(), matrix: getComputedStyle(layer.firstElementChild!).transform})))
      await writeFile(path.join(artifacts, `${name}-slide${slideNumber}-shadow-pixels.json`), JSON.stringify({changedPixels: differences, diagnosticBackdrop: name === "performance" ? "#7694a4" : "white", layers}, null, 2))
    }
    console.log(JSON.stringify({artifact: "actual-source-glyph-shadow", name, slideNumber, changedPixels: differences}))
  } finally {await browser.close()}
}, 120000)
