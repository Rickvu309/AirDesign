import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import worker from "./api-forward.js"

const publicFile = (path: string) => readFileSync(new URL(`../public/${path}`, import.meta.url))

it("gives the studio tab mark optical weight without thickening the site mark", () => {
  const mark = publicFile("favicon-art.svg").toString()
  const site = readFileSync(new URL("../../site/public/favicon-art.svg", import.meta.url), "utf8")
  expect(mark).toContain('stroke-width="7"')
  expect(mark).toContain('stroke-width="5"')
  expect(site).toContain('stroke-width="3.063"')
  expect(site).toContain('stroke-width="2.188"')
  expect(mark).toContain('d="M13 57l19-50 19 50"')
  expect(mark).toContain('d="M6 44l52-14"')
  expect(mark).toContain("prefers-color-scheme: dark")
})

it("links the SVG, 32px fallback and 180px home-screen icon", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  for (const [rel, path, size] of [
    ["icon", "favicon-32.png", "32x32"],
    ["apple-touch-icon", "apple-touch-icon.png", "180x180"],
  ]) {
    expect(html).toMatch(new RegExp(`<link rel="${rel}"[^>]*sizes="${size}"[^>]*href="/${path}"`))
    const png = publicFile(path)
    expect(png.subarray(1, 4).toString()).toBe("PNG")
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(size)
  }
  expect(html).toContain('type="image/svg+xml" href="/favicon-art.svg"')
})

it.each([
  ["favicon-art.svg", "image/svg+xml"],
  ["favicon-32.png", "image/png"],
  ["apple-touch-icon.png", "image/png"],
  ["favicon.ico", "image/x-icon"],
])("serves %s as an image through the worker's static path", async (path, contentType) => {
  const headers = publicFile("_headers").toString()
  expect(headers).toContain(`/${path}\n  Content-Type: ${contentType}`)
  const response = await worker.fetch(new Request(`https://studio.airdesign.app/${path}`), {
    ASSETS: {
      fetch: async (request) => {
        const file = publicFile(new URL(request.url).pathname.slice(1))
        return new Response(file, { headers: { "content-type": contentType } })
      },
    },
  })
  expect(response.headers.get("content-type")).toBe(contentType)
  expect(Buffer.from(await response.arrayBuffer())).toEqual(publicFile(path))
})
