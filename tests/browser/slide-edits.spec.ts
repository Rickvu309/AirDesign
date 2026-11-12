import { copyFile, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { openRegister } from "../../packages/document/src/index.ts"
import { slideEditsExportName } from "../../scripts/slide-edits.mjs"

const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"
const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const sourcePart = "ppt/slides/slide1.xml"
const copyPart = "ppt/slides/slide2.xml"
const addedPart = "ppt/slides/slide3.xml"
const titleBox = { x: 914400, y: 1828800, cx: 10363200, cy: 1371600 }
const emuPerPixel = 15_240
const copyBox = {
  x: titleBox.x + 12_700,
  y: titleBox.y,
  cx: titleBox.cx - 120 * emuPerPixel,
  cy: titleBox.cy + 60 * emuPerPixel,
}

type Row = { kind: string; value?: unknown; node?: string; property?: string }

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

async function partText(file: string, name: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entries = await reader.getEntries()
  const entry = entries.find((item) => item.filename === name)
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error(name)
  return new TextDecoder().decode(bytes)
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

function title(page: Page, part: string) {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#2"] [contenteditable="true"]`)
}

async function blank(page: Page): Promise<void> {
  await page.goto("/")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("button", { name: "Blank deck", exact: true }).click()
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
}

async function replace(page: Page, box: ReturnType<typeof title>, text: string): Promise<void> {
  await box.click()
  await page.keyboard.press("ControlOrMeta+a")
  await box.pressSequentially(text, { delay: 20 })
  await expect(box).toHaveText(text)
}

async function placed(page: Page, part: string): Promise<number[]> {
  return page
    .locator(`[data-slide-paint] [data-canvas-element="${part}#2"]`)
    .evaluate((frame: HTMLElement) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
}

async function drag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

async function rowsOf(page: Page): Promise<Row[]> {
  return page.evaluate(
    () =>
      new Promise<Row[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(
              (all.result as unknown[]).filter(
                (row) => typeof row === "object" && row !== null && "kind" in row,
              ) as Row[],
            )
          }
        }
      }),
  )
}

test("a duplicate keeps the title it had when it was made, and a new slide takes typed text, through a reload and the export @export", async ({
  page,
}, testInfo) => {
  await blank(page)
  const source = title(page, sourcePart)
  await expect(source).toHaveText("")
  await source.click()
  await source.pressSequentially("Snapshot title", { delay: 20 })
  await expect(source).toHaveText("Snapshot title")
  await entry(page, 1).focus()
  await page.keyboard.press(duplicate)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  const copy = title(page, copyPart)
  await expect(copy).toHaveText("Snapshot title")
  await copy.click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await expect(page.locator("[data-slide-paint] [data-grip]:not([data-grip=move])")).toHaveCount(4)
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-slide-paint]").getByRole("group", { name: "Snapshot title" })).toBeFocused()
  await page.keyboard.press("ArrowRight")
  const frame = page.locator(`[data-slide-paint] [data-canvas-element="${copyPart}#2"]`)
  const corner = await frame.boundingBox()
  if (corner === null) throw new Error("copy")
  await drag(page, { x: corner.x + corner.width, y: corner.y + corner.height }, { x: -120, y: 60 })
  const shown = await placed(page, copyPart)
  expect(shown[2]).toBeCloseTo(copyBox.cx / emuPerPixel, 3)
  expect(shown[3]).toBeCloseTo(copyBox.cy / emuPerPixel, 3)
  await entry(page, 1).click()
  await replace(page, source, "Source after")
  const sourceBox = await placed(page, sourcePart)
  expect(sourceBox[0]).toBeCloseTo(titleBox.x / emuPerPixel, 3)
  await entry(page, 2).click()
  await expect(copy).toHaveText("Snapshot title")
  await replace(page, copy, "Copy title")
  expect((await placed(page, copyPart))[0]).toBeCloseTo(copyBox.x / emuPerPixel, 3)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  const added = title(page, addedPart)
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(2)
  await expect(added).toHaveText("")
  await added.click()
  await added.pressSequentially("Typed on a new slide", { delay: 20 })
  await expect(added).toHaveText("Typed on a new slide")
  await expect(page.locator("[data-slide-paint] [data-grip]:not([data-grip=move])")).toHaveCount(4)
  await page.keyboard.press("Escape")
  await page.keyboard.press("ArrowDown")
  await page.reload()
  await settled(page)
  await entry(page, 1).click()
  await expect(source).toHaveText("Source after")
  expect((await placed(page, sourcePart))[0]).toBeCloseTo(titleBox.x / emuPerPixel, 3)
  await entry(page, 2).click()
  await expect(copy).toHaveText("Copy title")
  const kept = await placed(page, copyPart)
  ;[copyBox.x, copyBox.y, copyBox.cx, copyBox.cy].forEach((emu, index) =>
    expect(kept[index]).toBeCloseTo(emu / emuPerPixel, 3),
  )
  await entry(page, 3).click()
  await expect(added).toHaveText("Typed on a new slide")
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const file = testInfo.outputPath(slideEditsExportName)
  await (await saving).saveAs(file)
  const sourceXml = await partText(file, sourcePart)
  const copyXml = await partText(file, copyPart)
  const addedXml = await partText(file, addedPart)
  expect(sourceXml).toContain("<a:t>Source after</a:t>")
  expect(sourceXml).toContain(
    `<a:off x="${titleBox.x}" y="${titleBox.y}"/><a:ext cx="${titleBox.cx}" cy="${titleBox.cy}"/>`,
  )
  expect(sourceXml).not.toContain("Copy title")
  expect(copyXml).toContain("<a:t>Copy title</a:t>")
  expect(copyXml).toContain(`<a:off x="${copyBox.x}" y="${copyBox.y}"/><a:ext cx="${copyBox.cx}" cy="${copyBox.cy}"/>`)
  expect(copyXml).not.toContain("Source after")
  expect(copyXml).not.toContain("Snapshot title")
  expect(addedXml).toContain("<a:t>Typed on a new slide</a:t>")
  await copyFile(file, join(process.cwd(), "tests/browser", slideEditsExportName))
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await settled(page)
  await expect(title(page, sourcePart)).toHaveText("Source after")
  await entry(page, 2).click()
  await expect(title(page, copyPart)).toHaveText("Copy title")
  await entry(page, 3).click()
  await expect(title(page, addedPart)).toHaveText("Typed on a new slide")
})

