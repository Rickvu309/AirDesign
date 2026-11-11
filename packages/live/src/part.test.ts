import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installIndexedDb, installParts } from "./browser-fixtures.js"
import { connect, deleteDatabase, getPart, getParts, memoryRemote, putPart, putParts } from "./index.js"
import { writeSlot } from "./store.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

describe("live cache", () => {
  it("stores one part for the same bytes", async () => {
    const files = installParts()
    const bytes = new Uint8Array([1, 2, 3, 4])
    const first = await putPart(bytes)
    const second = await putPart(bytes)
    expect(second).toBe(first)
    expect(files.size).toBe(1)
    expect(Array.from(await getPart(first))).toEqual([1, 2, 3, 4])
  })

  it("stores a deck's parts with names and hashes only", async () => {
    installParts()
    const bytes = new Uint8Array([9, 8, 7])
    const slide = "ppt/slides/slide1.xml"
    const saved = await putParts("clean", { parts: new Map([[slide, bytes]]), file: new Uint8Array([5]) })
    expect(saved.ok).toBe(true)
    const read = await getParts("clean")
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(Object.keys(read).sort()).toEqual(["file", "ok", "parts"])
    expect(Array.from(read.parts.get(slide) ?? [])).toEqual([9, 8, 7])
  })

  it("keeps the name stored with a deck", async () => {
    installParts()
    const slide = "ppt/slides/slide1.xml"
    await putParts("named", {
      parts: new Map([[slide, new Uint8Array([9])]]),
      file: new Uint8Array([5]),
      name: "Board deck",
    })
    const read = await getParts("named")
    expect(read.ok && read.name).toBe("Board deck")
  })

  it("reads an old part row that still carries a node table", async () => {
    installParts()
    const slide = "ppt/slides/slide1.xml"
    await writeSlot("clean\u0001", {
      names: { [slide]: await putPart(new Uint8Array([9, 8, 7])) },
      file: await putPart(new Uint8Array([5])),
      nodes: { a: { part: slide, shape: "2" } },
    })
    const read = await getParts("clean")
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(Object.keys(read).sort()).toEqual(["file", "ok", "parts"])
    expect(Array.from(read.parts.get(slide) ?? [])).toEqual([9, 8, 7])
    expect(Array.from(read.file)).toEqual([5])
  })

  it("refuses a part list of 65536 bytes", async () => {
    installParts()
    const saved = await putParts("clean", {
      parts: new Map([["n".repeat(70_000), new Uint8Array([1])]]),
      file: new Uint8Array([5]),
    })
    expect(saved).toEqual({ ok: false, refusal: "limit" })
    expect(await getParts("clean")).toEqual({ ok: false, refusal: "absent" })
  })

  it("reads the same part names and hashes back after a new connect", async () => {
    const files = installParts()
    const shared = new Uint8Array([9, 8, 7])
    const other = new Uint8Array([255, 0, 128])
    const slide = "ppt/slides/slide1.xml"
    const copy = "ppt/slides/slide2.xml"
    const notes = "ppt/notesSlides/notesSlide1.xml"
    const saved = await putParts("clean", {
      parts: new Map<string, Uint8Array>([
        [slide, shared],
        [copy, shared],
        [notes, other],
      ]),
      file: shared,
    })
    expect(saved.ok).toBe(true)
    const sha256 = async (bytes: Uint8Array) => {
      const payload = new Uint8Array(new ArrayBuffer(bytes.byteLength))
      payload.set(bytes)
      const digest = await crypto.subtle.digest("SHA-256", payload)
      let text = ""
      for (const byte of new Uint8Array(digest)) text += byte.toString(16).padStart(2, "0")
      return text
    }
    const sharedHash = await sha256(shared)
    const otherHash = await sha256(other)
    expect([...files.keys()].sort()).toEqual([sharedHash, otherHash].sort())
    for (const [hash, bytes] of files) expect(hash).toBe(await sha256(bytes))
    const stored = [...files.keys()].sort()
    const written = new Map(files)
    const cache = connect(memoryRemote())
    const opened = await cache.openDeck("clean")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.pending).toEqual([])
    expect(opened.confirmed).toEqual([])
    expect(await cache.rows("clean")).toEqual([])
    const read = await getParts("clean")
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect([...read.parts.keys()]).toEqual([slide, copy, notes])
    expect(Array.from(read.parts.get(slide) ?? [])).toEqual([9, 8, 7])
    expect(Array.from(read.parts.get(copy) ?? [])).toEqual([9, 8, 7])
    expect(Array.from(read.parts.get(notes) ?? [])).toEqual([255, 0, 128])
    expect(files.size).toBe(2)
    expect([...files.keys()].sort()).toEqual(stored)
    for (const [hash, bytes] of written) expect(files.get(hash)).toBe(bytes)
  })

  it("keeps each deck's parts apart after a new connect", async () => {
    installParts()
    const slide = "ppt/slides/slide1.xml"
    const notes = "ppt/notesSlides/notesSlide1.xml"
    const layout = "ppt/slideLayouts/slideLayout1.xml"
    const blank = "ppt/media/blank.bin"
    const stale = await putParts("other", {
      parts: new Map<string, Uint8Array>([[layout, new Uint8Array([1])]]),
      file: new Uint8Array([1]),
    })
    const clean = await putParts("clean", {
      parts: new Map<string, Uint8Array>([
        [slide, new Uint8Array([9, 8, 7])],
        [layout, new Uint8Array([3])],
      ]),
      file: new Uint8Array([2]),
    })
    const other = await putParts("other", {
      parts: new Map<string, Uint8Array>([
        [slide, new Uint8Array([4, 5])],
        [notes, new Uint8Array([6])],
        [blank, new Uint8Array()],
      ]),
      file: new Uint8Array([3]),
    })
    expect(clean.ok).toBe(true)
    expect(stale.ok).toBe(true)
    expect(other.ok).toBe(true)
    const cache = connect(memoryRemote())
    expect((await cache.openDeck("clean")).ok).toBe(true)
    expect((await cache.openDeck("other")).ok).toBe(true)
    const readClean = await getParts("clean")
    const readOther = await getParts("other")
    expect(readClean.ok).toBe(true)
    expect(readOther.ok).toBe(true)
    if (!readClean.ok || !readOther.ok) return
    expect([...readClean.parts.keys()]).toEqual([slide, layout])
    expect(Array.from(readClean.parts.get(slide) ?? [])).toEqual([9, 8, 7])
    expect(Array.from(readClean.parts.get(layout) ?? [])).toEqual([3])
    expect([...readOther.parts.keys()]).toEqual([slide, notes, blank])
    expect(Array.from(readOther.parts.get(slide) ?? [])).toEqual([4, 5])
    expect(Array.from(readOther.parts.get(notes) ?? [])).toEqual([6])
    expect(readOther.parts.get(blank)?.byteLength).toBe(0)
  })

  it("answers absent for parts after the database is deleted", async () => {
    installParts()
    const saved = await putParts("clean", {
      parts: new Map([["ppt/slides/slide1.xml", new Uint8Array([9, 8, 7])]]),
      file: new Uint8Array([1]),
    })
    expect(saved.ok).toBe(true)
    await deleteDatabase()
    expect(await getParts("clean")).toEqual({ ok: false, refusal: "absent" })
  })

  it("reads a deck's opened file back after a new connect", async () => {
    installParts()
    const file = new Uint8Array([80, 75, 3, 4, 200, 1])
    await putParts("clean", { parts: new Map([["ppt/slides/slide1.xml", new Uint8Array([9])]]), file })
    await connect(memoryRemote()).openDeck("clean")
    const read = await getParts("clean")
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(Array.from(read.file)).toEqual(Array.from(file))
  })

  it("keeps each deck's own opened file", async () => {
    installParts()
    await putParts("first", {
      parts: new Map([["ppt/slides/slide1.xml", new Uint8Array([9])]]),
      file: new Uint8Array([1, 1]),
    })
    await putParts("second", {
      parts: new Map([["ppt/slides/slide1.xml", new Uint8Array([9])]]),
      file: new Uint8Array([2, 2]),
    })
    const first = await getParts("first")
    const second = await getParts("second")
    expect(first.ok && Array.from(first.file)).toEqual([1, 1])
    expect(second.ok && Array.from(second.file)).toEqual([2, 2])
  })

  it("answers absent for a row without the opened file", async () => {
    installParts()
    await writeSlot("clean\u0001", { names: { ["ppt/slides/slide1.xml"]: await putPart(new Uint8Array([9])) } })
    expect(await getParts("clean")).toEqual({ ok: false, refusal: "absent" })
  })
})
