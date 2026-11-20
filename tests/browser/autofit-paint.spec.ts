import { actualSize } from "./paint-scale"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { unfold } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { partsOf, shapeAt } from "./shape-fills"
import { bodyCopy } from "../../apps/web/src/copy/body-copy"
import { decksOn, test } from "./deck-test"

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly ZipWriter: new (writer: unknown) => {
    add(name: string, reader: unknown): Promise<unknown>
    close(): Promise<Uint8Array>
  }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const slidePart = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

const words = (count: number, size: number) =>
  Array.from(
    { length: count },
    (_, at) =>
      `<a:p><a:r><a:rPr lang="en-US" sz="${size}"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:rPr><a:t>Line ${at + 1} of the text</a:t></a:r></a:p>`,
  ).join("")

const box = (id: number, [x, y, cx, cy]: readonly number[], body: string, paragraphs: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Box ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="DDEEFF"/></a:solidFill></p:spPr><p:txBody>${body}<a:lstStyle/>${paragraphs}</p:txBody></p:sp>`

const boxes = [
  box(
    20,
    [6400800, 457200, 5334000, 1828800],
    '<a:bodyPr numCol="2" anchor="ctr"><a:noAutofit/></a:bodyPr>',
    words(3, 1800),
  ),
  box(
    21,
    [457200, 2514600, 3657600, 1828800],
    '<a:bodyPr numCol="2" anchor="b"><a:noAutofit/></a:bodyPr>',
    words(3, 1800),
  ),
  box(22, [4343400, 2514600, 3657600, 1371600], '<a:bodyPr anchor="t"><a:normAutofit/></a:bodyPr>', words(9, 1800)),
  box(23, [8229600, 2514600, 3657600, 457200], '<a:bodyPr anchor="t"><a:spAutoFit/></a:bodyPr>', words(5, 1800)),
  box(
    24,
    [457200, 4800600, 3657600, 1828800],
    '<a:bodyPr anchor="t"><a:normAutofit fontScale="62500" lnSpcReduction="20000"/></a:bodyPr>',
    words(3, 2800),
  ),
  box(25, [4343400, 4800600, 3657600, 1371600], '<a:bodyPr anchor="t"><a:noAutofit/></a:bodyPr>', words(9, 1800)),
].join("")

async function fitDeck(): Promise<Buffer> {
  const reader = new zip.ZipReader(
    new zip.Uint8ArrayReader(new Uint8Array(await readFile(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")))),
  )
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue
    let bytes = await entry.getData(new zip.Uint8ArrayWriter())
    if (entry.filename === slidePart)
      bytes = new TextEncoder().encode(
        Buffer.from(bytes).toString("utf8").replace("</p:spTree>", `${boxes}</p:spTree>`),
      )
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  return Buffer.from(await writer.close())
}

type Laid = {
  readonly top: number
  readonly bottom: number
  readonly height: number
  readonly font: number
  readonly lefts: readonly number[]
  readonly textTop: number
  readonly textBottom: number
}

function laid(shape: Locator): Promise<Laid> {
  return shape.evaluate((node) => {
    const frame = node.getBoundingClientRect()
    const paragraphs = [...node.querySelectorAll("[data-paragraph]")].map((each) => each.getBoundingClientRect())
    const run = node.querySelector("[data-paragraph] span")
    return {
      top: frame.top,
      bottom: frame.bottom,
      height: frame.height,
      font: run === null ? 0 : Number.parseFloat(getComputedStyle(run).fontSize),
      lefts: [...new Set(paragraphs.map((each) => Math.round(each.left)))],
      textTop: Math.min(...paragraphs.map((each) => each.top)),
      textBottom: Math.max(...paragraphs.map((each) => each.bottom)),
    }
  })
}

async function opened(page: Page, file: string | Buffer): Promise<void> {
  await decksOn(page).open(
    typeof file === "string"
      ? file
      : {
          name: "autofit.pptx",
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          buffer: file,
        },
  )
  await actualSize(page)
  await decksOn(page).ready()
}

test("the canvas anchors text in columns, keeps the fit a file stored until its text changes and grows a box to fit as its file says, and a person chooses each autofit through Undo, a reload, the export and a new import @export", async ({
  page,
  decks,
}, testInfo) => {
  await opened(page, await fitDeck())
  await actualSize(page)
  const centred = await laid(shapeAt(page, "20"))
  expect(centred.lefts).toHaveLength(1)
  expect(Math.abs((centred.textTop + centred.textBottom) / 2 - (centred.top + centred.bottom) / 2)).toBeLessThan(3)
  const low = await laid(shapeAt(page, "21"))
  expect(low.lefts).toHaveLength(1)
  expect(low.bottom - low.textBottom).toBeLessThan(10)
  expect(low.textTop - low.top).toBeGreaterThan(3 * (low.bottom - low.textBottom))

  const loose = await laid(shapeAt(page, "25"))
  expect(loose.textBottom).toBeGreaterThan(loose.bottom)
  const held = await laid(shapeAt(page, "22"))
  expect(held.font).toBe(loose.font)
  expect(held.textBottom).toBeGreaterThan(held.bottom)
  const grown = await laid(shapeAt(page, "23"))
  expect(grown.height).toBeGreaterThan(loose.height / 2)
  expect(grown.textBottom).toBeLessThanOrEqual(grown.bottom + 1)
  const stored = await laid(shapeAt(page, "24"))
  expect(stored.font / loose.font).toBeCloseTo((28 * 0.625) / 18, 2)
  await page.locator("[data-slide-paint]").screenshot({ path: testInfo.outputPath("autofit-file.png") })

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await shapeAt(page, "25").click({ position: { x: 4, y: 4 } })
  await unfold(page.locator("[data-design-element]"), bodyCopy.section)
  const autofit = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: "Text box", exact: true }) })
    .getByRole("combobox", { name: "Autofit", exact: true })
  const choose = async (option: string) => {
    await autofit.click()
    await page.getByRole("option", { name: option, exact: true }).click()
    await expect(autofit).toHaveText(new RegExp(`^${option}`))
  }
  await expect(autofit).toHaveText(/^Do not Autofit/)
  await choose("Shrink text on overflow")
  await expect.poll(async () => (await laid(shapeAt(page, "25"))).font).toBeLessThan(loose.font)
  const fitted = await laid(shapeAt(page, "25"))
  expect(fitted.textBottom).toBeLessThanOrEqual(fitted.bottom + 1)
  await page.getByRole("button", { name: "Undo text box", exact: true }).click()
  await expect.poll(async () => (await laid(shapeAt(page, "25"))).font).toBe(loose.font)
  await expect(autofit).toHaveText(/^Do not Autofit/)
  await choose("Resize shape to fit text")
  await expect.poll(async () => (await laid(shapeAt(page, "25"))).height).toBeGreaterThan(loose.height)
  const taller = await laid(shapeAt(page, "25"))
  expect(taller.font).toBe(loose.font)
  expect(taller.top).toBeCloseTo(loose.top, 0)
  expect(taller.textBottom).toBeLessThanOrEqual(taller.bottom + 1)

  await page.reload()
  await decks.ready()
  await actualSize(page)
  await expect.poll(async () => (await laid(shapeAt(page, "25"))).height).toBeCloseTo(taller.height, 0)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("exported-autofit.pptx")
  await (await saving).saveAs(file)
  const xml = (await partsOf(file)).get(slidePart)?.toString("utf8") ?? ""
  expect(xml).toMatch(/<p:cNvPr id="25" name="Box 25"\/>.*?<a:bodyPr anchor="t"><a:spAutoFit\/><\/a:bodyPr>/)
  const fittedHeight = Number(/<p:cNvPr id="25" name="Box 25"\/>.*?<a:ext cx="\d+" cy="(\d+)"/.exec(xml)?.[1])
  expect(fittedHeight / 9_525).toBeCloseTo(taller.height, 0)
  await opened(page, file)
  await actualSize(page)
  await expect.poll(async () => (await laid(shapeAt(page, "25"))).height).toBeCloseTo(taller.height, 0)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await shapeAt(page, "25").click({ position: { x: 4, y: 4 } })
  await unfold(page.locator("[data-design-element]"), bodyCopy.section)
  await expect(autofit).toHaveText(/^Resize shape to fit text/)
  await choose("Do not Autofit")
  await expect(autofit).toHaveText(/^Do not Autofit/)
  expect((await laid(shapeAt(page, "25"))).height).toBeCloseTo(taller.height, 0)
  expect((await laid(shapeAt(page, "25"))).font).toBe(loose.font)

  await shapeAt(page, "22").locator('[contenteditable="true"]').focus()
  await page.keyboard.press("Control+End")
  for (let line = 0; line < 3; line += 1) {
    await page.keyboard.press("Enter")
    await page.keyboard.type("One more line")
  }
  await expect.poll(async () => (await laid(shapeAt(page, "22"))).font).toBeLessThan(held.font)
  const typed = await laid(shapeAt(page, "22"))
  expect(typed.textBottom).toBeLessThanOrEqual(typed.bottom + 1)
  expect(typed.font).toBeGreaterThan(loose.font / 4)
})
