import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { studioFoundationHits } from "../../scripts/lint/studio-foundation.ts"

const file = "packages/ui/src/tokens/tokens.css"
const fixed = readFileSync(file, "utf8")
describe("Studio design foundation", () => {
  it("rejects phone input zoom and undersized touch targets", () => {
    expect(studioFoundationHits(file, fixed.replace(".ad-field-input,.ad-search input,.ad-code-box { font-size:16px; }", "").replace("min-width:44px;min-height:44px;", ""))).toEqual([{ line: 1, reason: "studio-touch-controls-require-readable-inputs-targets-and-safe-area" }])
  })
  it("rejects obsolete shell browser locators and accepts the designed names", () => {
    const browser = "bench/studio/browser-check.mjs"
    const source = readFileSync(browser, "utf8")
    expect(studioFoundationHits(browser, source)).toEqual([])
    const original = source.replace('name:"Your first deck starts here"', 'name:"No decks yet"').replace('name:"New deck"', 'name:"+ New deck"').replaceAll('getByRole("searchbox",{name:"Search",exact:true})', 'getByLabel("Search decks")')
    expect(studioFoundationHits(browser, original).map(hit => hit.reason)).toEqual(Array(5).fill("studio-browser-check-uses-designed-shell-accessible-names"))
  })
  it("keeps supplemental labels out of the exact canonical copy kit", () => {
    for (const suffix of ["ts", "json"]) {
      const copyFile = `packages/ui/src/copy/copy-kit.${suffix}`
      const source = readFileSync(copyFile, "utf8")
      expect(studioFoundationHits(copyFile, source)).toEqual([])
      expect(studioFoundationHits(copyFile, source.replace("{", '{\n  "shell.recents": "Recents",'))).toEqual([{ line: 2, reason: "studio-supplemental-copy-belongs-in-studio-foundation-copy" }])
    }
  })
  it("rejects the flat expired-link layout and inherited heavy title", () => {
    expect(studioFoundationHits(file, fixed.replace(".ad-access-error { display:flex;width:min(360px,100%);flex-direction:column;align-items:center;gap:20px; }", "").replace("font-weight:500;letter-spacing:normal;line-height:normal;", "font-weight:600;"))).toEqual([{ line: 1, reason: "studio-expired-link-uses-generator-mark-spacing-and-medium-title" }])
  })
  it("keeps the code-entry focus ring inside the designed box", () => {
    expect(studioFoundationHits(file, fixed.replace(".ad-code-box:focus { border:2px solid var(--ring);outline:0; }", ""))).toEqual([{ line: 1, reason: "studio-code-focus-stays-inside-designed-box" }])
  })
  it("rejects the text plus and heavy New deck button", () => {
    const workspace = "apps/studio/src/decks/workspace.tsx"
    const source = readFileSync(workspace, "utf8")
    expect(studioFoundationHits(workspace, source.replace('<Icon name="plus"/>New deck', '+ New deck'))).toEqual([{ line: 1, reason: "studio-new-deck-uses-shared-plus-icon" }])
    const styles = "apps/studio/src/editor/workspace.css"
    const css = readFileSync(styles, "utf8")
    expect(studioFoundationHits(styles, css)).toEqual([])
    expect(studioFoundationHits(styles, css.replace("font-size:14px;font-weight:500", "font-size:14px;font-weight:600"))).toEqual([{ line: 1, reason: "studio-new-deck-uses-medium-signature-button-weight" }])
  })
  it("preserves the access header when focusing the code on a phone", () => {
    const code = "packages/ui/src/code-entry/code-entry.tsx"
    const source = readFileSync(code, "utf8")
    expect(studioFoundationHits(code, source)).toEqual([])
    expect(studioFoundationHits(code, source.replace("focus({ preventScroll: true })", "focus()"))).toEqual([{ line: 1, reason: "studio-code-entry-initial-focus-preserves-access-header" }])
  })
  it("rejects the overridden check-email spacing", () => {
    expect(studioFoundationHits(file, fixed.replace(".ad-sign-in .ad-check-card {", ".ad-check-card {"))).toEqual([{ line: 1, reason: "studio-access-cards-match-reference-width-field-height-and-row-gaps" }])
  })
  it("rejects the undersized access cards", () => {
    const drift = fixed.replace("width:min(442px,100%);padding:40px", "width:min(440px,100%);padding:40px").replace("row-gap:22px", "row-gap:20px")
    expect(studioFoundationHits(file, drift)).toEqual([{ line: 1, reason: "studio-access-cards-match-reference-width-field-height-and-row-gaps" }])
  })
  it("rejects the oversized gap between dialog title and body", () => {
    expect(studioFoundationHits(file, fixed.replace(".ad-dialog-copy { display:grid;gap:8px; }", ".ad-dialog-copy { display:grid;gap:16px; }"))).toEqual([{ line: 1, reason: "studio-dialog-groups-title-and-body-with-8px-gap" }])
  })
  it("keeps the check-email return action secondary", () => {
    expect(studioFoundationHits(file, fixed.replace('.ad-sign-in[data-screen="check"]>.ad-button-link { color:var(--muted-foreground);font-size:var(--text-body-small);display:inline-flex;align-items:center;gap:6px; }', ""))).toEqual([{ line: 1, reason: "studio-check-email-back-link-uses-secondary-body-size" }])
  })
  it("requires the canonical permanent-deletion dialog copy", () => {
    const workspace = "apps/studio/src/decks/workspace.tsx"
    const source = readFileSync(workspace, "utf8")
    expect(studioFoundationHits(workspace, source)).toEqual([])
    expect(studioFoundationHits(workspace, source.replace('copy("trash.empty_body")', '"All decks will be deleted"'))).toEqual([{ line: 1, reason: "studio-trash-dialog-requires-canonical-trash.empty_body" }])
  })
  it("rejects the original off-design primary colors and accepts the design", () => {
    const original = fixed.replace("--primary: #4d94fb", "--primary: #2d6fcd").replace("--primary-top: #93b8ef", "--primary-top: #3e6fbe")
    expect(studioFoundationHits(file, original).map(hit => hit.reason)).toEqual(["studio-design-token-primary-must-be-#4d94fb", "studio-design-token-primary-top-must-be-#93b8ef"])
    expect(studioFoundationHits(file, fixed)).toEqual([])
  })
  it("rejects missing medium font and ad hoc motion values", () => {
    const drift = fixed.replace("fonts/geist-latin-500.woff2", "fonts/missing.woff2").replace("--motion-micro: 150ms", "--motion-micro: 300ms")
    expect(studioFoundationHits(file, drift).map(hit => hit.reason)).toEqual(["studio-type-requires-self-hosted-geist-500", "studio-motion-requires-motion-micro-token"])
  })
  it("rejects oversized sidebar search and displaced account chevron", () => {
    const drift = fixed.replace("background:var(--background);font-size:var(--text-body-small)", "background:var(--background)").replace("padding:0 12px", "padding:8px 12px").replace(".ad-account summary>svg {", ".ad-account summary>svg { margin-left:auto;")
    expect(studioFoundationHits(file, drift).map(hit => hit.reason)).toEqual(["studio-sidebar-uses-design-body-size-13px", "studio-search-padding-must-fit-36px-height", "studio-account-chevron-follows-account-name"])
  })
  it("rejects the original content-box sizing that overflowed phone access cards", () => {
    expect(studioFoundationHits(file, fixed.replace("box-sizing: border-box", "box-sizing: content-box"))).toContainEqual({ line: 1, reason: "studio-card-and-dialog-padding-requires-border-box-reset" })
  })
})

describe("shell semantics", () => {
  it("rejects button navigation and an extra tooltip tab stop", () => {
    const file = "packages/ui/src/primitives/primitives.tsx"
    const fixed = readFileSync(file, "utf8")
    expect(studioFoundationHits(file, fixed)).toEqual([])
    const original = fixed.replace('<a href={href} className="ad-nav-item"', '<button className="ad-nav-item"').replace('<span className="ad-tooltip"', '<span className="ad-tooltip" tabIndex={0}')
    expect(studioFoundationHits(file, original).map(hit => hit.reason)).toEqual(["studio-navigation-requires-native-links", "studio-tooltip-must-not-add-tab-stop"])
  })
})
