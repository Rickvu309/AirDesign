import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { BrowserContext, Page, TestInfo } from "@playwright/test"
import { deckStateFile } from "../../scripts/deck-state-file.mjs"
import { deviceRows, valuedKey, type DeviceRows, type RawDeviceRows, type RawRow } from "../device-rows.ts"

const keptLoads = 4
const loadBinding = "airdesignKeepDeckState"

type Reading = DeviceRows | { readonly error: string }

export type Load = {
  readonly navigation: string
  readonly url: string
  readonly ms: number
  readonly took: number
  readonly rows: Reading
}

export type DeckState = {
  readonly loads: () => readonly Load[]
  readonly attach: (testInfo: Pick<TestInfo, "status" | "outputPath" | "attach">) => Promise<void>
}

type Loaded = {
  readonly navigation: string
  readonly url: string
  readonly took: number
  readonly raw?: RawDeviceRows
  readonly error?: string
}

const said = (error: unknown) => (error instanceof Error ? error.message : String(error))

type Place = { readonly valued: string; readonly database: string; readonly store: string }

function collect({ valued, database: named, store: kept }: Place): Promise<RawDeviceRows> {
  return new Promise<RawDeviceRows>((resolve, reject) => {
    const shelf: Record<string, string> = {}
    for (let at = 0; at < localStorage.length; at += 1) {
      const key = localStorage.key(at)
      const value = key === null ? null : localStorage.getItem(key)
      if (key?.startsWith("airdesign:") === true && value !== null) shelf[key] = value
    }
    const request = indexedDB.open(named)
    request.onupgradeneeded = () => request.transaction?.abort()
    request.onerror = () => {
      if (request.error?.name === "AbortError") resolve({ rows: [], shelf })
      else reject(request.error)
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      const done = (rows: readonly RawRow[]) => {
        database.close()
        resolve({ rows, shelf })
      }
      if (!database.objectStoreNames.contains(kept)) {
        done([])
        return
      }
      const store = database.transaction(kept, "readonly").objectStore(kept)
      const listing = store.getAllKeys()
      listing.onerror = () => reject(listing.error)
      listing.onsuccess = () => {
        const pattern = new RegExp(valued)
        const rows: { key: string; value?: unknown }[] = listing.result.map((key) => ({ key: String(key) }))
        const wanted = rows.filter((row) => pattern.test(row.key))
        let left = wanted.length
        if (left === 0) done(rows)
        for (const row of wanted) {
          const one = store.get(row.key)
          one.onerror = () => reject(one.error)
          one.onsuccess = () => {
            row.value = one.result as unknown
            left -= 1
            if (left === 0) done(rows)
          }
        }
      }
    }
  })
}

async function place(): Promise<Place> {
  const { databaseName, storeName } = await import("../../packages/live/src/device.ts")
  return { valued: valuedKey.source, database: databaseName, store: storeName }
}

const onLoad = (binding: string, where: Place) => `(() => {
  if (window !== window.top || !/^https?:$/.test(location.protocol) || location.pathname.startsWith("/screens/") || location.pathname === "/version") return;
  const navigation = performance.getEntriesByType("navigation")[0]?.type ?? "navigate";
  const url = location.href;
  const started = performance.now();
  const send = (loaded) => window[${JSON.stringify(binding)}]?.({ navigation, url, took: performance.now() - started, ...loaded });
  (${collect.toString()})(${JSON.stringify(where)}).then((raw) => send({ raw }), (error) => send({ error: String(error) }));
})();`

export async function readDeviceRows(page: Page): Promise<DeviceRows> {
  return deviceRows(await page.evaluate(collect, await place()))
}

async function reading(page: Page): Promise<Reading> {
  try {
    return await readDeviceRows(page)
  } catch (error) {
    return { error: said(error) }
  }
}

export async function watchDeckState(context: BrowserContext, now: () => number = Date.now): Promise<DeckState> {
  const began = now()
  const loads: Load[] = []
  await context.exposeBinding(loadBinding, (_source, loaded: Loaded) => {
    const rows = loaded.raw === undefined ? { error: loaded.error ?? "no rows" } : deviceRows(loaded.raw)
    loads.push({ navigation: loaded.navigation, url: loaded.url, ms: now() - began, took: loaded.took, rows })
    if (loads.length > keptLoads) loads.shift()
  })
  await context.addInitScript({ content: onLoad(loadBinding, await place()) })
  return {
    loads: () => [...loads],
    async attach(testInfo) {
      const pages = context.pages().filter((page) => !page.isClosed() && /^https?:/.test(page.url()))
      if (pages.length === 0 && loads.length === 0) return
      const reader = pages[0]
      const device = reader === undefined ? { error: "no page of the app was open" } : await reading(reader)
      const file = testInfo.outputPath(deckStateFile)
      await mkdir(dirname(file), { recursive: true })
      const state = { status: testInfo.status, pages: pages.map((page) => page.url()), device, loads }
      await writeFile(file, `${JSON.stringify(state, null, 1)}\n`)
      await testInfo.attach(deckStateFile, { path: file, contentType: "application/json" })
    },
  }
}

export const deckStateFixture: [
  (given: { context: BrowserContext }, use: (state: DeckState) => Promise<void>, testInfo: TestInfo) => Promise<void>,
  { auto: true },
] = [
  async ({ context }, use, testInfo) => {
    const state = await watchDeckState(context)
    await use(state)
    if (testInfo.status !== testInfo.expectedStatus) await state.attach(testInfo)
  },
  { auto: true },
]
