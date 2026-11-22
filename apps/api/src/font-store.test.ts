import { expect, it } from "vitest"
import { LocalOriginalStore } from "./platform/local-original-store.js"

it("caches font bytes without requiring a device's signed URL", async () => {
  const store = new LocalOriginalStore(undefined, "/device-original")
  expect(await store.read("fonts/face.ttf")).toBeUndefined()
  await store.write("fonts/face.ttf", new Uint8Array([1, 2, 3]))
  expect(await store.read("fonts/face.ttf")).toEqual(new Uint8Array([1, 2, 3]))
  await store.write("fonts/face.ttf", new Uint8Array([4]))
  expect(await store.read("fonts/face.ttf")).toEqual(new Uint8Array([1, 2, 3]))
})
