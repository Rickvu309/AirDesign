export const insertParts = ["number", "text", "shape", "image", "icon"] as const

export const formatParts = ["styles", "size", "color", "align", "bullets"] as const

export const actionParts = ["actions"] as const

export type InsertPart = (typeof insertParts)[number]

export type FormatPart = (typeof formatParts)[number]

export type ActionPart = (typeof actionParts)[number]

export type ToolbarPart = InsertPart | FormatPart | ActionPart

export const foldOrder: readonly ToolbarPart[] = [
  "icon",
  "image",
  "shape",
  "number",
  "text",
  "actions",
  "bullets",
  "align",
  "color",
  "size",
  "styles",
]

export type ToolbarFold = { readonly row: readonly ToolbarPart[]; readonly more: readonly ToolbarPart[] }

export function toolbarFold(present: readonly ToolbarPart[], fold: number): ToolbarFold {
  const folded = new Set(foldOrder.filter((part) => present.includes(part)).slice(0, fold))
  return {
    row: present.filter((part) => !folded.has(part)),
    more: present.filter((part) => folded.has(part)),
  }
}
