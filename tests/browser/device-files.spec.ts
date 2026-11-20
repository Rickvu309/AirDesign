import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { decksOn, test } from "./deck-test"
import { stored } from "./device-store"
import { exportFromDialog, savedExport } from "./export-dialog.ts"
import { partsOf } from "./thin-deck-parts.ts"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const slide = "ppt/slides/slide1.xml"

test.describe.configure({ mode: "parallel" })

test.use({ viewport: { width: 1470, height: 923 } })

async function editedDeck(page: Page): Promise<void> {
  await decksOn(page).open(fixture)
  const editor = page.locator('[contenteditable="true"]')
  await editor.dblclick()
  await page.keyboard.press("End")
  await editor.pressSequentially("!", { delay: 50 })
  await stored(page, "Hello!")
}

async function dropDeviceFiles(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    for await (const name of root.keys()) await root.removeEntry(name, { recursive: true })
  })
}

async function answerOriginal(page: Page): Promise<void> {
  const bytes = await readFile(fixture)
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  await page.route("**/decks/original", async (route) => {
    const body = route.request().postDataJSON() as { deck: string }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        deck: body.deck,
        url: "/original-file",
        expires: "2099-01-01T00:00:00.000Z",
        bytes: bytes.byteLength,
        sha256,
      }),
    })
  })
  await page.route("**/original-file", (route) => route.fulfill({ body: bytes }))
}

test("an export whose device files are gone and cannot be fetched says why and downloads nothing", async ({ page }) => {
  await editedDeck(page)
  await dropDeviceFiles(page)
  let downloads = 0
  page.on("download", () => {
    downloads += 1
  })
  await exportFromDialog(page)
  await expect(page.getByText(productCopy.exportFileMissing)).toBeVisible()
  expect(downloads).toBe(0)
})

test("an export whose device files are gone fetches the deck's file again and keeps the edit", async ({
  page,
}, testInfo) => {
  await editedDeck(page)
  await dropDeviceFiles(page)
  await answerOriginal(page)
  const download = testInfo.outputPath("fetched-again.pptx")
  await savedExport(page, download)
  const original = await partsOf(fixture)
  const saved = await partsOf(download)
  expect([...saved.keys()]).toEqual([...original.keys()])
  const changed = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name)
  expect(changed).toEqual([slide])
  expect(saved.get(slide)?.toString("utf8") ?? "").toContain("Hello!")
})

test("a deck whose device files are gone opens on reload from the deck's file, with its edit", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(String(error)))
  await editedDeck(page)
  await dropDeviceFiles(page)
  await answerOriginal(page)
  await page.reload()
  await decksOn(page).ready()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello!")
  expect(errors).toEqual([])
})
