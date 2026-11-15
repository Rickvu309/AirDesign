export const placeholderPrompts: Readonly<Record<string, string>> = {
  title: "Click to add title",
  ctrTitle: "Click to add title",
  subTitle: "Click to add subtitle",
  body: "Click to add text",
  obj: "Click to add text",
  secHead: "Click to add title",
  dt: "Add date",
  ftr: "Add footer",
  hdr: "Add header",
  sldNum: "Add slide number",
}

export function fallbackPrompt(type: string | null | undefined): string | null {
  if (type === null || type === undefined) return "Click to add text"
  return placeholderPrompts[type] ?? null
}
