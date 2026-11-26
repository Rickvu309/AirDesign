import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { kitPieces, readKitPiece } from "./index.js"

const piecesDir = fileURLToPath(new URL("../pieces", import.meta.url))
const files = readdirSync(piecesDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -5))
  .sort()

const keysIn = (value: unknown): readonly string[] =>
  typeof value !== "object" || value === null
    ? []
    : Array.isArray(value)
      ? value.flatMap(keysIn)
      : Object.entries(value).flatMap(([key, inner]) => [key, ...keysIn(inner)])

describe("kit pieces", () => {
  it("lists every piece file and opens each one with its size", () => {
    expect(files.length).toBeGreaterThan(0)
    expect(kitPieces().map((piece) => piece.name)).toEqual(files)
    for (const name of files) {
      const piece = readKitPiece(name)
      const box = (piece?.tree.props as { box?: { w: number; h: number } } | undefined)?.box
      expect(piece?.size).toEqual({ w: box?.w, h: box?.h })
    }
  })

  it("grows each piece into layers Doom accepts", () => {
    for (const piece of kitPieces())
      expect(() => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [piece.tree] }] })).not.toThrow()
  })

  it("names only theme colours and text styles, so a piece follows any deck's theme", () => {
    for (const name of files) {
      const raw = readFileSync(`${piecesDir}/${name}.json`, "utf8")
      expect(raw, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(keysIn(JSON.parse(raw)), name).not.toContain("font")
    }
  })

  it("opens nothing outside the pieces", () => {
    expect(readKitPiece("missing")).toBeUndefined()
    expect(readKitPiece("../package")).toBeUndefined()
    expect(readKitPiece("/etc/passwd")).toBeUndefined()
    expect(readKitPiece("")).toBeUndefined()
  })
})
