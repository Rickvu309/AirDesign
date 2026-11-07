import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { studioFoundationHits } from "../../scripts/lint/studio-foundation.ts"

const file = "packages/ui/src/tokens/tokens.css"
const fixed = readFileSync(file, "utf8")
describe("Studio design foundation", () => {
  it("rejects the original off-design primary colors and accepts the design", () => {
    const original = fixed.replace("--primary: #4d94fb", "--primary: #2d6fcd").replace("--primary-top: #93b8ef", "--primary-top: #3e6fbe")
    expect(studioFoundationHits(file, original).map(hit => hit.reason)).toEqual(["studio-design-token-primary-must-be-#4d94fb", "studio-design-token-primary-top-must-be-#93b8ef"])
    expect(studioFoundationHits(file, fixed)).toEqual([])
  })
  it("rejects the original content-box sizing that overflowed phone access cards", () => {
    expect(studioFoundationHits(file, fixed.replace("box-sizing: border-box", "box-sizing: content-box"))).toContainEqual({ line: 1, reason: "studio-card-and-dialog-padding-requires-border-box-reset" })
  })
})
