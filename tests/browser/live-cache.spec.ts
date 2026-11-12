import { rm } from "node:fs/promises"
import { chromium, expect, test } from "@playwright/test"

async function launch(directory: string, baseURL: string) {
  const context = await chromium.launchPersistentContext(directory, { baseURL })
  await context.addCookies([{ name: "airdesign.account", value: "a".repeat(32), url: baseURL }])
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto("/live-proof")
  return { context, page }
}

test("pending edits survive a killed tab", async ({ baseURL }, testInfo) => {
  expect(baseURL).toBeTruthy()
  const profile = testInfo.outputPath("profile")
  await rm(profile, { recursive: true, force: true })
  const first = await launch(profile, baseURL ?? "")
  await first.page.evaluate(async () => {
    await globalThis.airdesignLive.enqueue("deck", "earlier", "258.7")
    await globalThis.airdesignLive.enqueue("deck", "later", "258.8")
  })
  await first.context.close()
  const second = await launch(profile, baseURL ?? "")
  const pending = await second.page.evaluate(async () => {
    const rows = await globalThis.airdesignLive.pending("deck")
    return rows.map((row) => row.value)
  })
  expect(pending).toEqual(["earlier", "later"])
  const batch = await second.page.evaluate(async () => {
    const live = globalThis.airdesignLive
    const remote = live.memoryRemote()
    const seen: string[] = []
    const commit = remote.commit.bind(remote)
    remote.commit = async (body) => {
      for (const edit of body.batch) seen.push(edit.value)
      return commit(body)
    }
    live.useRemote(remote)
    await live.flush("deck")
    return seen
  })
  expect(batch).toEqual(["earlier", "later"])
  await second.context.close()
  await rm(profile, { recursive: true, force: true })
})

test("cold open reads 3000 rows in one getAll", async ({ baseURL }, testInfo) => {
  expect(baseURL).toBeTruthy()
  const profile = testInfo.outputPath("profile")
  await rm(profile, { recursive: true, force: true })
  const first = await launch(profile, baseURL ?? "")
  await first.page.evaluate(async () => {
    const live = globalThis.airdesignLive
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(live.database, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(live.store)
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction(live.store, "readwrite")
        const store = transaction.objectStore(live.store)
        let revision = 0
        for (let slide = 1; slide <= 50; slide += 1) {
          for (let index = 0; index < 60; index += 1) {
            store.put(
              { kind: "confirmed", deck: "bench", revision, value: `${slide}-${index}` },
              live.rowKey("bench", "confirmed", revision),
            )
            revision += 1
          }
        }
        for (let other = 0; other < 3; other += 1) {
          store.put(
            { kind: "confirmed", deck: "other", revision: other, value: `o${other}` },
            live.rowKey("other", "confirmed", other),
          )
        }
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
    })
  })
  await first.context.close()
  const second = await launch(profile, baseURL ?? "")
  const measured = await second.page.evaluate(async () => {
    const entries: { start: number; duration: number }[] = []
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) entries.push({ start: entry.startTime, duration: entry.duration })
    })
    observer.observe({ type: "longtask", buffered: false })
    let getAllCount = 0
    let cursorCount = 0
    let span = 0
    let started = 0
    let ended = 0
    let rowCount = 0
    let otherCount = 0
    const originalGetAll = IDBObjectStore.prototype.getAll
    const originalCursor = IDBObjectStore.prototype.openCursor
    IDBObjectStore.prototype.getAll = function (this: IDBObjectStore, ...args: [IDBKeyRange?]) {
      getAllCount += 1
      started = performance.now()
      const request = originalGetAll.apply(this, args)
      request.addEventListener("success", () => {
        ended = performance.now()
        span = ended - started
        const result = request.result as { deck?: string }[]
        rowCount = result.length
        otherCount = result.filter((row) => row.deck === "other").length
      })
      return request
    }
    IDBObjectStore.prototype.openCursor = function (this: IDBObjectStore, ...args: [IDBKeyRange?]) {
      cursorCount += 1
      return originalCursor.apply(this, args)
    }
    await globalThis.airdesignLive.openDeck("bench")
    await new Promise((resolve) => setTimeout(resolve, 0))
    observer.disconnect()
    const covered = entries.some((entry) => entry.start <= started && entry.start + entry.duration >= ended)
    return { getAllCount, cursorCount, span, rowCount, otherCount, covered }
  })
  console.log(`cold getAll ${measured.span}`)
  expect(measured.getAllCount).toBe(1)
  expect(measured.cursorCount).toBe(0)
  expect(measured.rowCount).toBe(3000)
  expect(measured.otherCount).toBe(0)
  expect(measured.span).toBeLessThanOrEqual(2000)
  expect(measured.covered).toBe(false)
  await second.context.close()
  await rm(profile, { recursive: true, force: true })
})
