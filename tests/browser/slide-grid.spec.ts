import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const sectioned = join(fixtures, "sections-before.pptx")
const clean = join(fixtures, "clean.pptx")
const deckAddress = /\/deck\/[A-Za-z0-9_-]{1,64}$/
const fifty = 50
const hundred = 100

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

function mark(number: number, count: number): string {
  return `Mark ${String(number).padStart(String(count).length, "0")}`
}

async function manySlides(count: number): Promise<Buffer> {
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

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function openFile(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await expect(page).toHaveURL(deckAddress)
  await settled(page)
}

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

async function openGrid(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Grid" }).click()
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
}

async function ringed(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement)) return false
    const probe = document.createElement("span")
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue("--focus-ring")
    document.body.append(probe)
    const ring = getComputedStyle(probe).color
    probe.remove()
    const style = getComputedStyle(el)
    return style.outlineStyle === "solid" && style.outlineWidth === "2px" && style.outlineColor === ring
  })
}

test("the grid shows every slide, and the keyboard opens one", async ({ page }) => {
  await openFile(page, sectioned)
  await openGrid(page)
  await expect(page.getByRole("heading", { name: "Opening" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Numbers" })).toBeVisible()
  await expect(entry(page, 1)).toHaveAccessibleName("Slide 1 of 2")
  await expect(entry(page, 2)).toHaveAccessibleName("Slide 2 of 2")
  await expect(page.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("slider", { name: "Zoom" })).toHaveAttribute("aria-valuetext", "4 slides per row")
  const motions = await page
    .locator("[data-editor-grid]")
    .evaluate((root) =>
      root.getAnimations({ subtree: true }).map((animation) => animation.effect?.getComputedTiming().duration ?? 0),
    )
  expect(motions.filter((duration) => duration !== 0)).toEqual([])
  await entry(page, 1).focus()
  await page.keyboard.press("ArrowRight")
  await expect(entry(page, 2)).toBeFocused()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  expect(await ringed(page)).toBe(true)
  await page.keyboard.press("ArrowDown")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(entry(page, 1)).toBeFocused()
  await page.keyboard.press("End")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("Home")
  await expect(entry(page, 1)).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
  await expect(page.locator("[data-slide-paint]")).toBeVisible()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await openGrid(page)
  await page.getByRole("button", { name: "Slides" }).click()
  await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
  await expect(page.locator("[data-editor-sidebar]")).toBeVisible()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
})

test("the grid adds, reorders, duplicates and deletes a slide without a mouse", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  const said = page.locator("[data-editor-grid] [data-announcer]")
  const plus = page.locator('[aria-label="Add slide after slide 1"]')
  await expect(plus).toBeHidden()
  await entry(page, 1).hover()
  await expect(plus).toBeVisible()
  await plus.click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(said).toHaveText("Added slide 2")
  await page.getByRole("button", { name: "New slide", exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(said).toHaveText("Added slide 3")
  await expect(entry(page, 3)).toBeFocused()
  await page.keyboard.press("Alt+ArrowLeft")
  await expect(said).toHaveText("Moved slide 3 to position 2")
  await expect(entry(page, 2)).toBeFocused()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await page.keyboard.press("Alt+ArrowRight")
  await expect(said).toHaveText("Moved slide 2 to position 3")
  await expect(entry(page, 3)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(4)
  await expect(said).toHaveText("Duplicated slide 3. The copy is slide 4")
  await expect(entry(page, 4)).toBeFocused()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(said).toHaveText("Slide 4 deleted")
  await page.keyboard.press("Home")
  await page.keyboard.press("Delete")
  await page.keyboard.press("Delete")
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(entry(page, 1)).toHaveAccessibleName("Slide 1 of 1")
})

test("a right click or the menu key on a slide offers the slide commands, and each one does what the keyboard does", async ({
  page,
}) => {
  await openFile(page, sectioned)
  await openGrid(page)
  const said = page.locator("[data-editor-grid] [data-announcer]")
  const menu = page.getByRole("menu")
  await entry(page, 1).click({ button: "right" })
  await expect(menu).toBeVisible()
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect(menu.getByRole("menuitem")).toHaveText([/^Open/, /^Duplicate/, /^Delete/, /^Move up/, /^Move down/])
  await expect(menu.getByRole("menuitem", { name: /^Move up/ })).toHaveAttribute("aria-disabled", "true")
  await menu.getByRole("menuitem", { name: /^Duplicate/ }).click()
  await expect(menu).toBeHidden()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(said).toHaveText("Duplicated slide 1. The copy is slide 2")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("Shift+F10")
  await expect(menu).toBeVisible()
  await expect(menu.getByRole("menuitem", { name: /^Move down/ })).not.toHaveAttribute("aria-disabled", "true")
  await menu.getByRole("menuitem", { name: /^Move down/ }).click()
  await expect(said).toHaveText("Moved slide 2 to position 3")
  await expect(entry(page, 3)).toBeFocused()
  await entry(page, 3).click({ button: "right" })
  await menu.getByRole("menuitem", { name: /^Delete/ }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(said).toHaveText("Slide 3 deleted")
  await entry(page, 2).click({ button: "right" })
  await expect(menu).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("ContextMenu")
  await menu.getByRole("menuitem", { name: /^Open/ }).click()
  await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
})

async function dragOnto(page: Page, from: number, to: number, side: "left" | "right", place: number): Promise<void> {
  const source = await entry(page, from).boundingBox()
  const target = await entry(page, to).boundingBox()
  if (source === null || target === null) throw new Error("no slide to drag")
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  const x = side === "left" ? target.x + target.width * 0.2 : target.x + target.width * 0.8
  await page.mouse.move(x, target.y + target.height / 2, { steps: 8 })
  const bar = page.locator("[data-drop-bar]")
  await expect(bar).toBeVisible()
  await expect(bar).toHaveAttribute("data-drop-place", String(place))
  const mark = await bar.boundingBox()
  const gap = side === "left" ? target.x - (mark?.x ?? 0) : (mark?.x ?? 0) - (target.x + target.width)
  expect(gap).toBeGreaterThan(0)
  expect(gap).toBeLessThan(32)
  await expect(entry(page, from)).toHaveCSS("opacity", "0.4")
  await expect(page.locator(`[aria-label="Add slide after slide ${String(from)}"]`)).toBeHidden()
  await page.mouse.up()
  await expect(bar).toBeHidden()
}

test("a slide dragged onto half of another lands on that side of it, where the drop bar showed", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  const said = page.locator("[data-editor-grid] [data-announcer]")
  for (const count of [2, 3, 4]) {
    await page.getByRole("button", { name: "New slide", exact: true }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(count)
  }
  await dragOnto(page, 1, 3, "right", 4)
  await expect(said).toHaveText("Moved slide 1 to position 3")
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await dragOnto(page, 3, 1, "left", 1)
  await expect(said).toHaveText("Moved slide 3 to position 1")
  await dragOnto(page, 2, 3, "left", 3)
  await expect(said).toHaveText("Moved slide 3 to position 1")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(4)
})

test("a slide dropped at the start of a section shows and lands at the end of the section before it", async ({
  page,
}) => {
  await openFile(page, join(fixtures, "sections-after.pptx"))
  await openGrid(page)
  const opening = page.locator("section", { has: page.getByRole("heading", { name: "Opening" }) })
  await expect(opening.getByText("1 slide", { exact: true })).toBeVisible()
  const source = await entry(page, 3).boundingBox()
  const target = await entry(page, 2).boundingBox()
  const previous = await entry(page, 1).boundingBox()
  if (source === null || target === null || previous === null) throw new Error("no slide to drag")
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width * 0.2, target.y + target.height / 2, { steps: 8 })
  const bar = page.locator("[data-drop-bar]")
  await expect(bar).toHaveAttribute("data-drop-place", "2")
  const mark = await bar.boundingBox()
  expect(Math.abs((mark?.y ?? 0) - previous.y)).toBeLessThan(2)
  expect((mark?.x ?? 0) - (previous.x + previous.width)).toBeGreaterThan(0)
  expect((mark?.x ?? 0) - (previous.x + previous.width)).toBeLessThan(32)
  await page.mouse.up()
  await expect(page.locator("[data-editor-grid] [data-announcer]")).toHaveText("Moved slide 3 to position 2")
  await expect(opening.getByText("2 slides", { exact: true })).toBeVisible()
})

test("a 50-slide deck paints grid thumbnails as they come into view", async ({ page }) => {
  test.setTimeout(120_000)
  await openFile(page, {
    name: "fifty.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(fifty),
  })
  await openGrid(page)
  await expect(page.locator("[data-editor-grid] [data-slide-entry]")).toHaveCount(fifty)
  await expect(page.locator("[data-editor-grid] [data-slide-thumb]")).toHaveCount(fifty)
  await expect.poll(async () => page.locator("[data-editor-grid] [data-thumb-paint]").count()).toBeGreaterThan(0)
  const painted = await page.locator("[data-editor-grid] [data-thumb-paint]").count()
  expect(painted, `painted ${painted} thumbs`).toBeLessThan(fifty)
  const list = await page.locator("[data-editor-grid] [data-slide-list]").innerText()
  expect(list).toContain(mark(1, fifty))
  expect(list).not.toContain(mark(fifty, fifty))
})

async function perRow(page: Page): Promise<number> {
  return page.locator("[data-editor-grid] [data-slide-entry]").evaluateAll((entries) => {
    const tops = entries.map((entry) => Math.round(entry.getBoundingClientRect().top))
    return tops.filter((top) => top === tops[0]).length
  })
}

test("the grid fills the window, zooms with the keyboard and the slider, and keeps the zoom for the deck", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openFile(page, {
    name: "fifty.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(fifty),
  })
  await openGrid(page)
  const zoom = page.getByRole("slider", { name: "Zoom" })
  expect(await perRow(page)).toBe(4)
  const list = page.locator("[data-editor-grid] [data-slide-list]")
  const room = await list.evaluate((element) => {
    const first = element.querySelector('[data-slide-entry="1"]')?.getBoundingClientRect()
    const fourth = element.querySelector('[data-slide-entry="4"]')?.getBoundingClientRect()
    const box = element.getBoundingClientRect()
    return {
      left: Math.round((first?.left ?? 0) - box.left),
      right: Math.round(box.left + element.clientWidth - (fourth?.right ?? 0)),
      overflow: element.scrollWidth - element.clientWidth,
    }
  })
  expect(room.left).toBe(48)
  expect(room.right).toBeGreaterThanOrEqual(48)
  expect(room.right).toBeLessThanOrEqual(48 + 4)
  expect(room.overflow).toBe(0)
  await page.setViewportSize({ width: 1920, height: 923 })
  await expect.poll(() => perRow(page)).toBe(5)
  await page.setViewportSize({ width: 1470, height: 923 })
  await expect.poll(() => perRow(page)).toBe(4)
  await entry(page, 1).focus()
  await page.keyboard.press("ControlOrMeta+Equal")
  await expect.poll(() => perRow(page)).toBe(3)
  await expect(zoom).toHaveAttribute("aria-valuetext", "3 slides per row")
  await page.keyboard.press("ControlOrMeta+Minus")
  await page.keyboard.press("ControlOrMeta+Minus")
  await expect.poll(() => perRow(page)).toBe(5)
  await zoom.focus()
  await page.keyboard.press("ArrowLeft")
  await expect.poll(() => perRow(page)).toBe(7)
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect.poll(() => perRow(page)).toBe(7)
  await entry(page, 1).focus()
  await page.keyboard.press("ControlOrMeta+0")
  await expect.poll(() => perRow(page)).toBe(4)
})

test("a 100-slide deck is refused before it opens", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "hundred.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(hundred),
  })
  await expect(page.getByText("This deck has more than 50 slides")).toBeVisible()
  await expect(page).toHaveURL("/")
})
