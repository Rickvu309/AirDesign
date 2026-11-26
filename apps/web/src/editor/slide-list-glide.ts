export type RowGlide = number | "new"

export const slideRows = "[data-slide-item]"

export function slideGlides(before: readonly string[], after: readonly string[]): RowGlide[] | null {
  const was = new Map(before.map((id, index) => [id, index]))
  if (!after.some((id) => was.has(id))) return null
  const glides = after.map((id, index): RowGlide => {
    const from = was.get(id)
    return from === undefined ? "new" : from - index
  })
  return glides.every((glide) => glide === 0) ? null : glides
}

export function rowPitch(list: HTMLElement, rows: readonly HTMLElement[]): number {
  const [first, second] = rows.map((row) => row.parentElement)
  if (first === null || first === undefined) return 0
  if (second !== null && second !== undefined) return second.offsetTop - first.offsetTop
  return first.offsetHeight + (Number.parseFloat(getComputedStyle(list).rowGap) || 0)
}

function carried(row: HTMLElement): number {
  return row.getBoundingClientRect().top - (row.parentElement?.getBoundingClientRect().top ?? 0)
}

export function glideRows(list: HTMLElement, glides: readonly RowGlide[] | null): void {
  const rows = [...list.querySelectorAll<HTMLElement>(slideRows)]
  const pitch = rowPitch(list, rows)
  const starts = rows.map((row, index) => {
    const glide = glides?.[index] ?? 0
    return glide === "new" ? glide : glide * pitch + carried(row)
  })
  rows.forEach((row, index) => {
    const start = starts[index] ?? 0
    row.style.transition = "none"
    row.style.transform =
      start === "new" ? "scale(0.96)" : Math.abs(start) > 0.5 ? `translateY(${String(start)}px)` : ""
    row.style.opacity = start === "new" ? "0" : ""
  })
  void list.offsetHeight
  for (const row of rows) {
    row.style.transition = ""
    row.style.transform = ""
    row.style.opacity = ""
  }
}
