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

function numberOf(row: HTMLElement): HTMLElement | null {
  return row.querySelector<HTMLElement>("[data-slide-number]")
}

export function shiftRow(row: HTMLElement, by: number): void {
  const number = numberOf(row)
  row.style.transform = by === 0 ? "" : `translateY(${String(by)}px)`
  if (number !== null) number.style.transform = by === 0 ? "" : `translateY(${String(-by)}px)`
}

export function glideRows(list: HTMLElement, glides: readonly RowGlide[] | null): void {
  const rows = [...list.querySelectorAll<HTMLElement>(slideRows)]
  const pitch = rowPitch(list, rows)
  const starts = rows.map((row, index) => {
    const glide = glides?.[index] ?? 0
    return glide === "new" ? glide : glide * pitch + carried(row)
  })
  const parts = rows.flatMap((row) => [row, numberOf(row) ?? []].flat())
  for (const part of parts) part.style.transition = "none"
  rows.forEach((row, index) => {
    const start = starts[index] ?? 0
    shiftRow(row, start === "new" || Math.abs(start) <= 0.5 ? 0 : start)
    if (start !== "new") return
    row.style.transform = "scale(0.96)"
    row.style.opacity = "0"
  })
  void list.offsetHeight
  for (const part of parts) {
    part.style.transition = ""
    part.style.transform = ""
    part.style.opacity = ""
  }
}
