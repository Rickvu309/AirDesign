export function studioFoundationHits(file: string, source: string): { line: number; reason: string }[] {
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
  if (!source.includes(".ad-code-box:focus { border:2px solid var(--ring);outline:0; }")) hits.push({ line: 1, reason: "studio-code-focus-stays-inside-designed-box" })
  if (!source.includes('.ad-sign-in[data-screen="check"]>.ad-button-link { color:var(--muted-foreground);font-size:var(--text-body-small);display:inline-flex;align-items:center;gap:6px; }')) hits.push({ line: 1, reason: "studio-check-email-back-link-uses-secondary-body-size" })
  if (!/\.ad-sidebar\s*\{[^}]*font-size:\s*var\(--text-body-small\)/.test(source)) hits.push({ line: 1, reason: "studio-sidebar-uses-design-body-size-13px" })
  if (!/\.ad-search\s*\{[^}]*padding:\s*0 12px/.test(source)) hits.push({ line: 1, reason: "studio-search-padding-must-fit-36px-height" })
  if (/\.ad-account summary>svg\s*\{[^}]*margin-left:\s*auto/.test(source)) hits.push({ line: 1, reason: "studio-account-chevron-follows-account-name" })
  return hits
}
