import { id, themeId, type ChangeSet, type Deck, type Element, type Slide } from "../../deck/src/index.ts"

export type LayoutFamily = { id: string; name: string; master: string | null; layouts: string[] }
export type Template = { id: string; version: number; name: string; font: string; background: string; foreground: string; accent: string; families: LayoutFamily[]; fontRight: "installed" | "missing" | "no-embedding" }
export type TemplateMode = { kind: "apply-deck" } | { kind: "insert-slide"; slideId: string; family: string }
export const basics: readonly Template[] = [
  { id: "light", version: 1, name: "Light slides", font: "Geist", background: "#ffffff", foreground: "#172333", accent: "#3e6fbe", families: [{ id: "basic", name: "Basic", master: null, layouts: ["Title and content", "Title", "Blank"] }], fontRight: "installed" },
  { id: "dark", version: 1, name: "Dark slides", font: "Geist", background: "#172333", foreground: "#ffffff", accent: "#b4ccea", families: [{ id: "basic", name: "Basic", master: null, layouts: ["Title and content", "Title", "Blank"] }], fontRight: "installed" },
]
export function parseTemplate(value: unknown): Template {
  if (!value || typeof value !== "object") throw new Error("invalid-template")
  const v = value as Record<string, unknown>
  if (typeof v.id !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(v.id) || !Number.isSafeInteger(v.version) || Number(v.version) < 1 || typeof v.name !== "string" || !v.name.trim() || v.name.length > 100 || typeof v.font !== "string" || !v.font.trim() || v.font.length > 100 || ![v.background,v.foreground,v.accent].every(c => typeof c === "string" && /^#[a-fA-F0-9]{6}$/.test(c)) || !["installed","missing","no-embedding"].includes(String(v.fontRight)) || !Array.isArray(v.families) || !v.families.length || v.families.length > 100) throw new Error("invalid-template")
  for (const family of v.families) {
    if (!family || typeof family !== "object" || typeof family.id !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(family.id) || typeof family.name !== "string" || !(family.master === null || typeof family.master === "string") || !Array.isArray(family.layouts) || !family.layouts.length || family.layouts.some((layout: unknown) => typeof layout !== "string" || layout.length > 200)) throw new Error("invalid-layout-family")
  }
  if (new Set(v.families.map(family => family.id)).size !== v.families.length) throw new Error("duplicate-layout-family")
  return structuredClone(v) as Template
}
export function applyTemplate(deck: Deck, template: Template, mode: TemplateMode, familyId = template.families[0]?.id, substitution?: "Geist"): { changes: ChangeSet; retained: string[]; warnings: string[] } {
  const family = template.families.find(family => family.id === (mode.kind === "insert-slide" ? mode.family : familyId))
  if (!family) throw new Error("layout-family-not-found")
  if (template.fontRight === "missing" && !substitution) throw new Error("choose-font-substitution")
  const font = substitution ?? template.font
  const theme = { id: themeId(template.id), font, background: template.background }
  const retained: string[] = []
  function element(value: Element): Element {
    if (value.theme === null || value.support.kind !== "native") { retained.push(value.id); return value }
    if (value.kind === "group") return { ...value, theme: theme.id, children: value.children.map(element) }
    const linked = (key: "font" | "color" | "fill") => { const yes = value.styleLinks === undefined || value.styleLinks.includes(key); if (!yes) retained.push(`${value.id}.${key}`); return yes }
    if (value.kind === "text") { const fontLinked = linked("font"), colorLinked = linked("color"); return { ...value, theme: theme.id, runs: value.runs.map(run => ({ ...run, font: fontLinked ? font : run.font, color: colorLinked ? template.foreground : run.color })) as typeof value.runs } }
    return { ...value, theme: theme.id, fill: linked("fill") ? template.accent : value.fill }
  }
  const pin = { id: template.id, version: template.version, family: family.id }
  const themes = [...deck.themes.filter(value => value.id !== theme.id), theme]
  if (mode.kind === "insert-slide") {
    const size = deck.slides[0]?.size ?? { width: 960, height: 540 }
    const slide: Slide = { id: id(mode.slideId), version: 0, size, notes: "", theme: theme.id, source: { kind: "created" }, elements: [] }
    return { changes: { changes: [{ kind: "set", target: deck.id, value: { ...deck, themes } }, { kind: "insert", parent: deck.id, index: deck.slides.length, value: slide }] }, retained, warnings: [] }
  }
  const slides = deck.slides.map(slide => {
    if (slide.theme === null) retained.push(slide.id)
    return { ...slide, theme: slide.theme === null ? null : theme.id, elements: slide.elements.map(element) }
  })
  return { changes: { changes: [{ kind: "set", target: deck.id, value: { ...deck, template: pin, themes, slides } }] }, retained, warnings: template.fontRight === "no-embedding" ? [`${font} cannot be embedded; PowerPoint may substitute it.`] : [] }
}
export function newerVersion(deck: Deck, templates: readonly Template[]): Template | null {
  const pin = deck.template
  return pin ? templates.filter(template => template.id === pin.id && template.version > pin.version).sort((a,b) => b.version-a.version)[0] ?? null : null
}
