import { readFileSync } from "node:fs"

const designCopyValues = new Set(Object.values(JSON.parse(readFileSync("docs/design/v0.1/copy-kit.json", "utf8"))).filter(value => typeof value === "string"))
const designCopyKeys = new Set(Object.entries(JSON.parse(readFileSync("docs/design/v0.1/copy-kit.json", "utf8"))).filter(([, value]) => typeof value === "string").map(([key]) => key))

export function studioFoundationHits(file: string, source: string): { line: number; reason: string }[] {
  if (file.endsWith("bench/design-parity/dom-assertions.ts")) {
    return /stroke-width=["']\d|part\.width\s*!==\s*["']\d/.test(source) ? [{ line: 1, reason: "canonical-icon-stroke-must-use-source-owned-width" }] : []
  }
  if (file.endsWith("packages/ui/src/icon/icon.tsx")) {
    return /strokeWidth=\{[^}]*["']?\d/.test(source) ? [{ line: 1, reason: "canonical-icon-stroke-must-use-source-owned-width" }] : []
  }
  if (file.endsWith("packages/ui/src/copy/studio-foundation-copy.ts")) {
    return [...source.matchAll(/^\s*"([^"]+)":\s*"([^"]+)"/gm)].filter(match => designCopyKeys.has(match[1] ?? "") || designCopyValues.has(match[2] ?? "")).map(match => ({ line: source.slice(0, match.index).split("\n").length, reason: "studio-supplemental-copy-must-not-duplicate-canonical-copy" }))
  }
  if (file.endsWith("packages/ui/src/primitives/primitives.tsx")) {
    const hits = []
    if (/export function Icon\b|const paths\b/.test(source)) hits.push({ line: 1, reason: "studio-icons-use-the-shared-icon-module" })
    if (/export function NavItem[\s\S]*?return <button/.test(source.split("export function Dropdown")[0] ?? "")) hits.push({ line: 1, reason: "studio-navigation-requires-native-links" })
    if (/<span className="ad-tooltip"[^>]*tabIndex/.test(source)) hits.push({ line: 1, reason: "studio-tooltip-must-not-add-tab-stop" })
    return hits
  }
  if (file.endsWith("packages/ui/src/toast/toaster.tsx")) return source.includes("mobileOffset=") && ["top","left","right","bottom"].every(edge=>source.includes(`env(safe-area-inset-${edge})`)) ? [] : [{line:1,reason:"studio-toasts-must-respect-phone-safe-areas"}]
  if (file.endsWith("apps/studio/src/decks/decks.css")) {
    const hits=[]
    if (/\.workspace-home \.deck-card-details p(?:\s*[,{])/.test(source) || !source.includes('.workspace-home .deck-card-details .import-filename { display:block;margin:0;font-size:var(--text-body);color:var(--foreground);')) hits.push({line:1,reason:"studio-import-filename-keeps-card-title-typography"})
    if (!source.includes('.workspace-home .import-card { position:relative;') || !source.includes('.import-diagnostics,.import-cancel { position:absolute;')) hits.push({line:1,reason:"studio-import-recovery-controls-stay-within-card-height"})
    if (!source.includes('.import-diagnostics pre { position:absolute;') || !source.includes('.import-diagnostics>summary { min-inline-size:44px;min-block-size:44px;')) hits.push({line:1,reason:"studio-import-details-preserve-header-and-touch-target"})
    if (!source.includes('.home-new-deck .ad-menu { min-inline-size:179px;inset-block-start:calc(100% + 4px);inset-inline-start:auto;inset-inline-end:0;padding:3px;font-size:var(--text-body-small); }') || !source.includes('gap:8px;padding:6px 8px;line-height:20px;')) hits.push({line:1,reason:"studio-new-deck-menu-aligns-with-trigger-and-reference-row-spacing"})
    const newDeck=source.match(/\.home-new-deck \.ad-dropdown>summary\s*\{([^}]*)\}/)?.[1] ?? ""
    if (!newDeck.includes("font-weight:500")) hits.push({line:1,reason:"studio-new-deck-uses-medium-signature-button-weight"})
    if (!newDeck.includes("background:linear-gradient(var(--primary-top),var(--primary))")) hits.push({line:1,reason:"studio-new-deck-paints-the-design-primary-gradient"})
    if (!source.includes('.deck-starter .deck-preview { block-size:var(--deck-preview-height); }')) hits.push({line:1,reason:"studio-deck-starter-previews-need-intrinsic-height"})
    if (!source.includes('line-height:44px;overflow:hidden;text-overflow:ellipsis;')) hits.push({line:1,reason:"studio-touch-deck-title-links-truncate-inside-their-tap-target"})
    if (!source.includes('minmax(min(100%,320px),1fr)')) hits.push({line:1,reason:"studio-deck-grid-keeps-three-columns-at-1440"})
    if (!source.includes('.workspace-home .deck-cover { display:block;inline-size:100%;aspect-ratio:auto;')) hits.push({line:1,reason:"studio-deck-covers-fill-card-without-inherited-aspect-sizing"})
    if (!source.includes('.deck-card:has(.ad-dropdown[open]) { z-index:2; }') || !source.includes('gap:0;flex-wrap:nowrap;z-index:1;') || !source.includes('min-inline-size:160px;inset-inline-start:auto;inset-inline-end:0;')) hits.push({line:1,reason:"studio-deck-menus-must-fit-and-overlay-card-previews"})
    if (/font-size:(?:12|13|14)px|border-radius:(?:8|12|16)px/.test(source)) hits.push({line:1,reason:"studio-decks-reuse-shared-type-and-radius-tokens"})
    if (!source.includes("@media (pointer: coarse)") || !source.includes("@media (hover: hover) and (pointer: fine)") || !source.includes("min-inline-size:44px;min-block-size:44px") || !source.includes(".workspace-home .deck-list .deck-cover { min-block-size:44px;") || !source.includes("[data-sonner-toast] button")) hits.push({line:1,reason:"studio-deck-and-undo-controls-require-touch-targets-and-pointer-scoped-hover"})
    if (!source.includes("[data-sonner-toaster] { left:calc(50% + 124px);") || !source.includes("[data-button] { background:transparent;color:inherit;")) hits.push({line:1,reason:"studio-deck-toast-must-center-over-content-with-plain-undo-action"})
    return hits
  }
  if (/bench\/.*\.mjs$/.test(file)) {
    const hits = []
    if (source.includes('locator(".deck-card").waitFor()')) hits.push({line:1,reason:"studio-browser-waits-for-persisted-deck-rows"})
    if (source.includes('getByLabel("New deck"')) hits.push({line:1,reason:"studio-browser-opens-deck-menu-by-button-role"})
    for (const match of source.matchAll(/name\s*:\s*["'](?:\+ New deck|No decks yet)["']|getByLabel\(["']Search decks["']\)/g)) hits.push({ line: source.slice(0, match.index).split("\n").length, reason: "studio-browser-check-uses-designed-shell-accessible-names" })
    return hits
  }
  if (/packages\/ui\/src\/copy\/copy-kit\.(json|ts)$/.test(file)) {
    const keys = file.endsWith(".json") ? Object.entries(JSON.parse(source)).filter(([, value]) => typeof value === "string").map(([key]) => key) : [...source.matchAll(/^\s*"([^"]+)":\s*"/gm)].map(match => match[1] ?? "")
    return keys.filter(key => !designCopyKeys.has(key)).map(key => ({ line: source.slice(0, source.indexOf(`"${key}"`)).split("\n").length, reason: "studio-supplemental-copy-belongs-in-studio-foundation-copy" }))
  }
  if (file.endsWith("packages/ui/src/code-entry/code-entry.tsx")) return source.includes("refs.current[0]?.focus({ preventScroll: true })") ? [] : [{ line: 1, reason: "studio-code-entry-initial-focus-preserves-access-header" }]
  if (file.endsWith("apps/studio/src/decks/workspace.tsx")) {
    const hits = ["trash.empty_title", "trash.empty_body", "trash.empty_action"].filter(key => !source.includes(`${key === "trash.empty_title" ? "fillCopy" : "copy"}("${key}"`)).map(key => ({ line: 1, reason: `studio-trash-dialog-requires-canonical-${key}` }))
    if (source.includes("localeCompare")) hits.push({line:1,reason:"studio-decks-must-sort-by-last-edit"})
    if (!source.includes("<DeckPreview entry={entry}/>")) hits.push({line:1,reason:"studio-deck-covers-require-real-slide-previews"})
    if (!["Name","Edited","Created"].every(label=>source.includes(`${label}<Icon name="chevron"/>`))) hits.push({line:1,reason:"studio-deck-list-headings-use-designed-chevrons"})
    if (!source.includes('<Icon name="plus"/>New deck')) hits.push({ line: 1, reason: "studio-new-deck-uses-shared-plus-icon" })
    return hits
  }
  if (file.endsWith("apps/studio/src/editor/workspace.css")) {
    const hits=[]
    if (/@media\s*\(hover:\s*hover\)\s*\{/.test(source)) hits.push({line:1,reason:"studio-deck-hover-requires-a-fine-pointer"})
    return hits
  }
  if (!file.endsWith("packages/ui/src/tokens/tokens.css")) return []
  const hits: { line: number; reason: string }[] = []
  const colors = { accent: "#eef4fe", primary: "#4d94fb", "primary-top": "#93b8ef", "primary-edge": "#2d6fcd", "muted-foreground": "#666666", destructive: "#d93f3f", background: "#f5f5f2", foreground: "#222222", card: "#ffffff", border: "#eaeae7", input: "#d7d7d6", link: "#2d6fcd", "secondary-strong": "#444444", hint: "#909090", "destructive-top": "#f29a9a", "destructive-edge": "#b92f2f", "destructive-tint": "#fdf0f0", "expired-top": "#d9d9d7", "expired-bottom": "#a8a8a6", "violet-soft": "#b9a8ff" }
  for (const [token, value] of Object.entries(colors)) {
    if (!source.toLowerCase().includes(`--${token}: ${value}`)) hits.push({ line: 1, reason: `studio-design-token-${token}-must-be-${value}` })
  }
  if (!/\*\s*,\s*\*::before\s*,\s*\*::after\s*\{[^}]*box-sizing:\s*border-box/.test(source)) hits.push({ line: 1, reason: "studio-card-and-dialog-padding-requires-border-box-reset" })
  for (const weight of [400, 500, 600]) {
    if (!source.includes(`fonts/geist-latin-${weight}.woff2`)) hits.push({ line: 1, reason: `studio-type-requires-self-hosted-geist-${weight}` })
  }
  for (const [token, value] of Object.entries({ "motion-micro": "150ms cubic-bezier(0.22, 1, 0.36, 1)", "motion-panel": "280ms cubic-bezier(0.32, 0.72, 0, 1)" })) {
    if (!source.includes(`--${token}: ${value}`)) hits.push({ line: 1, reason: `studio-motion-requires-${token}-token` })
  }
  if (!source.includes("width:min(442px,100%);padding:40px") || !source.includes('.ad-sign-in[data-screen="signin"] .ad-field-input { height:46px; }') || !source.includes(".ad-sign-in .ad-check-card { text-align:center;justify-items:center;row-gap:22px; }")) hits.push({ line: 1, reason: "studio-access-cards-match-reference-width-field-height-and-row-gaps" })
  if (!source.includes(".ad-dialog-copy { display:grid;gap:8px; }")) hits.push({ line: 1, reason: "studio-dialog-groups-title-and-body-with-8px-gap" })
  if (!source.includes(".ad-access-error { display:flex;width:min(360px,100%);flex-direction:column;align-items:center;gap:20px; }") || !source.includes(".ad-access-error .ad-brand-mark { width:44px;height:44px; }") || !source.includes(".ad-access-error-copy { display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center; }") || !source.includes('font-size:var(--text-module);font-weight:500;letter-spacing:normal;line-height:normal;')) hits.push({ line: 1, reason: "studio-expired-link-uses-generator-mark-spacing-and-medium-title" })
  if (!source.includes(".ad-field-input,.ad-search input,.ad-code-box { font-size:16px; }") || !source.includes("@media (pointer: coarse)") || !source.includes('.ad-access-legal a,[role="button"] { min-width:44px;min-height:44px; }') || !source.includes("touch-action:manipulation;-webkit-tap-highlight-color:transparent;") || !source.includes("@media (hover: hover) and (pointer: fine)") || !source.includes("env(safe-area-inset-bottom, 0px)")) hits.push({ line: 1, reason: "studio-touch-controls-require-readable-inputs-targets-and-safe-area" })
  if (!source.includes(".ad-code-box:focus { border:2px solid var(--ring);outline:0; }")) hits.push({ line: 1, reason: "studio-code-focus-stays-inside-designed-box" })
  if (!source.includes('.ad-sign-in[data-screen="check"]>.ad-button-link { color:var(--muted-foreground);font-size:var(--text-body-small);display:inline-flex;align-items:center;gap:6px; }')) hits.push({ line: 1, reason: "studio-check-email-back-link-uses-secondary-body-size" })
  if (!/\.ad-sidebar\s*\{[^}]*font-size:\s*var\(--text-body-small\)/.test(source)) hits.push({ line: 1, reason: "studio-sidebar-uses-design-body-size-13px" })
  if (!/\.ad-search\s*\{[^}]*padding:\s*0 12px/.test(source)) hits.push({ line: 1, reason: "studio-search-padding-must-fit-36px-height" })
  if (/\.ad-account summary>svg\s*\{[^}]*margin-left:\s*auto/.test(source)) hits.push({ line: 1, reason: "studio-account-chevron-follows-account-name" })
  return hits
}