test("typing and a nudge on a new slide paint before the network and stay when it returns", async ({
  page,
  context,
}) => {
  await page.route("**/decks/{open,index}", async (route) => {
    const body = route.request().postDataJSON() as { deck: string }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, deck: body.deck, revision: 0, register: openRegister("", "") }),
    })
  })
  await blank(page)
  await page.route("**/decks/commit", (route) => route.abort("internetdisconnected"))
  await context.setOffline(true)
  await page.getByRole("button", { name: "Add slide" }).click()
  const added = title(page, copyPart)
  await added.click()
  await added.pressSequentially("Offline line", { delay: 20 })
  await expect(added).toHaveText("Offline line")
  await page.keyboard.press("Escape")
  await page.keyboard.press("ArrowRight")
  await expect(page.getByText("You're offline. Edits are saved on this device.")).toBeVisible()
  await expect.poll(async () => (await rowsOf(page)).filter((row) => row.kind === "pending").length).toBeGreaterThan(0)
  const sent: unknown[] = []
  await page.unroute("**/decks/commit")
  let revision = 0
  await page.route("**/decks/commit", async (route) => {
    const body = route.request().postDataJSON() as { deck: string; batch: unknown[] }
    sent.push(...body.batch)
    revision += 1
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, deck: body.deck, revision, key: `${body.deck}:${revision}` }),
    })
  })
  await context.setOffline(false)
  await expect.poll(async () => (await rowsOf(page)).some((row) => row.kind === "pending")).toBe(false)
  expect(sent).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ slide: "add" }),
      expect.objectContaining({ node: "257.2", value: expect.stringContaining("Offline line") }),
    ]),
  )
  await expect(added).toHaveText("Offline line")
})

test("text inside a group on a duplicated slide shows no handles and does not move", async ({ page }) => {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(fixtures, "census-updating-spm.pptx"))
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await entry(page, 5).click()
  await entry(page, 5).focus()
  await page.keyboard.press(duplicate)
  await expect(entry(page, 6)).toHaveAttribute("aria-current", "true")
  const text = page.locator('[data-slide-paint] [contenteditable="true"]').filter({ hasText: /^2026$/ })
  await expect(text).toHaveCount(1)
  await text.click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await expect(page.locator("[data-slide-paint] [data-grip]")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowDown")
  expect((await rowsOf(page)).filter((row) => row.property === "box")).toEqual([])
})
