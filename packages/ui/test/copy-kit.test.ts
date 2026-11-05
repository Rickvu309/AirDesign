import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { copyKit } from "../src/copy/copy-kit.ts"

describe("copy kit", () => {
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
