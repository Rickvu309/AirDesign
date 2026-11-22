import { createServer } from "node:http"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { databaseName, storeName } from "@airdesign/live"
import { openBrowser } from "./browser.mjs"
import { clearBrowser } from "./clear-browser.mjs"

const html = "<!doctype html><title>clear</title>"

function listen() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    response.end(html)
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server))
  })
}

async function holdDeviceStore(page) {
  await page.evaluate(
    ({ databaseName, storeName }) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName)
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName)
        }
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          database.onversionchange = () => {
            window.heldVersionChange = true
            setTimeout(() => database.close(), 0)
          }
          resolve()
        }
      }),
    { databaseName, storeName },
  )
}

describe("clearBrowser", () => {
  let server
  let origin
  let browser

  beforeAll(async () => {
    server = await listen()
    origin = `http://127.0.0.1:${String(server.address().port)}`
    browser = await openBrowser()
  })

  afterAll(async () => {
    await browser?.close()
    await new Promise((resolve) => server.close(resolve))
  })

  it("deletes the device store while another page still holds the connection", async () => {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      const holder = await context.newPage()
      await page.goto(`${origin}/version`)
      await holder.goto(`${origin}/hold`)
      await holdDeviceStore(holder)
      await clearBrowser(page)
      const names = await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name))
      const saw = await holder.evaluate(() => window.heldVersionChange === true)
      expect(names).not.toContain(databaseName)
      expect(saw).toBe(true)
    } finally {
      await context.close()
    }
  })
})
