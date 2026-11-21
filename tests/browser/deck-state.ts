import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { BrowserContext, Page, TestInfo } from "@playwright/test"
import { deckStateFile } from "../../scripts/deck-state-file.mjs"
import { deviceRows, valuedKey, type DeviceRows, type RawDeviceRows, type RawRow } from "../device-rows.ts"

const shownDeck = /^\/deck\/([A-Za-z0-9_-]{1,64})$/
const keptLoads = 4
const keptAnswer = 500
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

const deckOf = (page: Page) => {
  try {
    return shownDeck.exec(new URL(page.url()).pathname)?.[1]
  } catch {
    return undefined
  }
}

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
  if (window !== window.top || !/^https?:$/.test(location.protocol) || location.pathname.startsWith("/screens/")) return;
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

type OpenAnswer = {
  readonly ok?: unknown
  readonly revision?: unknown
  readonly register?: { readonly elements?: unknown }
}

function openAnswer(text: string): OpenAnswer | undefined {
  try {
    return JSON.parse(text) as OpenAnswer
  } catch {
    return undefined
  }
}

async function serverDeck(page: Page, deck: string): Promise<Record<string, unknown>> {
  try {
    const { deckRoutes } = await import("../../packages/catalog/src/index.ts")
    const answer = await page.evaluate(
      async ({ path, deck }) => {
        const response = await fetch(path, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deck }),
        })
        return { status: response.status, text: await response.text() }
      },
      { path: deckRoutes.open.path, deck },
    )
    const opened = openAnswer(answer.text)
    if (opened?.ok === true)
      return { deck, status: answer.status, revision: opened.revision, elements: opened.register?.elements }
    return { deck, status: answer.status, answer: answer.text.slice(0, keptAnswer) }
  } catch (error) {
    return { deck, error: said(error) }
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
      const server: Record<string, unknown>[] = []
      const asked = new Set<string>()
      for (const page of pages) {
        const deck = deckOf(page)
        if (deck === undefined || asked.has(deck)) continue
        asked.add(deck)
        server.push(await serverDeck(page, deck))
      }
      const file = testInfo.outputPath(deckStateFile)
      await mkdir(dirname(file), { recursive: true })
      const state = { status: testInfo.status, pages: pages.map((page) => page.url()), device, server, loads }
      await writeFile(file, `${JSON.stringify(state, null, 1)}\n`)
      await testInfo.attach(deckStateFile, { path: file, contentType: "application/json" })
    },
  }
}
