import { expect, it, vi } from "vitest"
import { R2OriginalStore } from "./r2-original-store.js"

it("reads font bytes and writes them without replacing an existing object", async () => {
  const fetched = vi.fn(async (request: Request) =>
    request.method === "PUT"
      ? new Response(null, { status: 412 })
      : request.url.includes("missing")
        ? new Response(null, { status: 404 })
        : new Response(new Uint8Array([0, 1, 0, 0])),
  )
  vi.stubGlobal("fetch", fetched)
  const store = new R2OriginalStore({
    accountId: "account",
    accessKeyId: "key",
    secretAccessKey: "secret",
    bucket: "files",
  })
  expect(await store.read("fonts/face.ttf")).toEqual(new Uint8Array([0, 1, 0, 0]))
  expect(await store.read("fonts/missing.ttf")).toBeUndefined()
  await store.write("fonts/face.ttf", new Uint8Array([0, 1, 0, 0]))
  const request = fetched.mock.calls.find(([request]) => request.method === "PUT")?.[0]
  expect(request?.headers.get("if-none-match")).toBe("*")
  expect(request?.headers.get("content-length")).toBe("4")
})
