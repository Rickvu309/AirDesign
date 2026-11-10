import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const fixture = join(fixtures, "clean.pptx")
const exported = join(process.cwd(), "tests/browser/exported-deck.pptx")
const slide = "ppt/slides/slide1.xml"

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

async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

async function changedParts(before: string, after: string): Promise<string[]> {
  const original = await partsOf(before)
  const saved = await partsOf(after)
  expect([...saved.keys()]).toEqual([...original.keys()])
  return [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name)
}

const deckAddress = /\/thin\/[A-Za-z0-9_-]{1,64}$/

async function choose(page: Page, file: string): Promise<string> {
  const before = page.url()
  await page.locator("input[type=file]").setInputFiles(file)
  await expect.poll(() => page.url()).not.toBe(before)
  await expect(page).toHaveURL(deckAddress)
  return page.url()
}

async function open(page: Page, file: string): Promise<string> {
  await page.goto("/thin")
  return choose(page, file)
}

async function stored(page: Page, value: string): Promise<void> {
  await page.waitForFunction(async (expected) => {
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = indexedDB.open("airdesign")
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction("rows", "readonly")
        const all = transaction.objectStore("rows").getAll()
        all.onerror = () => reject(all.error)
        all.onsuccess = () => {
          database.close()
          resolve(all.result as unknown[])
        }
      }
    })
    return rows.some((row) => {
      if (typeof row !== "object" || row === null || !("value" in row)) return false
      return (row as { value: unknown }).value === expected
    })
  }, value)
}

async function saveExport(page: Page, file: string): Promise<void> {
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  await (await download).saveAs(file)
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("an edit to Hello! survives reload and exports", async ({ page }, testInfo) => {
  await rm(exported, { force: true })
  const download = testInfo.outputPath("exported-deck.pptx")
  const address = await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Hello!", { delay: 50 })
  await expect(editor).toHaveText("Hello!")
  await stored(page, "Hello!")
  await page.reload()
  expect(page.url()).toBe(address)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello!")
  await saveExport(page, download)
  expect(await changedParts(fixture, download)).toEqual([slide])
  const saved = (await partsOf(download)).get(slide)?.toString("utf8") ?? ""
  expect(saved.match(/<a:t>[^<]*<\/a:t>/g)).toEqual(["<a:t>Hello!</a:t>"])
  await copyFile(download, exported)
})

test("a page with no deck id shows no slide", async ({ page }) => {
  await page.goto("/thin")
  await expect(page.locator("input[type=file]")).toHaveCount(1)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
})

test("a second browser context gets a different deck id", async ({ page, browser }) => {
  const address = await open(page, fixture)
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL })
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

test("a bare /thin after a deck was opened reads no deck", async ({ page }) => {
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await page.addInitScript(() => {
    const reads = { count: 0 }
    Object.assign(globalThis, { deckReads: reads })
    const openDatabase = indexedDB.open.bind(indexedDB)
    indexedDB.open = (name: string, version?: number) => {
      reads.count += 1
      return openDatabase(name, version)
    }
    const directory = navigator.storage.getDirectory.bind(navigator.storage)
    navigator.storage.getDirectory = () => {
      reads.count += 1
      return directory()
    }
  })
  await page.goto("/thin")
  await expect(page.locator("input[type=file]")).toHaveCount(1)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await page.evaluate(() => (globalThis as unknown as { deckReads: { count: number } }).deckReads.count)).toBe(0)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
})

test("a second deck does not carry the first deck's edit", async ({ page }, testInfo) => {
  const marker = "MARKER4471"
  const saved = testInfo.outputPath("second-deck.pptx")
  const first = await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially(marker, { delay: 50 })
  await expect(editor).toHaveText(`Hello${marker}`)
  await stored(page, `Hello${marker}`)
  const second = await choose(page, join(fixtures, "doe-heat-pumps.pptx"))
  expect(second).not.toBe(first)
  await expect(page.getByText("Introduction to Heat Pumps").first()).toBeVisible()
  await page.reload()
  expect(page.url()).toBe(second)
  await expect(page.getByText("Introduction to Heat Pumps").first()).toBeVisible()
  await expect(page.getByText(marker)).toHaveCount(0)
  await saveExport(page, saved)
  await everyPartLacks(saved, marker)
})

test("typing key by key keeps the order of the letters", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially(" world", { delay: 50 })
  await expect(editor).toHaveText("Hello world")
  await stored(page, "Hello world")
  await page.reload()
  await expect(editor).toHaveText("Hello world")
  await editor.click()
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
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially(" a  b ", { delay: 50 })
  await expect.poll(() => editor.textContent()).toBe("Hello a  b ")
  await stored(page, "Hello a  b ")
  await page.reload()
  await expect.poll(() => editor.textContent()).toBe("Hello a  b ")
})

async function paste(page: Page, data: Record<string, string>): Promise<void> {
  await page.evaluate((entries) => {
    const clipboardData = new DataTransfer()
    for (const [type, value] of Object.entries(entries)) clipboardData.setData(type, value)
    document
      .querySelector('[contenteditable="true"]')
      ?.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }))
  }, data)
}

