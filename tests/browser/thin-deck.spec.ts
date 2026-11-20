import { copyFile, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { openRegister } from "../../packages/document/src/index.ts"
import { stored } from "./device-store"
import { partsOf, zip } from "./thin-deck-parts.ts"
import { expectNoSample } from "./no-sample"
import { exportFromDialog, savedExport } from "./export-dialog.ts"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const fixture = join(fixtures, "clean.pptx")
const exported = join(process.cwd(), "tests/browser/exported-deck.pptx")
const slide = "ppt/slides/slide1.xml"

async function changedParts(before: string, after: string): Promise<string[]> {
  const original = await partsOf(before)
  const saved = await partsOf(after)
  expect([...saved.keys()]).toEqual([...original.keys()])
  return [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name)
}

function lines(value: string): string {
  const paragraphs = JSON.parse(value) as { runs: { text: string }[] }[]
  return paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

async function paragraphsOf(page: Page, box: ReturnType<Page["locator"]>): Promise<string[]> {
  return box.locator("[data-paragraph]").allTextContents()
}

const deckAddress = /\/deck\/[A-Za-z0-9_-]{1,64}$/

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function reload(page: Page): Promise<void> {
  await page.reload()
  await settled(page)
}

async function showSlide(page: Page, number: number): Promise<void> {
  const entry = page.locator(`[data-slide-entry="${number}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}

async function open(page: Page, file: string): Promise<string> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await expect(page).toHaveURL(deckAddress)
  await settled(page)
  return page.url()
}

test.describe.configure({ mode: "parallel" })

test.use({ viewport: { width: 1470, height: 923 } })

test("edit to Hello! survives reload, exports @export", async ({ page }, testInfo) => {
  await rm(exported, { force: true })
  const download = testInfo.outputPath("exported-deck.pptx")
  const address = await open(page, fixture)
  await expect(page.locator("input[type=file]")).toHaveCount(0)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Hello!", { delay: 50 })
  await expect(editor).toHaveText("Hello!")
  await stored(page, "Hello!")
  await reload(page)
  expect(page.url()).toBe(address)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello!")
  expect(await savedExport(page, download)).toBe("clean.pptx")
  expect(await changedParts(fixture, download)).toEqual([slide])
  const saved = (await partsOf(download)).get(slide)?.toString("utf8") ?? ""
  expect(saved.match(/<a:t>[^<]*<\/a:t>/g)).toEqual(["<a:t>Hello!</a:t>"])
  await copyFile(download, exported)
})

type ReadyEntry = { value: string | null; boxes: number }

async function readyLog(page: Page): Promise<ReadyEntry[]> {
  return page.evaluate(() => (window as unknown as { readyLog: ReadyEntry[] }).readyLog)
}

test("the page marks a deck ready only once it is painted", async ({ page }) => {
  await page.addInitScript(() => {
    const log: { value: string | null; boxes: number }[] = []
    Object.assign(window, { readyLog: log })
    new MutationObserver(() => {
      log.push({
        value: document.querySelector(".thin-page")?.getAttribute("data-deck-ready") ?? null,
        boxes: document.querySelectorAll('[contenteditable="true"]').length,
      })
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-deck-ready"],
    })
  })
  const address = await open(page, fixture)
  const deck = address.slice(address.lastIndexOf("/") + 1)
  const painted = await readyLog(page)
  expect(painted.map((entry) => entry.value)).toEqual([deck])
  expect(painted.map((entry) => entry.boxes > 0)).toEqual([true])
  await reload(page)
  const reloaded = await readyLog(page)
  expect(reloaded.map((entry) => entry.value)).toEqual([deck])
  expect(reloaded.map((entry) => entry.boxes > 0)).toEqual([true])
})

test("the old /thin address is gone and shows no editor", async ({ page }) => {
  await page.goto("/thin")
  await expect(page.locator("input[type=file]")).toHaveCount(0)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
})

test("a second browser context gets a different deck id", async ({ page, browser }) => {
  const address = await open(page, fixture)
  const other = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  })
  try {
    expect(await open(await other.newPage(), fixture)).not.toBe(address)
  } finally {
    await other.close()
  }
})

async function everyPartLacks(file: string, marker: string): Promise<void> {
  const parts = await partsOf(file)
  expect(parts.size).toBeGreaterThan(0)
  for (const [name, bytes] of parts) {
    expect(bytes.includes(marker), name).toBe(false)
  }
}

test("a second deck does not carry the first deck's edit", async ({ page }, testInfo) => {
  const marker = "MARKER4471"
  const saved = testInfo.outputPath("second-deck.pptx")
  const first = await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.press("End")
  await editor.pressSequentially(marker, { delay: 50 })
  await expect(editor).toHaveText(`Hello${marker}`)
  await stored(page, `Hello${marker}`)
  const second = await open(page, join(fixtures, "doe-heat-pumps.pptx"))
  expect(second).not.toBe(first)
  await expect(page.getByText("Introduction to Heat Pumps").first()).toBeVisible()
  await reload(page)
  expect(page.url()).toBe(second)
  await expect(page.getByText("Introduction to Heat Pumps").first()).toBeVisible()
  await expect(page.getByText(marker)).toHaveCount(0)
  await savedExport(page, saved)
  await everyPartLacks(saved, marker)
})

test("typing key by key keeps the order of the letters", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.press("End")
  await editor.pressSequentially(" world", { delay: 50 })
  await expect(editor).toHaveText("Hello world")
  await stored(page, "Hello world")
  await reload(page)
  await expect(editor).toHaveText("Hello world")
  await editor.dblclick()
  await page.keyboard.press("Home")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")
  await editor.pressSequentially("XY", { delay: 50 })
  await expect(editor).toHaveText("HeXYllo world")
  await stored(page, "HeXYllo world")
})

test("typed spaces are stored as plain spaces", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.press("End")
  await editor.pressSequentially(" a  b ", { delay: 50 })
  await expect.poll(() => editor.textContent()).toBe("Hello a  b ")
  await stored(page, "Hello a  b ")
  await reload(page)
  await expect.poll(() => editor.textContent()).toBe("Hello a  b ")
})

async function paste(page: Page, data: Record<string, string>): Promise<void> {
  await page.evaluate((entries) => {
    const clipboardData = new DataTransfer()
    for (const [type, value] of Object.entries(entries)) clipboardData.setData(type, value)
    document.querySelector('[contenteditable="true"]')?.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    )
  }, data)
}

test("Enter and a pasted line break each start a new paragraph", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.dblclick()
  await page.keyboard.press("End")
  await page.keyboard.press("Enter")
  await page.keyboard.press("Shift+Enter")
  await editor.pressSequentially("x", { delay: 50 })
  await expect.poll(() => paragraphsOf(page, editor)).toEqual(["Hello", "", "x"])
  await stored(page, "Hello\n\nx")
  await paste(page, { "text/plain": "one\r\ntwo" })
  await expect.poll(() => paragraphsOf(page, editor)).toEqual(["Hello", "", "xone", "two"])
  await stored(page, "Hello\n\nxone\ntwo")
  await paste(page, { "text/html": "<p>one</p><p>two</p>" })
  await paste(page, { "text/plain": "a\u2028b\u2029c\u0085d\u000be\u000cf" })
  const pasted = ["Hello", "", "xone", "twoa", "b", "c", "d", "e", "f"]
  await expect.poll(() => paragraphsOf(page, editor)).toEqual(pasted)
  await stored(page, pasted.join("\n"))
  await page.keyboard.press("ControlOrMeta+a")
  await paste(page, {})
  await expect.poll(() => paragraphsOf(page, editor)).toEqual(pasted)
  await reload(page)
  await expect.poll(() => paragraphsOf(page, editor)).toEqual(pasted)
})

test("a cleared box is stored empty", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await expect.poll(() => editor.textContent()).toBe("")
  await stored(page, "")
  await reload(page)
  await expect(editor).toHaveText("")
})

test("an export with no edit keeps every part and the whole file byte for byte", async ({ page }, testInfo) => {
  const saved = testInfo.outputPath("no-edit.pptx")
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await savedExport(page, saved)
  expect(await changedParts(fixture, saved)).toEqual([])
  expect((await readFile(saved)).equals(await readFile(fixture))).toBe(true)
})

test("a box that cannot keep an edit is not editable", async ({ page }) => {
  await open(page, join(fixtures, "nasa-1d-cnn.pptx"))
  await expect(page.getByText(/1D-Convolutional/).first()).toBeVisible()
  await expect(page.locator('[contenteditable="true"]').filter({ hasText: /1D-Convolutional/ })).toHaveCount(1)
  await showSlide(page, 10)
  const slideNumber = page.locator('[contenteditable="false"]').filter({ hasText: /^10$/ })
  await expect(slideNumber).toHaveCount(1)
  let editable = 0
  const slideCount = await page.locator("[data-slide-entry]").count()
  for (let number = 1; number <= slideCount; number += 1) {
    await showSlide(page, number)
    editable += await page.locator('[contenteditable="true"]').count()
  }
  expect(editable).toBe(35)
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveCount(1)
  await expect(editor).toHaveText("Hello")
  await editor.dblclick()
  await page.keyboard.press("End")
  await editor.pressSequentially("!?", { delay: 50 })
  await expect(editor).toHaveText("Hello!?")
  await stored(page, "Hello!?")
})

async function rowsOf(page: Page): Promise<{ kind: string; value: string; node?: string }[]> {
  return page.evaluate(
    () =>
      new Promise<{ kind: string; value: string; node?: string }[]>((resolve, reject) => {
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
              ) as never,
            )
          }
        }
      }),
  )
}

async function answerOpens(page: Page) {
  await page.route("**/decks/{open,index}", async (route) => {
    const body = route.request().postDataJSON() as { deck: string }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, deck: body.deck, revision: 0, register: openRegister("", "") }),
    })
  })
}

async function answerCommits(page: Page): Promise<void> {
  await page.unroute("**/decks/commit")
  let revision = 0
  await page.route("**/decks/commit", async (route) => {
    const body = route.request().postDataJSON() as { deck: string }
    revision += 1
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        deck: body.deck,
        revision,
        key: `${body.deck}:${revision}`,
      }),
    })
  })
}

async function confirmed(page: Page, value: string): Promise<void> {
  await expect
    .poll(async () => (await rowsOf(page)).map((row) => `${row.kind}:${lines(row.value)}`))
    .toEqual([`confirmed:${value}`])
}

test("two text boxes keep their own edits after reload and both export", async ({ page }, testInfo) => {
  const deck = join(fixtures, "doe-heat-pumps.pptx")
  const download = testInfo.outputPath("two-boxes.pptx")
  const address = await open(page, deck)
  await showSlide(page, 4)
  const title = page.locator('[contenteditable="true"]').filter({ hasText: /^What is a heat pump\?$/ })
  const body = page.locator('[contenteditable="true"]').filter({ hasText: /^Same technology as:$/ })
  await title.dblclick()
  await page.keyboard.press("End")
  await title.pressSequentially(" Alpha", { delay: 50 })
  await stored(page, "What is a heat pump? Alpha")
  await body.click()
  await page.keyboard.press("Control+End")
  await body.pressSequentially(" Beta", { delay: 50 })
  await stored(page, "Same technology as: Beta")
  await reload(page)
  expect(page.url()).toBe(address)
  await showSlide(page, 4)
  const editors = page.locator('[contenteditable="true"]')
  await expect(editors.filter({ hasText: /^What is a heat pump\? Alpha$/ })).toHaveCount(1)
  await expect(editors.filter({ hasText: /^Same technology as: Beta$/ })).toHaveCount(1)
  const nodes = new Set((await rowsOf(page)).map((row) => row.node))
  expect([...nodes].sort()).toEqual(["2727.2", "2727.44"])
  await savedExport(page, download)
  expect(await changedParts(deck, download)).toEqual(["ppt/slides/slide4.xml"])
  const saved = (await partsOf(download)).get("ppt/slides/slide4.xml")?.toString("utf8") ?? ""
  expect(saved).toContain("<a:t>What is a heat pump? Alpha</a:t>")
  expect(saved).toContain("<a:t>Same technology as: Beta</a:t>")
})

test("an edit left pending by a failed commit is sent after a reload", async ({ page }) => {
  await answerOpens(page)
  await page.route("**/decks/commit", (route) => route.fulfill({ status: 503, body: "" }))
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await editor.dblclick()
  await page.keyboard.press("End")
  await editor.pressSequentially("!", { delay: 50 })
  await stored(page, "Hello!")
  expect((await rowsOf(page)).map((row) => `${row.kind}:${lines(row.value)}`)).toEqual(["pending:Hello!"])
  await reload(page)
  await answerCommits(page)
  await confirmed(page, "Hello!")
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello!")
})

test("an edit made offline is sent when the page comes back online", async ({ page, context }) => {
  await answerOpens(page)
  await open(page, fixture)
  await page.route("**/decks/commit", (route) => route.abort("internetdisconnected"))
  await context.setOffline(true)
  const editor = page.locator('[contenteditable="true"]')
  await editor.dblclick()
  await page.keyboard.press("End")
  await editor.pressSequentially("?", { delay: 50 })
  await stored(page, "Hello?")
  expect((await rowsOf(page)).map((row) => `${row.kind}:${lines(row.value)}`)).toEqual(["pending:Hello?"])
  await answerCommits(page)
  await context.setOffline(false)
  await confirmed(page, "Hello?")
})

function shapeIn(slideXml: string, id: string): string {
  const named = slideXml.indexOf(`<p:cNvPr id="${id}"`)
  const start = slideXml.lastIndexOf("<p:sp>", named)
  const end = slideXml.indexOf("</p:sp>", named) + "</p:sp>".length
  return slideXml.slice(start, end)
}

function runsIn(shape: string): [string, string][] {
  return [...shape.matchAll(/<a:r>(<a:rPr(?:[^>]*\/>|[\s\S]*?<\/a:rPr>))?<a:t>([^<]*)<\/a:t><\/a:r>/g)].map((run) => [
    run[1] ?? "",
    run[2] ?? "",
  ])
}

test("Enter inside a run of a box with eight runs makes a paragraph that keeps every run's format", async ({
  page,
}, testInfo) => {
  const deck = join(fixtures, "doe-heat-pumps.pptx")
  const download = testInfo.outputPath("paragraphs.pptx")
  const part = "ppt/slides/slide7.xml"
  await open(page, deck)
  await showSlide(page, 7)
  const box = page.locator('[contenteditable="true"]').filter({ hasText: /^Vapor Compression CyclePumped refrigerant/ })
  await expect(box).toHaveCount(1)
  const second = box.locator("[data-run]").nth(3)
  await expect(second).toHaveText("delivers")
  await second.click()
  await second.evaluate((run) => {
    const text = run.firstChild
    if (text === null) return
    window.getSelection()?.setBaseAndExtent(text, 3, text, 3)
  })
  await page.keyboard.type("X", { delay: 50 })
  await page.keyboard.press("Enter")
  await page.keyboard.type("Next line", { delay: 50 })
  const shown = [
    "Vapor Compression Cycle",
    "Pumped refrigerant",
    "Pressurized (liquid) delX",
    "Next lineivers heat ",
    "Depressurized (gas) collects heat ",
  ]
  await stored(page, shown.join("\n"))
  await reload(page)
  await showSlide(page, 7)
  await expect.poll(() => paragraphsOf(page, box)).toEqual(shown)
  await savedExport(page, download)
  expect(await changedParts(deck, download)).toEqual([part])
  const before = (await partsOf(deck)).get(part)?.toString("utf8") ?? ""
  const after = (await partsOf(download)).get(part)?.toString("utf8") ?? ""
  const original = shapeIn(before, "45")
  const written = shapeIn(after, "45")
  expect(after.replace(written, "")).toBe(before.replace(original, ""))
  const runs = runsIn(original)
  expect(runs.map(([, text]) => text)).toEqual([
    "Vapor Compression Cycle",
    "Pumped refrigerant",
    "Pressurized (liquid) ",
    "delivers",
    " heat ",
    "Depressurized (gas) ",
    "collects",
    " heat ",
  ])
  const format = (index: number) => runs[index]?.[0] ?? ""
  expect(runsIn(written)).toEqual([
    [format(0), "Vapor Compression Cycle"],
    [format(1), "Pumped refrigerant"],
    [format(2), "Pressurized (liquid) "],
    [format(3), "delX"],
    [format(3), "Next lineivers"],
    [format(4), " heat "],
    [format(5), "Depressurized (gas) "],
    [format(6), "collects"],
    [format(7), " heat "],
  ])
  expect(written.match(/<a:p>|<a:p /g)?.length).toBe(5)
})

test("replaced run and paragraph export for PPTX check @export", async ({ page }, testInfo) => {
  const judged = join(process.cwd(), "tests/browser/exported-paragraphs.pptx")
  await rm(judged, { force: true })
  const deck = join(fixtures, "doe-heat-pumps.pptx")
  const download = testInfo.outputPath("exported-paragraphs.pptx")
  const part = "ppt/slides/slide7.xml"
  await open(page, deck)
  await showSlide(page, 7)
  const box = page.locator('[contenteditable="true"]').filter({ hasText: /^Vapor Compression CyclePumped refrigerant/ })
  await expect(box).toHaveCount(1)
  const bold = box.locator("[data-run]").nth(3)
  await expect(bold).toHaveText("delivers")
  await bold.click()
  await bold.evaluate((run) => {
    const text = run.firstChild
    if (text === null) return
    window.getSelection()?.setBaseAndExtent(text, 0, text, text.textContent?.length ?? 0)
  })
  await page.keyboard.type("supplies", { delay: 50 })
  const last = box.locator("[data-run]").nth(7)
  await expect(last).toHaveText(" heat ")
  await last.click()
  await last.evaluate((run) => {
    const text = run.firstChild
    if (text === null) return
    const end = text.textContent?.length ?? 0
    window.getSelection()?.setBaseAndExtent(text, end, text, end)
  })
  await page.keyboard.press("Enter")
  await page.keyboard.type("Extra line", { delay: 50 })
  const shown = [
    "Vapor Compression Cycle",
    "Pumped refrigerant",
    "Pressurized (liquid) supplies heat ",
    "Depressurized (gas) collects heat ",
    "Extra line",
  ]
  await stored(page, shown.join("\n"))
  await savedExport(page, download)
  expect(await changedParts(deck, download)).toEqual([part])
  const written = shapeIn((await partsOf(download)).get(part)?.toString("utf8") ?? "", "45")
  expect(runsIn(written).map(([, text]) => text)).toEqual([
    "Vapor Compression Cycle",
    "Pumped refrigerant",
    "Pressurized (liquid) ",
    "supplies",
    " heat ",
    "Depressurized (gas) ",
    "collects",
    " heat ",
    "Extra line",
  ])
  expect(written.match(/<a:p>|<a:p /g)?.length).toBe(5)
  await copyFile(download, judged)
})

test("undo after Enter takes the new paragraph back", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.dblclick()
  await page.keyboard.press("End")
  await page.keyboard.press("Enter")
  await expect.poll(() => paragraphsOf(page, editor)).toEqual(["Hello", ""])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => paragraphsOf(page, editor)).toEqual(["Hello"])
})

test("an empty box takes typed text, keeps it after reload and exports it", async ({ page }, testInfo) => {
  const deck = join(fixtures, "doe-heat-pumps.pptx")
  const download = testInfo.outputPath("empty-box.pptx")
  const part = "ppt/slides/slide1.xml"
  await open(page, deck)
  const empty = page.locator("[contenteditable]").nth(2)
  await expect(empty).toHaveAttribute("contenteditable", "true")
  await expect(empty).toHaveText("")
  await page.locator("[contenteditable]").nth(1).focus()
  await page.keyboard.press("Tab")
  await expect(empty).toBeFocused()
  await empty.pressSequentially("Typed here", { delay: 50 })
  await stored(page, "Typed here")
  await reload(page)
  await expect(page.locator("[contenteditable]").nth(2)).toHaveText("Typed here")
  await savedExport(page, download)
  expect(await changedParts(deck, download)).toEqual([part])
  const before = (await partsOf(deck)).get(part)?.toString("utf8") ?? ""
  const after = (await partsOf(download)).get(part)?.toString("utf8") ?? ""
  const written = shapeIn(after, "4")
  expect(after.replace(written, "")).toBe(before.replace(shapeIn(before, "4"), ""))
  expect(written).toContain("<a:t>Typed here</a:t>")
})

test("the page names the opened file, not the sample deck", async ({ page }) => {
  const sample = ["Q3 Investor Update", "Opening", "Performance", "Outlook"]
  await open(page, join(fixtures, "nasa-1d-cnn.pptx"))
  const sidebar = page.locator("aside").first()
  for (const reading of [0, 1]) {
    if (reading === 1) await reload(page)
    await expect(sidebar).toContainText("nasa-1d-cnn")
    const body = (await page.locator("body").textContent()) ?? ""
    for (const word of sample) expect(body).not.toContain(word)
  }
})

test("a real deck paints no sample and still exports", async ({ page }, testInfo) => {
  const saved = testInfo.outputPath("deck-no-sample.pptx")
  await open(page, fixture)
  await expectNoSample(page)
  await expect(page.locator("aside").first()).toContainText("clean")
  await expect(page.locator("[data-slide-entry]").first()).toBeVisible()
  await expect(page.locator("[data-slide-paint]")).toContainText("Hello")
  const place = await page.getByRole("button", { name: "Export", exact: true }).boundingBox()
  expect(place?.y ?? 923).toBeLessThan(56)
  expect(1470 - (place?.x ?? 0) - (place?.width ?? 0)).toBeLessThan(40)
  await savedExport(page, saved)
  expect(await changedParts(fixture, saved)).toEqual([])
})

test("one slide shows at a time", async ({ page }, testInfo) => {
  const deck = join(fixtures, "doe-heat-pumps.pptx")
  const download = testInfo.outputPath("one-slide.pptx")
  const part = "ppt/slides/slide7.xml"
  await open(page, deck)
  const editors = page.locator('[contenteditable="true"]')
  const first = editors.filter({ hasText: "Introduction to Heat Pumps" })
  const seventh = editors.filter({ hasText: /^How do heat pumps work\?/ })
  await expect(first).toHaveCount(1)
  await expect(seventh).toHaveCount(0)
  await expect(page.locator("[data-slide-entry]").nth(6)).toHaveAttribute("data-slide-entry", "7")
  await showSlide(page, 7)
  await expect(seventh).toHaveCount(1)
  await expect(first).toHaveCount(0)
  await seventh.dblclick()
  await page.keyboard.press("End")
  await seventh.pressSequentially(" Seven", { delay: 50 })
  await stored(page, "How do heat pumps work? Seven")
  await showSlide(page, 1)
  await expect(seventh).toHaveCount(0)
  await showSlide(page, 7)
  await expect(seventh).toContainText("How do heat pumps work? Seven")
  await showSlide(page, 1)
  await savedExport(page, download)
  expect(await changedParts(deck, download)).toEqual([part])
  expect((await partsOf(download)).get(part)?.toString("utf8") ?? "").toContain("How do heat pumps work? Seven")
})

const offlineWords = "You're offline. Edits are saved on this device."
const openFailedWords = "Unable to open this deck"
const exportFailedWords = "Unable to export. Your deck is unchanged."

test("an edit made offline shows the offline words and they go when a commit answers", async ({ page, context }) => {
  let answering = false
  await page.route("**/decks/commit", async (route) => {
    if (!answering) {
      await route.abort("connectionfailed")
      return
    }
    const body = route.request().postDataJSON() as { deck: string }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, deck: body.deck, revision: 1, key: `${body.deck}:1` }),
    })
  })
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await expect(page.getByText(offlineWords)).toHaveCount(0)
  await context.setOffline(true)
  await editor.dblclick()
  await page.keyboard.press("End")
  await editor.pressSequentially("!!", { delay: 50 })
  await stored(page, "Hello!!")
  await expect(page.getByText(offlineWords)).toBeVisible()
  answering = true
  await context.setOffline(false)
  await expect(page.getByText(offlineWords)).toHaveCount(0)
  await expect(editor).toHaveText("Hello!!")
})

async function typeAtEnd(page: Page, text: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]')
  await editor.dblclick()
  await page.keyboard.press("End")
  await editor.pressSequentially(text, { delay: 50 })
}

test("a commit answered 404 with an HTML body shows no offline words", async ({ page }) => {
  let answered = 0
  await answerOpens(page)
  await page.route("**/decks/commit", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/html", body: "<html><body>Not found</body></html>" })
    answered += 1
  })
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await typeAtEnd(page, "!")
  await stored(page, "Hello!")
  await expect.poll(() => answered).toBeGreaterThan(0)
  await settled(page)
  await expect(page.getByText(offlineWords)).toHaveCount(0)
})

test("a commit answered 500 with a text body shows no offline words", async ({ page }) => {
  let answered = 0
  await answerOpens(page)
  await page.route("**/decks/commit", async (route) => {
    await route.fulfill({ status: 500, contentType: "text/plain", body: "boom" })
    answered += 1
  })
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await typeAtEnd(page, "!")
  await stored(page, "Hello!")
  await expect.poll(() => answered).toBeGreaterThan(0)
  await settled(page)
  await expect(page.getByText(offlineWords)).toHaveCount(0)
})

test("a commit answered 404 with a JSON body shows no offline words", async ({ page }) => {
  let answered = 0
  await answerOpens(page)
  await page.route("**/decks/commit", async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) })
    answered += 1
  })
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await typeAtEnd(page, "!")
  await stored(page, "Hello!")
  await expect.poll(() => answered).toBeGreaterThan(0)
  await settled(page)
  await expect(page.getByText(offlineWords)).toHaveCount(0)
})

test("a deck the device and the server do not have says it cannot open, and its button goes home", async ({ page }) => {
  await page.goto("/deck/missing-deck")
  await expect(page.getByText(openFailedWords)).toBeVisible()
  expect(new URL(page.url()).pathname).toBe("/deck/missing-deck")
  await page.getByRole("button", { name: "Go to your decks" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator("input[type=file]")).toHaveCount(1)
})

test("an export whose stored parts are gone shows the export words and downloads nothing", async ({ page }) => {
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    for await (const name of root.keys()) await root.removeEntry(name, { recursive: true })
  })
  let downloads = 0
  page.on("download", () => {
    downloads += 1
  })
  await exportFromDialog(page)
  await expect(page.getByText(exportFailedWords)).toBeVisible()
  expect(downloads).toBe(0)
})

test("a refused session keeps the edit and sends the person to sign in", async ({ page }) => {
  await answerOpens(page)
  await page.route("**/decks/commit", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, refusal: "session" }),
    }),
  )
  await page.route("**/sign-in**", (route) => route.fulfill({ contentType: "text/html", body: "<p>sign in</p>" }))
  const opened = new URL(await open(page, fixture))
  const address = new URL(`${opened.pathname}?slide=2`, opened)
  await page.goto(address.href)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.dblclick()
  await page.keyboard.press("End")
  await editor.pressSequentially("!", { delay: 50 })
  await page.waitForURL("**/sign-in**")
  const arrived = new URL(page.url())
  expect(arrived.pathname).toBe("/sign-in")
  expect(arrived.searchParams.get("next")).toBe(`${address.pathname}${address.search}`)
  await page.route("**/decks/commit", (route) => route.abort())
  await page.goto(address.pathname)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello!")
})

test("after a failed import a good file keeps each box's edit on its own box", async ({ page }, testInfo) => {
  const notes = testInfo.outputPath("notes.pptx")
  await writeFile(notes, "this is not a PowerPoint file")
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(notes)
  await expect(page.getByText("Unable to open this file", { exact: true })).toBeVisible()
  await open(page, join(fixtures, "doe-heat-pumps.pptx"))
  await showSlide(page, 4)
  const title = page.locator('[contenteditable="true"]').filter({ hasText: /^What is a heat pump\?$/ })
  await title.dblclick()
  await page.keyboard.press("End")
  await title.pressSequentially(" Alpha", { delay: 50 })
  await stored(page, "What is a heat pump? Alpha")
  await page.reload()
  await showSlide(page, 4)
  const editors = page.locator('[contenteditable="true"]')
  await expect(editors.filter({ hasText: /^What is a heat pump\? Alpha$/ })).toHaveCount(1)
  await expect(editors.filter({ hasText: /^Same technology as:$/ })).toHaveCount(1)
  await expect(editors.filter({ hasText: /^Winter: Pumps heat from the outside to the inside$/ })).toHaveCount(1)
  expect([...new Set((await rowsOf(page)).map((row) => row.node))]).toEqual(["2727.2"])
})

test("a file the device store refuses shows the failed import on the deck home", async ({ page }, testInfo) => {
  const crowded = testInfo.outputPath("crowded.pptx")
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const [name, bytes] of await partsOf(fixture))
    await writer.add(name, new zip.Uint8ArrayReader(new Uint8Array(bytes)))
  const longName = "x".repeat(240)
  for (let part = 0; part < 300; part += 1) {
    await writer.add(`ppt/media/${longName}${part}.bin`, new zip.Uint8ArrayReader(new Uint8Array([1])))
  }
  await writeFile(crowded, await writer.close())
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(crowded)
  await expect(page.getByText("Unable to save this deck", { exact: true })).toBeVisible()
  expect(new URL(page.url()).pathname).toBe("/")
})
