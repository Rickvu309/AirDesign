import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"
import { forward, settled, signInBrowser, test, type Stack } from "./api-stack"
import { savedExport } from "./export-dialog.ts"
import { newBlankDeck } from "./new-deck"

const doe = join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx")
const typed = "Every letter stays"
const agentText = "Agent letters stay"
const doeSlides = 41

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

test.use({ viewport: { width: 1600, height: 1000 } })

async function partsOf(file: string): Promise<Map<string, string>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, string>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory)
      parts.set(entry.filename, new TextDecoder().decode(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

function slideParts(parts: Map<string, string>): string[] {
  return [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort()
}

async function openFile(page: Page, file: string | undefined): Promise<{ address: string; slides: number }> {
  await page.goto("/")
  if (file === undefined) await newBlankDeck(page)
  else await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const slides = await page.locator("[data-slide-entry]").count()
  return { address: page.url(), slides }
}

async function addAndType(page: Page, text: string): Promise<Locator> {
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  const before = await texts.count()
  await page.getByRole("button", { name: "Add text box", exact: true }).click()
  await expect(texts).toHaveCount(before + 1)
  const added = texts.last()
  await expect(added).toBeFocused()
  await added.pressSequentially(text, { delay: 20 })
  await expect(added).toHaveText(text)
  const id = await added.evaluate(
    (node) => node.closest("[data-canvas-element]")?.getAttribute("data-canvas-element") ?? "",
  )
  expect(id).not.toBe("")
  return page.locator(`[data-canvas-element="${id}"] [contenteditable="true"]`)
}

async function stillOpen(page: Page, address: string, slides: number): Promise<void> {
  expect(page.url()).toBe(address)
  await settled(page)
  await expect(page.locator(".thin-page")).toBeVisible()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(slides)
}

async function exportedSlides(page: Page, testInfo: TestInfo, name: string): Promise<Map<string, string>> {
  const file = testInfo.outputPath(name)
  await savedExport(page, file)
  return partsOf(file)
}

test("a blank deck keeps every typed letter across a reload taken before undo, and the export keeps them", async ({
  page,
}, testInfo) => {
  const opened = await openFile(page, undefined)
  const added = await addAndType(page, typed)
  await page.reload()
  await stillOpen(page, opened.address, opened.slides)
  await expect(added).toHaveText(typed)
  const parts = await exportedSlides(page, testInfo, "blank-before-undo.pptx")
  expect(slideParts(parts)).toHaveLength(1)
  expect(parts.get("ppt/slides/slide1.xml")).toContain(`<a:t>${typed}</a:t>`)
  await stillOpen(page, opened.address, opened.slides)
})

test("a blank deck undo restores the text from before typing, and the reload and export keep that text", async ({
  page,
}, testInfo) => {
  const opened = await openFile(page, undefined)
  const added = await addAndType(page, typed)
  await page.keyboard.press("Escape")
  const undo = page.getByRole("button", { name: "Undo text edit" })
  await expect(undo).toBeEnabled()
  await undo.click()
  await expect(added).toHaveText("")
  await page.reload()
  await stillOpen(page, opened.address, opened.slides)
  await expect(added).toHaveText("")
  const parts = await exportedSlides(page, testInfo, "blank-after-undo.pptx")
  const slide = parts.get("ppt/slides/slide1.xml") ?? ""
  expect(slideParts(parts)).toHaveLength(1)
  expect(slide).not.toContain(typed)
  expect(slide).toContain("<a:t></a:t>")
  await stillOpen(page, opened.address, opened.slides)
})

test("doe-heat-pumps keeps every typed letter across a reload taken before undo, and the export keeps the deck", async ({
  page,
}, testInfo) => {
  const opened = await openFile(page, doe)
  expect(opened.slides).toBe(doeSlides)
  const added = await addAndType(page, typed)
  await page.reload()
  await stillOpen(page, opened.address, doeSlides)
  await expect(added).toHaveText(typed)
  const parts = await exportedSlides(page, testInfo, "doe-before-undo.pptx")
  const slides = slideParts(parts)
  expect(slides).toHaveLength(doeSlides)
  const body = slides.map((name) => parts.get(name) ?? "").join("\n")
  expect(body).toContain(`<a:t>${typed}</a:t>`)
  expect(body).toContain("<a:t>Introduction to Heat Pumps</a:t>")
  expect(body).toContain("<a:t>How do heat pumps work?</a:t>")
  await stillOpen(page, opened.address, doeSlides)
})

test("doe-heat-pumps undo restores the text from before typing, and the reload and export keep that text", async ({
  page,
}, testInfo) => {
  const opened = await openFile(page, doe)
  expect(opened.slides).toBe(doeSlides)
  const added = await addAndType(page, typed)
  await page.keyboard.press("Escape")
  const undo = page.getByRole("button", { name: "Undo text edit" })
  await expect(undo).toBeEnabled()
  await undo.click()
  await expect(added).toHaveText("")
  await page.reload()
  await stillOpen(page, opened.address, doeSlides)
  await expect(added).toHaveText("")
  const parts = await exportedSlides(page, testInfo, "doe-after-undo.pptx")
  const slides = slideParts(parts)
  expect(slides).toHaveLength(doeSlides)
  const body = slides.map((name) => parts.get(name) ?? "").join("\n")
  expect(body).not.toContain(typed)
  expect(body).toContain("<a:t>Introduction to Heat Pumps</a:t>")
  expect(body).toContain("<a:t>How do heat pumps work?</a:t>")
  await stillOpen(page, opened.address, doeSlides)
})

function watchFaults(page: Page, stack: Stack): Promise<{ loseOne: () => void; repeatLast: () => Promise<void> }> {
  let last = ""
  let lose = false
  let repeat: { readonly body: string; readonly done: () => void } | undefined
  const inflight = new Set<AbortController>()
  const ready = page.route("**/decks/watch", async (route) => {
    if (repeat !== undefined) {
      const pending = repeat
      repeat = undefined
      await route.fulfill({ status: 200, contentType: "application/json", body: pending.body })
      pending.done()
      return
    }
    if (lose) {
      lose = false
      await route.abort("connectionfailed")
      return
    }
    const controller = new AbortController()
    inflight.add(controller)
    const request = route.request()
    const url = new URL(request.url())
    const headers = await request.allHeaders()
    delete headers.host
    delete headers["content-length"]
    headers["visitor-country"] = "US"
    try {
      const response = await fetch(`${stack.origin}${url.pathname}${url.search}`, {
        method: request.method(),
        headers,
        body: request.postDataBuffer() ?? undefined,
        signal: controller.signal,
      })
      const body = await response.text()
      last = body
      await route.fulfill({
        status: response.status,
        contentType: response.headers.get("content-type") ?? "application/json",
        body,
      })
    } catch {
      await route.abort("connectionfailed").catch(() => undefined)
    } finally {
      inflight.delete(controller)
    }
  })
  return ready.then(() => ({
    loseOne() {
      const current = [...inflight]
      if (current.length > 0) {
        for (const controller of current) controller.abort()
        return
      }
      lose = true
    },
    repeatLast() {
      if (last === "") throw new Error("no watch answer to repeat")
      return new Promise<void>((resolve) => {
        repeat = { body: last, done: resolve }
        for (const controller of inflight) controller.abort()
      })
    },
  }))
}

async function agentTypesOnOpenDeck(page: Page, stack: Stack, file: string | undefined, probe: string): Promise<void> {
  const cookie = await stack.signIn()
  await signInBrowser(contextOf(page), cookie)
  await forward(page, stack)
  const faults = await watchFaults(page, stack)
  const opened = await openFile(page, file)
  const deck = new URL(opened.address).pathname.slice("/deck/".length)
  await page.evaluate(() => {
    document.body.dataset.sameLoad = "yes"
  })
  await expect
    .poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index, { timeout: 15_000 })
    .toBe("ready")
  const read = await stack.callTool("airdesign_read_deck", { deck }, cookie)
  expect(read.ok).toBe(true)
  const slide = (read.slides as { id: string }[])[0]?.id
  expect(slide).toBeTruthy()
  faults.loseOne()
  const add = await stack.callTool("airdesign_add_text_box", { deck, base: read.revision, slide }, cookie)
  expect(add.ok).toBe(true)
  const node = (add.elements as { node: string }[])[0]?.node
  expect(node).toBeTruthy()
  const value = JSON.stringify([{ from: 0, runs: [{ from: 0, text: probe }] }])
  const edited = await stack.callTool(
    "airdesign_edit_deck",
    { deck, base: add.revision, changes: [{ node, readAt: 0, value }] },
    cookie,
  )
  expect(edited.ok).toBe(true)
  const shown = page.locator('[data-slide-paint] [contenteditable="true"]').filter({ hasText: probe })
  await expect(shown).toHaveCount(1, { timeout: 15_000 })
  await expect(shown).toHaveText(probe)
  await faults.repeatLast()
  await expect(shown).toHaveCount(1)
  await expect(shown).toHaveText(probe)
  expect(await page.evaluate(() => document.body.dataset.sameLoad)).toBe("yes")
  await stillOpen(page, opened.address, opened.slides)
}

function contextOf(page: Page): ReturnType<Page["context"]> {
  return page.context()
}

test("an open blank deck shows an agent's text once after a lost watch answer and a repeated one", async ({
  page,
  stack,
}) => {
  test.setTimeout(60_000)
  await agentTypesOnOpenDeck(page, stack, undefined, agentText)
})

test("an open doe-heat-pumps deck shows an agent's text once after a lost watch answer and a repeated one", async ({
  page,
  stack,
}) => {
  test.setTimeout(60_000)
  await agentTypesOnOpenDeck(page, stack, doe, `${agentText} on the deck`)
})
