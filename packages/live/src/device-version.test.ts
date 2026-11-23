import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { databaseName, newPage, openDatabase } from "./device.js"
import { deleteDatabase } from "./index.js"

const shippedVersion = 99

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("opens the database a device already holds, so a new build never reads as an older one", async () => {
  await new Promise<void>((resolve, reject) => {
    const request = globalThis.indexedDB.open(databaseName, shippedVersion)
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
    request.onerror = () => reject(request.error ?? new Error("open"))
  })
  newPage()
  await expect(openDatabase()).resolves.toBeDefined()
})
