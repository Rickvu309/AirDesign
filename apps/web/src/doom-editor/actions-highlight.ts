export type ActionsLayout = {
  readonly rows: number
  readonly icons: number
  readonly columns: number
}

export type HighlightKey = "ArrowDown" | "ArrowUp" | "ArrowLeft" | "ArrowRight"

export function stepHighlight(layout: ActionsLayout, now: number | null, key: HighlightKey): number | null {
  const last = layout.rows + layout.icons - 1
  if (last < 0) return null
  const icon = now === null ? -1 : now - layout.rows
  if (key === "ArrowLeft" || key === "ArrowRight") {
    if (now === null || icon < 0) return null
    const column = icon % layout.columns
    if (key === "ArrowLeft") return column === 0 ? now : now - 1
    return column === layout.columns - 1 || now === last ? now : now + 1
  }
  if (now === null) return 0
  if (icon < 0) return key === "ArrowDown" ? now + 1 : Math.max(0, now - 1)
  const row = Math.floor(icon / layout.columns)
  if (key === "ArrowUp") return row > 0 ? now - layout.columns : layout.rows > 0 ? layout.rows - 1 : now
  return row < Math.floor((layout.icons - 1) / layout.columns) ? Math.min(last, now + layout.columns) : now
}
