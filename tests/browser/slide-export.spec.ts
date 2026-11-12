import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { openRegister } from "../../packages/document/src/index.ts"
import { slideExportName, slideOriginalName } from "../../scripts/slide-export.mjs"

const fixture = join(process.cwd(), "scripts/pptx-fixtures", slideOriginalName)
const judged = join(process.cwd(), "tests/browser", slideExportName)
const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"

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

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function openFile(page: Page, file: string): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
}

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

async function slideRows(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(
              (all.result as { kind: string; slideEdit?: { slide: string } }[])
                .filter((row) => row.slideEdit !== undefined)
                .map((row) => `${row.kind}:${row.slideEdit?.slide}`),
            )
          }
        }
      }),
  )
}

async function answerOpens(page: Page): Promise<void> {
  await page.route("**/decks/index", async (route) => {
    const body = route.request().postDataJSON() as { deck: string }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, deck: body.deck, revision: 0 }),
    })
  })
  await page.route("**/decks/open", async (route) => {
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
      body: JSON.stringify({ ok: true, deck: body.deck, revision, key: `${body.deck}:${revision}` }),
    })
  })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a person adds, duplicates, deletes and reorders slides, then the export keeps that order", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  const download = testInfo.outputPath(slideExportName)
  await openFile(page, fixture)
  await expect(entry(page, 1).locator("[data-thumb-paint]")).toContainText("Hello")
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await entry(page, 3).focus()
  await page.keyboard.press(duplicate)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(4)
  await entry(page, 3).focus()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await entry(page, 3).focus()
  await page.keyboard.press("Alt+ArrowUp")
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 1).locator("[data-thumb-paint]")).toContainText("Hello")
  await expect(entry(page, 2).locator("[data-thumb-paint]")).toContainText("Heat pumps")
  await expect(entry(page, 3).locator("[data-thumb-paint]")).not.toContainText("Heat pumps")
  await page.reload()
  await settled(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 2).locator("[data-thumb-paint]")).toContainText("Heat pumps")
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  await (await saving).saveAs(download)
  const original = await partsOf(fixture)
  const saved = await partsOf(download)
  expect(saved.get("ppt/slides/slide1.xml")?.equals(original.get("ppt/slides/slide1.xml") ?? Buffer.from(""))).toBe(
    true,
  )
  await copyFile(download, judged)
  await openFile(page, judged)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 1).locator("[data-thumb-paint]")).toContainText("Hello")
  await expect(entry(page, 2).locator("[data-thumb-paint]")).toContainText("Heat pumps")
  await expect(entry(page, 3).locator("[data-thumb-paint]")).not.toContainText("Hello")
})

test("a slide added offline stays in the list and is sent when the network returns", async ({ page, context }) => {
  await answerOpens(page)
  await openFile(page, fixture)
  await page.route("**/decks/commit", (route) => route.abort("internetdisconnected"))
  await context.setOffline(true)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect.poll(() => slideRows(page)).toContain("pending:add")
  await answerCommits(page)
  await context.setOffline(false)
  await expect.poll(() => slideRows(page)).toContain("confirmed:add")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
})
