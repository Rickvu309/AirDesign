import { describe, expect, it } from "vitest"
import { fetchImage, imageAddress } from "./image-fetch.js"
import { publicAddress, type PinnedNet, type Resolved } from "./pinned-net.js"

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

type Page = {
  readonly status: number
  readonly location?: string
  readonly length?: number
  readonly body?: Uint8Array
}

function net(hosts: Readonly<Record<string, readonly string[]>>, pages: Readonly<Record<string, Page>>) {
  const asked: { url: string; at: string }[] = []
  const shown: PinnedNet = {
    resolve: async (host) => {
      const found = hosts[host]
      if (found === undefined) throw new Error("no such host")
      return found.map((address): Resolved => ({ address, family: address.includes(":") ? 6 : 4 }))
    },
    get: async (url, at) => {
      asked.push({ url: url.href, at: at.address })
      const page = pages[url.href] ?? { status: 404 }
      const body = page.body ?? new Uint8Array()
      return {
        status: page.status,
        location: page.location,
        length: page.length,
        body: (async function* () {
          yield body
        })(),
        cancel: () => {},
      }
    },
  }
  return { shown, asked }
}

const cdn = { "images.example.com": ["93.184.216.34"] }

describe("which addresses an image may come from", () => {
  it.each([
    ["93.184.216.34", true],
    ["2606:2800:220:1:248:1893:25c8:1946", true],
    ["127.0.0.1", false],
    ["10.1.2.3", false],
    ["172.20.0.1", false],
    ["192.168.1.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["224.0.0.1", false],
    ["255.255.255.255", false],
    ["::1", false],
    ["::", false],
    ["::ffff:127.0.0.1", false],
    ["fe80::1", false],
    ["fd00::1", false],
    ["ff02::1", false],
    ["2002:7f00:1::", false],
    ["not an address", false],
  ])("%s public: %s", (address, shown) => {
    expect(publicAddress(address)).toBe(shown)
  })

  it("takes only an https address on the default port with no user name", () => {
    expect(imageAddress("https://images.example.com/logo.png")?.href).toBe("https://images.example.com/logo.png")
    expect(imageAddress("http://images.example.com/logo.png")).toBeNull()
    expect(imageAddress("https://user:secret@images.example.com/logo.png")).toBeNull()
    expect(imageAddress("https://images.example.com:8443/logo.png")).toBeNull()
    expect(imageAddress("file:///etc/passwd")).toBeNull()
    expect(imageAddress(`https://images.example.com/${"a".repeat(2048)}.png`)).toBeNull()
    expect(imageAddress("not a url")).toBeNull()
  })
})

describe("fetching an image an agent names", () => {
  it("fetches a PNG once from the address it resolved, and reads its type and size from the bytes", async () => {
    const { shown, asked } = net(cdn, { "https://images.example.com/logo.png": { status: 200, body: png(480, 320) } })
    const fetched = await fetchImage("https://images.example.com/logo.png", shown)
    expect(fetched).toMatchObject({ ok: true, type: "image/png", width: 480, height: 320 })
    expect(asked).toEqual([{ url: "https://images.example.com/logo.png", at: "93.184.216.34" }])
  })

  it("refuses a host that resolves to a private address, even beside a public one", async () => {
    const inside = net({ "intranet.example.com": ["93.184.216.34", "10.0.0.5"] }, {})
    expect(await fetchImage("https://intranet.example.com/a.png", inside.shown)).toEqual({
      ok: false,
      refusal: "private",
    })
    expect(inside.asked).toEqual([])
    expect(await fetchImage("https://127.0.0.1/a.png", net({}, {}).shown)).toEqual({ ok: false, refusal: "private" })
    expect(await fetchImage("https://[::1]/a.png", net({}, {}).shown)).toEqual({ ok: false, refusal: "private" })
  })

  it("checks every redirect again and stops after three", async () => {
    const pages = {
      "https://images.example.com/a.png": { status: 302, location: "/b.png" },
      "https://images.example.com/b.png": { status: 200, body: png(10, 20) },
      "https://images.example.com/plain.png": { status: 301, location: "http://images.example.com/b.png" },
      "https://images.example.com/inside.png": { status: 307, location: "https://metadata.example.com/b.png" },
      "https://images.example.com/loop.png": { status: 302, location: "/loop.png" },
    }
    const hosts = { ...cdn, "metadata.example.com": ["169.254.169.254"] }
    expect(await fetchImage("https://images.example.com/a.png", net(hosts, pages).shown)).toMatchObject({
      ok: true,
      width: 10,
      height: 20,
    })
    const plain = await fetchImage("https://images.example.com/plain.png", net(hosts, pages).shown)
    expect(plain).toEqual({ ok: false, refusal: "address" })
    const inside = await fetchImage("https://images.example.com/inside.png", net(hosts, pages).shown)
    expect(inside).toEqual({ ok: false, refusal: "private" })
    const looped = net(hosts, pages)
    expect(await fetchImage("https://images.example.com/loop.png", looped.shown)).toEqual({
      ok: false,
      refusal: "unreachable",
    })
    expect(looped.asked).toHaveLength(4)
  })

  it("refuses a missing page, an unknown host, and bytes that are not a PNG, JPEG or GIF", async () => {
    const webp = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ")
    const pages = { "https://images.example.com/photo.webp": { status: 200, body: webp } }
    expect(await fetchImage("https://images.example.com/gone.png", net(cdn, pages).shown)).toEqual({
      ok: false,
      refusal: "status",
    })
    expect(await fetchImage("https://nowhere.example.com/a.png", net(cdn, pages).shown)).toEqual({
      ok: false,
      refusal: "unreachable",
    })
    expect(await fetchImage("https://images.example.com/photo.webp", net(cdn, pages).shown)).toEqual({
      ok: false,
      refusal: "type",
    })
  })

  it("refuses an image at or over the size limit, from its length or from what arrives", async () => {
    const pages = {
      "https://images.example.com/said.png": { status: 200, length: 100, body: png(1, 1) },
      "https://images.example.com/sent.png": { status: 200, body: png(1, 1) },
    }
    expect(await fetchImage("https://images.example.com/said.png", net(cdn, pages).shown, { cap: 100 })).toEqual({
      ok: false,
      refusal: "size",
    })
    expect(await fetchImage("https://images.example.com/sent.png", net(cdn, pages).shown, { cap: 24 })).toEqual({
      ok: false,
      refusal: "size",
    })
  })

  it("refuses a small file whose image passes forty million pixels, before anything decodes it", async () => {
    const pages = { "https://images.example.com/huge.png": { status: 200, body: png(30_000, 30_000) } }
    expect(await fetchImage("https://images.example.com/huge.png", net(cdn, pages).shown)).toEqual({
      ok: false,
      refusal: "size",
    })
  })

  it("stops waiting when the server does not answer in time", async () => {
    const slow: PinnedNet = {
      resolve: async () => [{ address: "93.184.216.34", family: 4 }],
      get: (_url, _at, signal) =>
        new Promise((_done, failed) => signal.addEventListener("abort", () => failed(signal.reason))),
    }
    expect(await fetchImage("https://images.example.com/slow.png", slow, { wait: 20 })).toEqual({
      ok: false,
      refusal: "timeout",
    })
  })
})
