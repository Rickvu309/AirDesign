export const stamps: { readonly row: number; readonly index: number; readonly command: number } = {
  row: 0,
  index: 0,
  command: 0,
}

export const format: number = 1 + stamps.row + stamps.index + stamps.command

export function formatOf(raw: unknown): number {
  if (typeof raw !== "object" || raw === null || !("format" in raw)) return 1
  const stored = raw.format
  return typeof stored === "number" && Number.isSafeInteger(stored) && stored >= 1 ? stored : 1
}

export function newerFormat(raw: unknown): boolean {
  return formatOf(raw) > format
}
