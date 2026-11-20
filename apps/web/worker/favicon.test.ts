import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { expect, it } from "vitest"
import worker from "./api-forward.js"

const publicFile = (path: string) => readFileSync(new URL(`../public/${path}`, import.meta.url))
const sitePublicFile = (path: string) => readFileSync(new URL(`../../site/public/${path}`, import.meta.url))

const iconTypes = [
  ["favicon-art.svg", "image/svg+xml"],
  ["favicon-32.png", "image/png"],
  ["apple-touch-icon.png", "image/png"],
  ["favicon.ico", "image/x-icon"],
] as const

const pngInkShare = (png: Buffer) => {
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const colorType = png[25]
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (channels === 0) throw new Error(`Unsupported PNG color type ${String(colorType)}`)
  const chunks: Buffer[] = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    const kind = png.subarray(offset + 4, offset + 8).toString("ascii")
    if (kind === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const stride = width * channels
  const previous = Buffer.alloc(stride)
  const current = Buffer.alloc(stride)
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  let inked = 0
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1)
    const filter = raw[rowStart]
    for (let i = 0; i < stride; i += 1) {
      const byte = raw[rowStart + 1 + i] ?? 0
      const left = i >= channels ? (current[i - channels] ?? 0) : 0
      const up = previous[i] ?? 0
      const upLeft = i >= channels ? (previous[i - channels] ?? 0) : 0
      const recon =
        filter === 0
          ? byte
          : filter === 1
            ? byte + left
            : filter === 2
              ? byte + up
              : filter === 3
                ? byte + Math.floor((left + up) / 2)
                : byte + paeth(left, up, upLeft)
      current[i] = recon & 0xff
    }
    for (let x = 0; x < width; x += 1) {
      const base = x * channels
      const r = current[base] ?? 255
      const g = current[base + 1] ?? 255
      const b = current[base + 2] ?? 255
      const a = channels === 4 ? (current[base + 3] ?? 255) : 255
      if (a > 10 && (r < 245 || g < 245 || b < 245)) inked += 1
    }
    current.copy(previous)
  }
  return inked / (width * height)
}

it("uses the same weighted AirDesign tab mark on the site and studio, including dark tabs", () => {
  const mark = publicFile("favicon-art.svg").toString()
  const site = sitePublicFile("favicon-art.svg").toString()
  expect(site).toBe(mark)
  expect(mark).toContain('stroke-width="7"')
  expect(mark).toContain('stroke-width="5"')
  expect(mark).toContain('d="M13 57l19-50 19 50"')
  expect(mark).toContain('d="M6 44l52-14"')
  expect(mark).toContain("prefers-color-scheme: dark")
})

it("shares the weighted PNG, home-screen and ICO icons between studio and site", () => {
  for (const [path] of iconTypes) {
    expect(sitePublicFile(path)).toEqual(publicFile(path))
  }
  expect(pngInkShare(publicFile("apple-touch-icon.png"))).toBeGreaterThan(0.12)
})

it.each([
  ["studio", "../index.html", publicFile],
  ["site", "../../site/src/site/site-document.astro", sitePublicFile],
])("links the SVG, 32px fallback and 180px home-screen icon on %s", (_, documentPath, readPublic) => {
  const html = readFileSync(new URL(documentPath, import.meta.url), "utf8")
  for (const [rel, path, size] of [
    ["icon", "favicon-32.png", "32x32"],
    ["apple-touch-icon", "apple-touch-icon.png", "180x180"],
  ]) {
    expect(html).toMatch(new RegExp(`<link rel="${rel}"[^>]*sizes="${size}"[^>]*href="/${path}"`))
    const png = readPublic(path)
    expect(png.subarray(1, 4).toString()).toBe("PNG")
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(size)
  }
  expect(html).toContain('type="image/svg+xml" href="/favicon-art.svg"')
})

it.each(iconTypes)("serves %s as an image on studio and declares its header on site", async (path, contentType) => {
  expect(publicFile("_headers").toString()).toContain(`/${path}\n  Content-Type: ${contentType}`)
  expect(sitePublicFile("_headers").toString()).toContain(`/${path}\n  Content-Type: ${contentType}`)
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
