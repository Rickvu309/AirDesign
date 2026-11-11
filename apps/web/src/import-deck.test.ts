import { deckName, deckRoutes } from "@airdesign/catalog"
import { afterEach, expect, it, vi } from "vitest"
import { importDeck, nameImportedDeck, saveDeck } from "./import-deck"

const live = vi.hoisted(() => {
  const saved: { deck: string; name?: string }[] = []
  return { saved }
})

vi.mock("@airdesign/live", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@airdesign/live")
  return {
    ...actual,
    connect: () => ({
      async open() {
        return { ok: true }
      },
    }),
    putParts: async (deck: string, stored: { name?: string }) => {
      live.saved.push({ deck, ...stored })
      return { ok: true, ...stored }
    },
  }
})

afterEach(() => {
  live.saved.length = 0
  vi.unstubAllGlobals()
})

async function cleanFile(): Promise<Uint8Array> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return fs.readFile(new URL("../../../scripts/pptx-fixtures/clean.pptx", import.meta.url))
}

async function wasmBytes(): Promise<Uint8Array> {
  const fsName = "node:fs/promises"
  const moduleName = "node:module"
  const fs = (await import(fsName)) as { readFile: (path: string) => Promise<Uint8Array> }
  const nodeModule = (await import(moduleName)) as {
    createRequire: (url: string) => { resolve: (id: string) => string }
  }
  return fs.readFile(nodeModule.createRequire(import.meta.url).resolve("sax-wasm/lib/sax-wasm.wasm"))
}

async function importedNames(fileName: string) {
  const wasm = await wasmBytes()
  const server: unknown[] = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (String(url) !== deckRoutes.rename.path) return new Response(Uint8Array.from(wasm).buffer)
    server.push(deckRoutes.rename.read(JSON.parse(String(init?.body))))
    return new Response("{}")
  })
  const imported = await importDeck(new File([Uint8Array.from(await cleanFile())], fileName))
  if (imported === null) throw new Error("import")
  await nameImportedDeck(imported)
  return { device: live.saved[0], server }
}

it("saves the file name without .pptx with the deck", async () => {
  await saveDeck(new Map([["first", new Uint8Array([1])]]), new Uint8Array([1]), deckName("Board deck.PPTX"))
  expect(live.saved[0]?.name).toBe("Board deck")
})

it("gives an imported deck the same name on the device and on the server", async () => {
  const { device, server } = await importedNames("Board deck.PPTX")
  expect(device?.name).toBe("Board deck")
  expect(server).toEqual([{ ok: true, deck: device?.deck, name: "Board deck" }])
})

it("names a deck on the server from a long file name that has an emoji", async () => {
  const name = `${"x".repeat(199)}\ud83d\ude00`
  const { device, server } = await importedNames(`${name}.pptx`)
  expect(device?.name).toBe(name)
  expect(server).toEqual([{ ok: true, deck: device?.deck, name }])
})
