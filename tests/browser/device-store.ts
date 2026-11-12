import type { Page } from "@playwright/test"

export async function stored(page: Page, value: string): Promise<void> {
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
      const value = (row as { value: unknown }).value
      if (typeof value !== "string") return false
      try {
        const paragraphs = JSON.parse(value) as { runs: { text: string }[] }[]
        return paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n") === expected
      } catch {
        return false
      }
    })
  }, value)
}
