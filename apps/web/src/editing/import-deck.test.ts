import { deckName, deckRoutes } from "@airdesign/catalog"
import { afterEach, expect, it, vi } from "vitest"
import { importDeck, saveDeck } from "./import-deck"

const live = vi.hoisted(() => {
  const saved: { deck: string; name?: string }[] = []
  return { saved }
})

vi.mock("@airdesign/live", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@airdesign/live")
  return {
    ...actual,
    queueOriginal: async () => {},
    connect: () => ({
      index: async () => ({ ok: true }),
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
  return fs.readFile(new URL("../../../../scripts/pptx-fixtures/clean.pptx", import.meta.url))
}

async function importedNames(fileName: string) {
  const imported = await importDeck(new File([Uint8Array.from(await cleanFile())], fileName))
  if (!imported.ok) throw new Error("import")
  const device = live.saved[0]
  return { device, server: deckRoutes.rename.read({ deck: device?.deck, name: device?.name }) }
}

it("returns a failure reason when the file is not a valid package", async () => {
  const result = await importDeck(new File([Uint8Array.from([1, 2, 3])], "broken.pptx"))
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toBe("zip")
  }
})

it("saves the file name without .pptx with the deck", async () => {
  await saveDeck(new Map([["first", new Uint8Array([1])]]), new Uint8Array([1]), deckName("Board deck.PPTX"))
  expect(live.saved[0]?.name).toBe("Board deck")
})

it("gives an imported deck the same name on the device and on the server", async () => {
  const { device, server } = await importedNames("Board deck.PPTX")
  expect(device?.name).toBe("Board deck")
  expect(server).toEqual({ ok: true, deck: device?.deck, name: "Board deck" })
})

it("names a deck on the server from a long file name that has an emoji", async () => {
  const name = `${"x".repeat(199)}\ud83d\ude00`
  const { device, server } = await importedNames(`${name}.pptx`)
  expect(device?.name).toBe(name)
  expect(server).toEqual({ ok: true, deck: device?.deck, name })
})
