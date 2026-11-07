export function studioFoundationHits(file: string, source: string): { line: number; reason: string }[] {
  if (!file.endsWith("packages/ui/src/tokens/tokens.css")) return []
  const hits: { line: number; reason: string }[] = []
  const colors = { primary: "#4d94fb", "primary-top": "#93b8ef", "primary-edge": "#2d6fcd", "muted-foreground": "#666666", destructive: "#d93f3f", background: "#f5f5f2", foreground: "#222222", card: "#ffffff", border: "#eaeae7", input: "#d7d7d6", link: "#2d6fcd", "secondary-strong": "#444444", hint: "#909090", "destructive-top": "#f29a9a", "destructive-edge": "#b92f2f", "destructive-tint": "#fdf0f0", "expired-top": "#d9d9d7", "expired-bottom": "#a8a8a6", "violet-soft": "#b9a8ff" }
  for (const [token, value] of Object.entries(colors)) {
    if (!source.toLowerCase().includes(`--${token}: ${value}`)) hits.push({ line: 1, reason: `studio-design-token-${token}-must-be-${value}` })
  }
  if (!/\*\s*,\s*\*::before\s*,\s*\*::after\s*\{[^}]*box-sizing:\s*border-box/.test(source)) hits.push({ line: 1, reason: "studio-card-and-dialog-padding-requires-border-box-reset" })
  return hits
}
