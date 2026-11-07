import { readFileSync } from "node:fs"

const designCopyKeys = new Set(Object.entries(JSON.parse(readFileSync("docs/design/v0.1/copy-kit.json", "utf8"))).filter(([, value]) => typeof value === "string").map(([key]) => key))

export function studioFoundationHits(file: string, source: string): { line: number; reason: string }[] {
  if (file.endsWith("packages/ui/src/primitives/primitives.tsx")) {
    const hits = []
    if (/export function Icon\b|const paths\b/.test(source)) hits.push({ line: 1, reason: "studio-icons-use-the-shared-icon-module" })
    if (/export function NavItem[\s\S]*?return <button/.test(source.split("export function Dropdown")[0] ?? "")) hits.push({ line: 1, reason: "studio-navigation-requires-native-links" })
    if (/<span className="ad-tooltip"[^>]*tabIndex/.test(source)) hits.push({ line: 1, reason: "studio-tooltip-must-not-add-tab-stop" })
    return hits
  }
  if (/bench\/.*\.mjs$/.test(file)) {
    const hits = []
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
    if (!source.includes('<Icon name="plus"/>New deck')) hits.push({ line: 1, reason: "studio-new-deck-uses-shared-plus-icon" })
    return hits
  }
  if (file.endsWith("apps/studio/src/editor/workspace.css")) return /\.ad-shell \.home-new-deck>summary\s*\{[^}]*font-weight:500/.test(source) ? [] : [{ line: 1, reason: "studio-new-deck-uses-medium-signature-button-weight" }]
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
