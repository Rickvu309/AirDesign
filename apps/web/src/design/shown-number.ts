export type Shown = { readonly text: string; readonly exact: number | null }

export function roundedShown(exact: number | null | undefined, places: number): Shown {
  if (exact === null || exact === undefined || !Number.isFinite(exact)) return { text: "", exact: null }
  const unit = 10 ** places
  return { text: String(Math.round(exact * unit) / unit), exact }
}

export const untouched = (text: string, shown: Shown): boolean => text.trim() === shown.text

export function steppedFrom(text: string, shown: Shown, read: (text: string) => number | null): number {
  if (untouched(text, shown) && shown.exact !== null) return shown.exact
  return read(text) ?? 0
}
