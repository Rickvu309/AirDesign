export async function clearBrowser(page) {
  const current = new URL(page.url())
  if (current.pathname !== "/version") await page.goto(new URL("/version", current).href)
  await page.evaluate(async () => {
    localStorage.clear()
    sessionStorage.clear()
    const listed = typeof indexedDB.databases === "function" ? await indexedDB.databases() : []
    for (const database of listed) {
      if (database.name === undefined) continue
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(database.name)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
    const directory = await navigator.storage?.getDirectory?.()
    if (directory === undefined) return
    for await (const name of directory.keys()) await directory.removeEntry(name, { recursive: true })
  })
}
