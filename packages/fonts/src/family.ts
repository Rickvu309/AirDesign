import twins from "./twins.json" with { type: "json" }

export const fontRoutes = {
  family: { path: "/fonts/family" },
  file: { path: "/fonts/file" },
} as const

const quote = (font: string) => `"${font.replace(/["\\]/g, "\\$&")}"`

export function fontFamily(font: string | null): string {
  if (font === null) return "var(--font-sans)"
  const twin = twins.find((twin) => twin.family.toLowerCase() === font.toLowerCase())?.prefer
  return [quote(font), ...(twin === undefined ? [] : [quote(twin)]), "var(--font-sans)"].join(", ")
}
