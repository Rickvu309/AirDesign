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

export async function storedValues(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = indexedDB.open("airdesign")
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
        all.onerror = () => reject(all.error)
        all.onsuccess = () => {
          database.close()
          resolve(all.result as unknown[])
        }
      }
    })
    return rows.flatMap((row) => {
      if (typeof row !== "object" || row === null || !("value" in row)) return []
      const value = (row as { value: unknown }).value
      return typeof value === "string" ? [value] : []
    })
  })
}

export async function holdDeviceStore(page: Page): Promise<() => Promise<void>> {
  await page.evaluate(
    () =>
      new Promise<void>((held, refused) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => refused(request.error)
        request.onsuccess = () => {
          const database = request.result
          const stores = [...database.objectStoreNames]
          const writing = database.transaction(stores, "readwrite")
          const rows = writing.objectStore(stores[0] ?? "")
          const scope = window as Window & { releaseDeviceStore?: () => void }
          let releasing = false
          scope.releaseDeviceStore = () => {
            releasing = true
          }
          const keep = () => {
            if (!releasing) rows.get("held").onsuccess = keep
          }
          keep()
          writing.oncomplete = () => database.close()
          held()
        }
      }),
  )
  return () =>
    page.evaluate(() => {
      const scope = window as Window & { releaseDeviceStore?: () => void }
      scope.releaseDeviceStore?.()
    })
}
