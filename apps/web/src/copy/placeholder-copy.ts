export const placeholderPrompts: Readonly<Record<string, string>> = {
  title: "Add a title",
  ctrTitle: "Add a title",
  subTitle: "Add a subtitle",
  body: "Add text",
  obj: "Add text",
  secHead: "Add a title",
  dt: "Add date",
  ftr: "Add footer",
  hdr: "Add header",
  sldNum: "Add slide number",
}

export function fallbackPrompt(type: string | null | undefined): string | null {
  if (type === null || type === undefined) return "Add text"
  return placeholderPrompts[type] ?? null
}
