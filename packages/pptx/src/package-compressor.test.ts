import { terminateWorkers } from "@zip.js/zip.js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CompressorError, carryPackage } from "./package-carry.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { readParts } from "./package-container.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
  getBuiltinModule(name: "node:crypto"): {
    createHash(name: "sha256"): { update(data: Uint8Array): { digest(encoding: "hex"): string } }
  }
}

declare const WebAssembly: { instantiate(...args: readonly unknown[]): Promise<unknown> }

const { readFileSync } = process.getBuiltinModule("node:fs")
const { createHash } = process.getBuiltinModule("node:crypto")
const fixture = (name: string) => new Uint8Array(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))

async function changedDeck(name: string, part: string) {
  const original = fixture(name)
  const parts = new Map(await readParts(original))
  const before = parts.get(part)
  if (before === undefined) throw new Error(part)
  const tail = encodeUtf8("<!-- carried -->")
  const next = new Uint8Array(before.length + tail.length)
  next.set(before, 0)
  next.set(tail, before.length)
  return { original, parts, changed: new Map(parts).set(part, next) }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await terminateWorkers()
})

describe("carryPackage compressor", () => {
  it("pins the recompressed bytes of a changed part", async () => {
    const { original, changed } = await changedDeck("nasa-1d-cnn.pptx", "ppt/slideMasters/slideMaster1.xml")
    const written = await carryPackage(original, changed)
    expect(createHash("sha256").update(written).digest("hex")).toBe(
      "a65a27fe7209571e1c816d5a229f8b98cf87f5ec5dc691558548f0e72bf9b088",
    )
  }, 30_000)

  it("throws CompressorError and writes nothing when the bundled compressor cannot load", async () => {
    const { original, changed } = await changedDeck("clean.pptx", "ppt/slides/slide1.xml")
    await terminateWorkers()
    vi.spyOn(WebAssembly, "instantiate").mockRejectedValue(new Error("blocked"))
    await expect(carryPackage(original, changed)).rejects.toBeInstanceOf(CompressorError)
  })

  it("still copies an unedited file byte for byte when the compressor cannot load", async () => {
    const { original, parts } = await changedDeck("clean.pptx", "ppt/slides/slide1.xml")
    await terminateWorkers()
    vi.spyOn(WebAssembly, "instantiate").mockRejectedValue(new Error("blocked"))
    expect(sameBytes(await carryPackage(original, parts), original)).toBe(true)
  })

  it("gives the same bytes once the compressor loads again", async () => {
    const { original, changed } = await changedDeck("clean.pptx", "ppt/slides/slide1.xml")
    await terminateWorkers()
    const blocked = vi.spyOn(WebAssembly, "instantiate").mockRejectedValue(new Error("blocked"))
    await expect(carryPackage(original, changed)).rejects.toBeInstanceOf(CompressorError)
    blocked.mockRestore()
    await terminateWorkers()
    const first = await carryPackage(original, changed)
    await terminateWorkers()
    expect(sameBytes(await carryPackage(original, changed), first)).toBe(true)
  })
})
