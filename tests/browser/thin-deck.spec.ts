import { rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const exported = join(process.cwd(), "tests/browser/exported-deck.pptx")

test.use({ viewport: { width: 1600, height: 1000 } })

test("an edit to Hello! survives reload and exports", async ({ page }) => {
  await page.goto("/thin")
  await page.locator("input[type=file]").setInputFiles(fixture)
  const editor = page.locator("[contenteditable]")
  await expect(editor).toHaveText("Hello")
  await editor.fill("Hello!")
  await page.waitForFunction(async () => {
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
      return (row as { value: unknown }).value === "Hello!"
    })
  })
  await page.reload()
  await expect(page.locator("[contenteditable]")).toHaveText("Hello!")
  await rm(exported, { force: true })
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  await (await download).saveAs(exported)
})