test("a line break stays out of a box that holds one line", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("End")
  await page.keyboard.press("Enter")
  await page.keyboard.press("Shift+Enter")
  await editor.pressSequentially("x", { delay: 50 })
  await expect.poll(() => editor.textContent()).toBe("Hellox")
  await stored(page, "Hellox")
  await paste(page, { "text/plain": "one\r\ntwo" })
  await expect.poll(() => editor.textContent()).toBe("Helloxone two")
  await stored(page, "Helloxone two")
  await paste(page, { "text/html": "<p>one</p><p>two</p>" })
  await paste(page, { "text/plain": "a\u2028b\u2029c\u0085d\u000be\u000cf" })
  await expect.poll(() => editor.textContent()).toBe("Helloxone twoa b c d e f")
  await stored(page, "Helloxone twoa b c d e f")
  await page.keyboard.press("ControlOrMeta+a")
  await paste(page, {})
  await expect.poll(() => editor.textContent()).toBe("Helloxone twoa b c d e f")
  await page.reload()
  await expect.poll(() => editor.textContent()).toBe("Helloxone twoa b c d e f")
})

test("a cleared box is stored empty", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await expect.poll(() => editor.textContent()).toBe("")
  await stored(page, "")
  await page.reload()
  await expect(editor).toHaveText("")
})

test("an export with no edit keeps every part byte for byte", async ({ page }, testInfo) => {
  const saved = testInfo.outputPath("no-edit.pptx")
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await saveExport(page, saved)
  expect(await changedParts(fixture, saved)).toEqual([])
})

test("an export with no edit is the same file byte for byte", async ({ page }, testInfo) => {
  const saved = testInfo.outputPath("no-edit.pptx")
  await open(page, fixture)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await saveExport(page, saved)
  expect(await changedParts(fixture, saved)).toEqual([])
  expect((await readFile(saved)).equals(await readFile(fixture))).toBe(true)
})

test("a box that cannot keep an edit is not editable", async ({ page }) => {
  await open(page, join(fixtures, "nasa-1d-cnn.pptx"))
  await expect(page.getByText(/1D-Convolutional/).first()).toBeVisible()
  await expect(page.locator('[contenteditable="false"]').filter({ hasText: /1D-Convolutional/ })).toHaveCount(1)
  await expect(page.locator('[contenteditable="true"]').filter({ hasText: /1D-Convolutional/ })).toHaveCount(0)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(18)
  await page.locator("input[type=file]").setInputFiles(fixture)
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveCount(1)
  await expect(editor).toHaveText("Hello")
  await editor.click()
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

async function answerCommits(page: Page): Promise<void> {
  await page.unroute("**/decks/commit")
  let revision = 0
  await page.route("**/decks/commit", async (route) => {
    const body = route.request().postDataJSON() as { deck: string }
    revision += 1
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, deck: body.deck, revision, key: `${body.deck}:${revision}` }),
    })
  })
}

async function confirmed(page: Page, value: string): Promise<void> {
  await expect
    .poll(async () => (await rowsOf(page)).map((row) => `${row.kind}:${row.value}`))
    .toEqual([`confirmed:${value}`])
}

test("two text boxes keep their own edits after reload and both export", async ({ page }, testInfo) => {
  const deck = join(fixtures, "doe-heat-pumps.pptx")
  const download = testInfo.outputPath("two-boxes.pptx")
  const address = await open(page, deck)
  const title = page.locator('[contenteditable="true"]').filter({ hasText: /^What is a heat pump\?$/ })
  const body = page.locator('[contenteditable="true"]').filter({ hasText: /^Same technology as:$/ })
  await title.click()
  await page.keyboard.press("End")
  await title.pressSequentially(" Alpha", { delay: 50 })
  await stored(page, "What is a heat pump? Alpha")
  await body.click()
  await page.keyboard.press("End")
  await body.pressSequentially(" Beta", { delay: 50 })
  await stored(page, "Same technology as: Beta")
  await page.reload()
  expect(page.url()).toBe(address)
  const editors = page.locator('[contenteditable="true"]')
  await expect(editors.filter({ hasText: /^What is a heat pump\? Alpha$/ })).toHaveCount(1)
  await expect(editors.filter({ hasText: /^Same technology as: Beta$/ })).toHaveCount(1)
  const nodes = new Set((await rowsOf(page)).map((row) => row.node))
  expect([...nodes].sort()).toEqual(["2727.2", "2727.44"])
  await saveExport(page, download)
  expect(await changedParts(deck, download)).toEqual(["ppt/slides/slide4.xml"])
  const saved = (await partsOf(download)).get("ppt/slides/slide4.xml")?.toString("utf8") ?? ""
  expect(saved).toContain("<a:t>What is a heat pump? Alpha</a:t>")
  expect(saved).toContain("<a:t>Same technology as: Beta</a:t>")
})

test("an edit left pending by a failed commit is sent after a reload", async ({ page }) => {
  await page.route("**/decks/commit", (route) => route.fulfill({ status: 503, body: "" }))
  await open(page, fixture)
  const editor = page.locator('[contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially("!", { delay: 50 })
  await stored(page, "Hello!")
  expect((await rowsOf(page)).map((row) => `${row.kind}:${row.value}`)).toEqual(["pending:Hello!"])
  await answerCommits(page)
  await page.reload()
  await confirmed(page, "Hello!")
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello!")
})

test("an edit made offline is sent when the page comes back online", async ({ page, context }) => {
  await open(page, fixture)
  await page.route("**/decks/commit", (route) => route.abort("internetdisconnected"))
  await context.setOffline(true)
  const editor = page.locator('[contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially("?", { delay: 50 })
  await stored(page, "Hello?")
  expect((await rowsOf(page)).map((row) => `${row.kind}:${row.value}`)).toEqual(["pending:Hello?"])
  await answerCommits(page)
  await context.setOffline(false)
  await confirmed(page, "Hello?")
})
