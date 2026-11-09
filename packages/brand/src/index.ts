import {isNativeDeck, type NativeDeck, type NativeElement} from "../../deck/src/text/native-v3.ts"
import type {TextStyle} from "../../deck/src/text/body.ts"
import {parseNativeChangeSet, type NativeChangeSet} from "../../deck/src/text/operations.ts"
import { id, themeId, type ChangeSet, type Deck, type Element, type Slide, parseChangeSet } from "../../deck/src/index.ts"

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
type TemplatePlan<C> = {changes: C; retained: string[]; warnings: string[]}
export function applyTemplate(deck: NativeDeck, template: Template, mode: TemplateMode, familyId?: string, substitution?: "Geist"): TemplatePlan<NativeChangeSet>
export function applyTemplate(deck: Deck, template: Template, mode: TemplateMode, familyId?: string, substitution?: "Geist"): TemplatePlan<ChangeSet>
export function applyTemplate(deck: Deck | NativeDeck, template: Template, mode: TemplateMode, familyId?: string, substitution?: "Geist"): TemplatePlan<ChangeSet | NativeChangeSet>
export function applyTemplate(deck: Deck | NativeDeck, template: Template, mode: TemplateMode, familyId = template.families[0]?.id, substitution?: "Geist"): TemplatePlan<ChangeSet | NativeChangeSet> {
  const family = template.families.find(family => family.id === (mode.kind === "insert-slide" ? mode.family : familyId))
  if (!family) throw new Error("layout-family-not-found")
  if (template.fontRight === "missing" && !substitution) throw new Error("choose-font-substitution")
  const font = substitution ?? template.font
  let chosenTheme=themeId(template.id)
  if(mode.kind==="insert-slide" && deck.themes.some(theme=>theme.id===chosenTheme && (theme.font!==font || theme.background!==template.background || theme.foreground!==template.foreground))){let suffix=0;while(deck.themes.some(theme=>theme.id===`insert${suffix}`))suffix++;chosenTheme=themeId(`insert${suffix}`)}
  const theme = { id: chosenTheme, font, background: template.background,foreground:template.foreground }
  const retained: string[] = []
  function element(value: Element | NativeElement): unknown {
    if (value.kind === "group") {
      const linked=value.theme!==null && value.support.kind==="native"
      if(!linked)retained.push(value.id)
      return {...value,theme:linked ? theme.id : value.theme,children:value.children.map(element)}
    }
    if (value.theme === null || value.support.kind !== "native") { retained.push(value.id); return value }
    const linked = (key: "font" | "color" | "fill") => { const yes = value.styleLinks === undefined || value.styleLinks.includes(key); if (!yes) retained.push(`${value.id}.${key}`); return yes }
    if (value.kind === "text") {
      const fontLinked = linked("font"), colorLinked = linked("color")
      const style = (value: TextStyle) => ({...value, font: fontLinked ? font : value.font, color: colorLinked ? template.foreground : value.color})
      if ("body" in value) return {...value, theme: theme.id, body: {...value.body, paragraphs: value.body.paragraphs.map(paragraph => ({...paragraph, endStyle: style(paragraph.endStyle), runs: paragraph.runs.map(run => ({...run, style: style(run.style)}))}))}}
      return {...value, theme: theme.id, runs: value.runs.map(run => ({...run, ...style(run)}))}
    }
    if (value.kind === "image") return value
    return { ...value, theme: theme.id, fill: linked("fill") ? template.accent : value.fill }
  }
  const changes = (value: unknown) => isNativeDeck(deck) ? parseNativeChangeSet(value) : parseChangeSet(value)
  const layout=family.master ? {template:template.id,version:template.version,family:family.id,master:family.master,part:family.layouts[0]!} : undefined
  const pin = { id: template.id, version: template.version, family: family.id,...(layout ? {layout:{master:layout.master,part:layout.part}} : {}) }
  const themes = [...deck.themes.filter(value => value.id !== theme.id), theme]
  if (mode.kind === "insert-slide") {
    const size = deck.slides[0]?.size ?? { width: 960, height: 540 }
    const slide: Slide = { ...(layout ? {layout} : {}), id: id(mode.slideId), version: 0, size, notes: "", theme: theme.id, source: { kind: "created" }, elements: [] }
    return { changes: changes({ changes: [{ kind: "set", target: deck.id, value: { ...deck, themes } }, { kind: "insert", parent: deck.id, index: deck.slides.length, value: slide }] }), retained, warnings: [] }
  }
  const slides = deck.slides.map(slide => {
    if (slide.theme === null) retained.push(slide.id)
    const {layout: previousLayout,...content}=slide
    void previousLayout
    return { ...content, ...(layout ? {layout} : {}), theme: slide.theme === null ? null : theme.id, elements: slide.elements.map(element) }
  })
  return { changes: changes({ changes: [{ kind: "set", target: deck.id, value: { ...deck, template: pin, themes, slides } }] }), retained, warnings: template.fontRight === "no-embedding" ? [`${font} cannot be embedded; PowerPoint may substitute it.`] : [] }
}
export function newerVersion(deck: Pick<NativeDeck, "template">, templates: readonly Template[]): Template | null {
  const pin = deck.template
  return pin ? templates.filter(template => template.id === pin.id && template.version > pin.version).sort((a,b) => b.version-a.version)[0] ?? null : null
}

export function templateDeck(template: Template): NativeDeck {
  const deck: NativeDeck = {id: id("newDeck"), version: 0, slides: [], themes: [{id: themeId("default"), font: "Geist", background: "#ffffff"}]}
  const plan = applyTemplate(deck, template, {kind: "apply-deck"})
  const replacement = plan.changes.changes[0]
  if (replacement?.kind !== "set" || !isNativeDeck(replacement.value)) throw new Error("template-deck-required")
  return replacement.value
}
