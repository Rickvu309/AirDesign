import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { studioFoundationHits } from "../../scripts/lint/studio-foundation.ts"

const file = "packages/ui/src/tokens/tokens.css"
const fixed = readFileSync(file, "utf8")
describe("Studio design foundation", () => {
  it("rejects retired Editor journey controls",()=>{
    const file="bench/studio/browser-check.mjs",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    for(const stale of [source.replace('name:"New slide"','name:"+ New slide"'),source.replace('name:"Edit history"','name:"Deck menu"')])expect(studioFoundationHits(file,stale)).toContainEqual({line:1,reason:"studio-browser-uses-current-slide-and-history-controls"})
  })
  it("rejects a release replay without observable font and preservation proof",()=>{
    const file="bench/release/replay.mjs",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    for(const stale of [source.replace('assertFontChange(before,saved.deck,["s0e0"])','assert.equal(saved.deck.slides[0].elements[0].runs[0].text,request)'),source.replace("fontDeck(id,1)","fixtureDeck(2,1)")])expect(studioFoundationHits(file,stale)).toContainEqual({line:1,reason:"release-replay-proves-font-mutation-and-content-preservation"})
  })
  it("rejects canonical keys and values in supplemental copy", () => {
    const supplemental = "packages/ui/src/copy/studio-foundation-copy.ts"
    expect(studioFoundationHits(supplemental, readFileSync(supplemental, "utf8"))).toEqual([])
    for (const source of ['  "access.continue_email": "Other",', '  "other.key": "Recents",']) {
      expect(studioFoundationHits(supplemental, source)).toEqual([{ line: 1, reason: "studio-supplemental-copy-must-not-duplicate-canonical-copy" }])
    }
  })

  it("rejects a second shell icon implementation and accepts shared icons", () => {
    const icons = "packages/ui/src/primitives/primitives.tsx"
    expect(studioFoundationHits(icons, readFileSync(icons, "utf8"))).toEqual([])
    expect(studioFoundationHits(icons, "export function Icon() {} const paths = {}"))
      .toEqual([{ line: 1, reason: "studio-icons-use-the-shared-icon-module" }])
  })
  it("rejects the metadata selector overriding import filename typography",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    expect(studioFoundationHits(file,source.replace(".deck-card-details p:not(.import-filename)",".deck-card-details p"))).toEqual([{line:1,reason:"studio-import-filename-keeps-card-title-typography"}])
  })
  it("rejects inherited gray import filenames",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source.replace("font-size:var(--text-body);color:var(--foreground);","font-size:var(--text-body);"))).toEqual([{line:1,reason:"studio-import-filename-keeps-card-title-typography"}])
  })
  it("rejects diagnostics shifting the filename or undersized touch targets",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    for(const original of [source.replace(".import-diagnostics pre { position:absolute;",".import-diagnostics pre { position:static;"),source.replace(".import-diagnostics>summary { min-inline-size:44px;min-block-size:44px;",".import-diagnostics>summary { min-block-size:44px;")]) expect(studioFoundationHits(file,original)).toEqual([{line:1,reason:"studio-import-details-preserve-header-and-touch-target"}])
  })
  it("rejects recovery controls adding a row to the import card",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    expect(studioFoundationHits(file,source.replace('.import-diagnostics,.import-cancel { position:absolute;','.import-diagnostics,.import-cancel { position:static;'))).toEqual([{line:1,reason:"studio-import-recovery-controls-stay-within-card-height"}])
  })
  it("rejects the inherited start-aligned and oversized New deck menu",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    const original=source.replace('.home-new-deck .ad-menu { min-inline-size:179px;inset-block-start:calc(100% + 4px);inset-inline-start:auto;inset-inline-end:0;padding:3px;font-size:var(--text-body-small); }','.home-new-deck .ad-menu { min-inline-size:179px; }').replace('gap:8px;padding:6px 8px;line-height:20px;','gap:8px;')
    expect(studioFoundationHits(file,original)).toEqual([{line:1,reason:"studio-new-deck-menu-aligns-with-trigger-and-reference-row-spacing"}])
  })
  it("rejects starter previews that collapse or overlap the next card",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    expect(studioFoundationHits(file,source.replace('.deck-starter .deck-preview { block-size:var(--deck-preview-height); }',""))).toEqual([{line:1,reason:"studio-deck-starter-previews-need-intrinsic-height"}])
  })
  it("rejects card menus that overflow the phone or sit behind native previews",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    for(const rule of ['.workspace-home .deck-card:has(.ad-dropdown[open]) { z-index:2; }','z-index:1;','.deck-card-actions .ad-menu { z-index:20;min-inline-size:160px;inset-inline-start:auto;inset-inline-end:0; }'])expect(studioFoundationHits(file,source.replace(rule,""))).toEqual([{line:1,reason:"studio-deck-menus-must-fit-and-overlay-card-previews"}])
  })
  it("rejects treating the New deck summary as the menu container",()=>{
    for(const file of ["bench/import-export/browser-check.mjs","bench/templates-images/live.mjs"]){
      const source=readFileSync(file,"utf8")
      expect(studioFoundationHits(file,source)).toEqual([])
      expect(studioFoundationHits(file,source.replace('page.getByRole("button",{name:"Import PowerPoint",exact:true})','page.getByLabel("New deck",{exact:true}).getByRole("button",{name:"Import PowerPoint",exact:true})'))).toEqual([{line:1,reason:"studio-browser-opens-deck-menu-by-button-role"}])
    }
  })
  it("rejects ambiguous waits that include both starter cards",()=>{
    for(const file of ["bench/studio/browser-check.mjs","bench/release/mobile-audit.mjs"]){
      const source=readFileSync(file,"utf8")
      expect(studioFoundationHits(file,source)).toEqual([])
      expect(studioFoundationHits(file,source.replace('locator("article.deck-card").waitFor()','locator(".deck-card").waitFor()'))).toEqual([{line:1,reason:"studio-browser-waits-for-persisted-deck-rows"}])
    }
  })
  it("rejects repeated Decks type and radius literals when shared tokens exist",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    for(const [token,literal] of [["font-size:var(--text-body-small)","font-size:13px"],["border-radius:var(--radius-card)","border-radius:12px"]] as const)expect(studioFoundationHits(file,source.replace(token,literal))).toContainEqual({line:1,reason:"studio-decks-reuse-shared-type-and-radius-tokens"})
  })
  it("rejects inherited aspect sizing that offsets and overflows deck covers",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    expect(studioFoundationHits(file,source.replace("inline-size:100%;aspect-ratio:auto;", ""))).toEqual([{line:1,reason:"studio-deck-covers-fill-card-without-inherited-aspect-sizing"}])
  })
  it("rejects touch title links that clip without an ellipsis",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    expect(studioFoundationHits(file,source.replace("line-height:44px;overflow:hidden;text-overflow:ellipsis;", ""))).toEqual([{line:1,reason:"studio-touch-deck-title-links-truncate-inside-their-tap-target"}])
  })
  it("rejects inherited card hover effects without a fine pointer",()=>{
    const file="apps/studio/src/editor/workspace.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    expect(studioFoundationHits(file,source.replace("@media (hover: hover) and (pointer: fine)","@media (hover:hover)"))).toEqual([{line:1,reason:"studio-deck-hover-requires-a-fine-pointer"}])
  })
  it("rejects a grid minimum that drops a column at the desktop checkpoint",()=>{
    const file="apps/studio/src/decks/decks.css",source=readFileSync(file,"utf8")
    expect(studioFoundationHits(file,source)).toEqual([])
    expect(studioFoundationHits(file,source.replace("min(100%,320px)","min(100%,354px)"))).toEqual([{line:1,reason:"studio-deck-grid-keeps-three-columns-at-1440"}])
  })
  it("rejects toasts outside phone safe areas and undersized Decks controls",()=>{
    const toaster="packages/ui/src/toast/toaster.tsx",toasterSource=readFileSync(toaster,"utf8"),decks="apps/studio/src/decks/decks.css",decksSource=readFileSync(decks,"utf8")
    expect(studioFoundationHits(toaster,toasterSource)).toEqual([])
    expect(studioFoundationHits(toaster,toasterSource.replace("env(safe-area-inset-top)","0px"))).toEqual([{line:1,reason:"studio-toasts-must-respect-phone-safe-areas"}])
    expect(studioFoundationHits(decks,decksSource)).toEqual([])
    expect(studioFoundationHits(decks,decksSource.replace("left:calc(50% + 124px)","left:50%").replace("[data-button] { background:transparent;color:inherit;","[data-button] {"))).toEqual([{line:1,reason:"studio-deck-toast-must-center-over-content-with-plain-undo-action"}])
    expect(studioFoundationHits(decks,decksSource.replaceAll("min-inline-size:44px;min-block-size:44px",""))).toEqual([{line:1,reason:"studio-import-details-preserve-header-and-touch-target"},{line:1,reason:"studio-deck-and-undo-controls-require-touch-targets-and-pointer-scoped-hover"}])
    expect(studioFoundationHits(decks,decksSource.replace(".workspace-home .deck-list .deck-cover { min-block-size:44px;",".workspace-home .deck-list .deck-cover {"))).toEqual([{line:1,reason:"studio-deck-and-undo-controls-require-touch-targets-and-pointer-scoped-hover"}])
  })
  it("rejects phone input zoom and undersized touch targets", () => {
    expect(studioFoundationHits(file, fixed.replace(".ad-field-input,.ad-search input,.ad-code-box { font-size:16px; }", "").replace("min-width:44px;min-height:44px;", ""))).toEqual([{ line: 1, reason: "studio-touch-controls-require-readable-inputs-targets-and-safe-area" }])
  })
  it("rejects obsolete shell browser locators and accepts the designed names", () => {
    const browser = "bench/studio/browser-check.mjs"
    const source = readFileSync(browser, "utf8")
    expect(studioFoundationHits(browser, source)).toEqual([])
    const original = source.replace('name:"Scratchpad Your first draft"', 'name:"No decks yet"').replace('name:"New deck"', 'name:"+ New deck"').replaceAll('getByRole("searchbox",{name:"Search",exact:true})', 'getByLabel("Search decks")')
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
    const styles = "apps/studio/src/decks/decks.css"
    const css = readFileSync(styles, "utf8")
    expect(studioFoundationHits(styles, css)).toEqual([])
    expect(studioFoundationHits(styles, css.replace("font-size:var(--text-body-small);font-weight:500", "font-size:var(--text-body-small);font-weight:600"))).toEqual([{ line: 1, reason: "studio-new-deck-uses-medium-signature-button-weight" }])
    expect(studioFoundationHits(styles, css.replace("padding:8px 16px;background:linear-gradient(var(--primary-top),var(--primary));", "padding:8px 16px;background:var(--signature-gradient);"))).toEqual([{ line: 1, reason: "studio-new-deck-paints-the-design-primary-gradient" }])
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

it("rejects alphabetical Decks ordering and invented title covers",()=>{
  const file="apps/studio/src/decks/workspace.tsx",source=readFileSync(file,"utf8")
  expect(studioFoundationHits(file,source)).toEqual([])
  expect(studioFoundationHits(file,source.replace('Name<Icon name="chevron"/>','Name'))).toEqual([{line:1,reason:"studio-deck-list-headings-use-designed-chevrons"}])
  expect(studioFoundationHits(file,source.replace("b.updated-a.updated","a.title.localeCompare(b.title)"))).toEqual([{line:1,reason:"studio-decks-must-sort-by-last-edit"}])
  expect(studioFoundationHits(file,source.replace("<DeckPreview entry={entry}/>","<strong>{entry.title}</strong>"))).toEqual([{line:1,reason:"studio-deck-covers-require-real-slide-previews"}])
})

it("rejects duplicated canonical stroke literals in renderer and both verifier consumers",()=>{
  const renderer="packages/ui/src/icon/icon.tsx",verifier="bench/design-parity/dom-assertions.ts"
  const currentRenderer=readFileSync(renderer,"utf8"),currentVerifier=readFileSync(verifier,"utf8")
  expect(studioFoundationHits(renderer,currentRenderer)).toEqual([])
  expect(studioFoundationHits(verifier,currentVerifier)).toEqual([])
  const reason=[{line:1,reason:"canonical-icon-stroke-must-use-source-owned-width"}]
  expect(studioFoundationHits(renderer,currentRenderer.replace("iconStrokeWidth(name)",'name === "undo" || name === "redo" ? "1.5" : "1.6"'))).toEqual(reason)
  expect(studioFoundationHits(verifier,currentVerifier.replace('stroke-width="${icon.strokeWidth}"','stroke-width="1.5"'))).toEqual(reason)
  expect(studioFoundationHits(verifier,currentVerifier.replace('part.width!==expectedStroke+"px"','part.width!=="1.5px"'))).toEqual(reason)
  expect(studioFoundationHits("negative-fixture.test.ts",'stroke-width="1.5"')).toEqual([])
})
