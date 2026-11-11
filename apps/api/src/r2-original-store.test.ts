import { afterEach, expect, it, vi } from "vitest"

import { R2OriginalStore } from "./r2-original-store.js"

const settings = {
  accountId: "account",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  bucket: "originals",
}
const now = () => Date.UTC(2026, 0, 2, 3, 4, 5)
const key = "originals/abc/deck/id"

afterEach(() => {
  vi.unstubAllGlobals()
})

it("signs an upload url with the size and no-overwrite headers and a known signature", async () => {
  const signed = await new R2OriginalStore(settings, now).upload(key, 21)
  const url = new URL(signed.url)
  expect(url.origin).toBe("https://account.r2.cloudflarestorage.com")
  expect(url.pathname).toBe("/originals/originals/abc/deck/id")
  expect(url.searchParams.get("X-Amz-Expires")).toBe("900")
  expect(url.searchParams.get("X-Amz-Credential")).toBe("AKIDEXAMPLE/20260102/auto/s3/aws4_request")
  expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;host;if-none-match")
  expect(url.searchParams.get("X-Amz-Signature")).toBe(
    "723c0d9ca3593e1172564e62a1e6357ec14e2a904267d77025e591576f4ea29a",
  )
  expect(signed.headers).toEqual({ "content-length": "21", "if-none-match": "*" })
  expect(signed.expires).toBe("2026-01-02T03:19:05.000Z")
})

it("signs a download url with a known signature", async () => {
  const signed = await new R2OriginalStore(settings, now).download(key)
  const url = new URL(signed.url)
  expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host")
  expect(url.searchParams.get("X-Amz-Signature")).toBe(
    "bf07e575c76e59db98af2afa89de4a43031d580e75170470951ec72e3b7327a5",
  )
  expect(signed.expires).toBe("2026-01-02T03:19:05.000Z")
})

it("reads an object's size from storage and treats an absent object as missing", async () => {
  const fetched = vi.fn(async (request: Request) =>
    request.url.includes("present")
      ? new Response(null, { headers: { "content-length": "21" } })
      : new Response(null, { status: 404 }),
  )
  vi.stubGlobal("fetch", fetched)
  const store = new R2OriginalStore(settings, now)
  expect(await store.size("present")).toBe(21)
  expect(await store.size("absent")).toBeUndefined()
  expect(fetched.mock.calls[0]?.[0].method).toBe("HEAD")
})

it("fails a delete when storage is down so the key stays for a retry", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 503 })),
  )
  await expect(new R2OriginalStore(settings, now).delete(key)).rejects.toThrow("storage")
})
