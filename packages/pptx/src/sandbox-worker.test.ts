import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js"
import { describe, expect, it } from "vitest"
import { readPackage } from "./package-limits.js"
import { rssCapBytes, runSandboxed, type SandboxProcess } from "./sandbox-worker.js"

function encode(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index)
  return bytes
}

async function deck(): Promise<Uint8Array> {
  const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter())
  await writer.add("[Content_Types].xml", new Uint8ArrayReader(encode("<Types/>")), { level: 0 })
  await writer.add("ppt/presentation.xml", new Uint8ArrayReader(encode("<p:presentation/>")), { level: 0 })
  await writer.add("ppt/slides/slide1.xml", new Uint8ArrayReader(encode("<p:sld/>")), { level: 0 })
  return writer.close()
}

function fake(rss: () => number, killed: { value: boolean }): SandboxProcess {
  return {
    rss,
    kill() {
      killed.value = true
    },
  }
}

type HostProcess = SandboxProcess & {
  readonly killed: () => boolean
  readonly send: (message: { readonly name: string; readonly bytes?: number }) => void
  readonly next: () => Promise<{ readonly name: string }>
  readonly close: () => void
}

function spin(milliseconds: number) {
  const end = Date.now() + milliseconds
  while (Date.now() < end) {}
}

function highWater(child: HostProcess): number {
  let peak = child.rss()
  for (let index = 0; index < 20; index += 1) {
    spin(20)
    const next = child.rss()
    if (next > peak) peak = next
  }
  return peak
}

function hostHref(): string {
  const from = (import.meta as { url: string }).url
  const slash = from.lastIndexOf("/")
  const parent = from.slice(0, slash)
  const root = parent.slice(0, parent.lastIndexOf("/") + 1)
  return `${root}sandbox-process.mjs`
}

async function host(): Promise<{ openSandbox: () => HostProcess }> {
  return import(hostHref())
}

describe("runSandboxed", () => {
  it("uses a 512 MiB cap and allows a child sitting on that cap", async () => {
    expect(rssCapBytes).toBe(512 * 1024 * 1024)
    const killed = { value: false }
    const result = await runSandboxed([fake(() => rssCapBytes, killed)], 0, async () => "kept")
    expect(result).toEqual({ ok: true, value: "kept" })
    expect(killed.value).toBe(false)
  })

  it("kills the named child over the cap and does not run the job", async () => {
    const quiet = { value: false }
    const loud = { value: false }
    let ran = false
    const result = await runSandboxed([fake(() => 1, quiet), fake(() => rssCapBytes + 1, loud)], 1, async () => {
      ran = true
      return "kept"
    })
    expect(result).toEqual({ ok: false, reason: "rss" })
    expect(ran).toBe(false)
    expect(loud.value).toBe(true)
    expect(quiet.value).toBe(false)
  })

  it("drops the result when the named child crosses the cap and leaves the other", async () => {
    let rss = 1
    const quiet = { value: false }
    const loud = { value: false }
    const result = await runSandboxed([fake(() => 1, quiet), fake(() => rss, loud)], 1, async () => {
      rss = rssCapBytes + 1
      return "parts"
    })
    expect(result).toEqual({ ok: false, reason: "rss" })
    expect(loud.value).toBe(true)
    expect(quiet.value).toBe(false)
  })

  it("keeps the named child when a different child is over the cap", async () => {
    const quiet = { value: false }
    const loud = { value: false }
    const result = await runSandboxed([fake(() => rssCapBytes + 1, loud), fake(() => 1, quiet)], 1, async () => "kept")
    expect(result).toEqual({ ok: true, value: "kept" })
    expect(quiet.value).toBe(false)
    expect(loud.value).toBe(false)
  })

  it("reads a package while another process is over the cap", async () => {
    expect(readPackage.toString()).not.toContain("rss")
    expect(readPackage.toString()).not.toContain("runSandboxed")
    const opened = await host()
    const loud = opened.openSandbox()
    try {
      const before = loud.rss()
      loud.send({ name: "grow", bytes: 16 * 1024 * 1024 })
      expect(await loud.next()).toMatchObject({ name: "grew" })
      expect(loud.rss()).toBeGreaterThan(before + 8 * 1024 * 1024)
      const read = await readPackage(await deck())
      expect(read.ok).toBe(true)
    } finally {
      loud.close()
    }
  })

  it("kills the child whose resident set crosses the cap", async () => {
    const opened = await host()
    const quiet = opened.openSandbox()
    const loud = opened.openSandbox()
    try {
      const cap = highWater(loud) + 32 * 1024 * 1024
      let grew = false
      const result = await runSandboxed(
        [quiet, loud],
        1,
        async () => {
          loud.send({ name: "grow", bytes: 96 * 1024 * 1024 })
          const message = await loud.next()
          grew = message.name === "grew"
          return message
        },
        cap,
      )
      expect(grew).toBe(true)
      expect(result).toEqual({ ok: false, reason: "rss" })
      expect(loud.killed()).toBe(true)
      expect(quiet.killed()).toBe(false)
    } finally {
      quiet.close()
      loud.close()
    }
  })
})
