import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { copyKit } from "../src/copy/copy-kit.ts"
import { copy } from "../src/copy/read-copy.ts"
import { studioFoundationCopy } from "../src/copy/studio-foundation-copy.ts"

describe("copy kit", () => {
  it("reads supplemental Studio labels without shadowing canonical copy", () => {
    expect(Object.keys(studioFoundationCopy).filter(key => key in copyKit)).toEqual([])
    expect(copy("decks.recents")).toBe("Recents")
    expect(copy("access.check_title")).toBe(copyKit["access.check_title"])
  })
  it("keeps supplemental keys and values distinct from canonical copy", () => {
    const canonicalKeys = new Set(Object.keys(copyKit))
    const canonicalValues = new Set<string>(Object.values(copyKit))
    expect(Object.entries(studioFoundationCopy).filter(([key, value]) => canonicalKeys.has(key) || canonicalValues.has(value))).toEqual([])
  })
  it("matches the design kit string keys", () => {
    const design = JSON.parse(readFileSync("docs/design/v0.1/copy-kit.json", "utf8")) as Record<string, unknown>
    const packaged = JSON.parse(readFileSync("packages/ui/src/copy/copy-kit.json", "utf8")) as Record<string, unknown>
    const designStrings = strings(design)
    const packagedStrings = strings(packaged)
    expect(packagedStrings).toEqual(designStrings)
    expect(copyKit).toEqual(designStrings)
  })
})

function strings(record: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
}
