import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect, test, type Browser, type BrowserContext } from "@playwright/test"

type Pool = {
  take: () => Promise<BrowserContext>
  give: (context: BrowserContext) => Promise<void>
  close: () => Promise<void>
}

const poolFile = join(process.cwd(), ".agents/skills/verify-airdesign/look/context-pool.mjs")
const load = async () =>
  (await import(pathToFileURL(poolFile).href)) as { contextPool: (browser: Browser, options: object) => Pool }

test("a context given back to the pool starts the next state as a new one", async ({ browser, baseURL }) => {
  const { contextPool } = await load()
  const pool = contextPool(browser, { baseURL, storageState: { cookies: [], origins: [] } })
  try {
    const first = await pool.take()
    await first.addCookies([
      { name: "left", value: "behind", url: baseURL! },
      { name: "left", value: "behind", url: "https://never-requested.example/" },
    ])
    await first.grantPermissions(["clipboard-read"], { origin: baseURL! })
    await first.route("**/left-behind", (route) => route.fulfill({ body: "routed" }))
    const page = await first.newPage()
    await page.goto("/")
    await page.evaluate(async () => {
      localStorage.setItem("left", "behind")
      sessionStorage.setItem("left", "behind")
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("left-behind")
        request.onsuccess = () => {
          request.result.close()
          resolve(undefined)
        }
        request.onerror = () => reject(request.error)
      })
      const root = await navigator.storage.getDirectory()
      await root.getFileHandle("left-behind", { create: true })
    })
    await first.newPage()
    await first.setOffline(true)
    await pool.give(first)

    const second = await pool.take()
    expect(second).toBe(first)
    expect(second.pages()).toEqual([])
    expect(await second.cookies()).toEqual([])
    const next = await second.newPage()
    await next.goto("/")
    const left = await next.evaluate(async () => {
      const root = await navigator.storage.getDirectory()
      const files: string[] = []
      for await (const name of (root as unknown as { keys: () => AsyncIterable<string> }).keys()) files.push(name)
      return {
        local: localStorage.length,
        session: sessionStorage.length,
        databases: (await indexedDB.databases()).map((database) => database.name),
        files,
        online: navigator.onLine,
        clipboard: (await navigator.permissions.query({ name: "clipboard-read" as PermissionName })).state,
        routed: await (await fetch("/left-behind")).text(),
      }
    })
    expect(left).toEqual({
      local: 0,
      session: 0,
      databases: [],
      files: [],
      online: true,
      clipboard: "prompt",
      routed: expect.not.stringContaining("routed"),
    })
    await pool.give(second)
  } finally {
    await pool.close()
  }
})

test("a context that cannot be cleared is closed, never given to the next state", async ({ browser, baseURL }) => {
  const { contextPool } = await load()
  const pool = contextPool(browser, { baseURL })
  try {
    const first = await pool.take()
    await first.close()
    await pool.give(first)
    const second = await pool.take()
    expect(second).not.toBe(first)
    await pool.give(second)
  } finally {
    await pool.close()
  }
})
