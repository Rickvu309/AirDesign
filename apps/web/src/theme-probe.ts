import { format, templateColors, type TemplateColor } from "@airdesign/document"
import {
  exportParts,
  paintReader,
  readTemplateTextEdit,
  shownTheme,
  slideTheme,
  templateStyle,
  themeCustomColors,
} from "@airdesign/pptx"
import { indexed, landed, type At, type Parts, type Probe } from "./parity-probe"

const themeOpening = {
  name: "opening",
  dk1: "opening",
  lt1: "opening",
  dk2: "opening",
  lt2: "opening",
  accent1: "opening",
  accent2: "opening",
  accent3: "opening",
  accent4: "opening",
  accent5: "opening",
  accent6: "opening",
  hlink: "opening",
  folHlink: "opening",
  major: "opening",
  minor: "opening",
  custom: "opening",
  removed: "opening",
  textStyle: "opening",
} as const

function shown(field: keyof typeof themeOpening) {
  return { file: (parts: Parts, at: At) => shownTheme(parts, at.part)[field], shows: (value: string) => value }
}

function named(parts: Parts, at: At, field: string): Parts {
  const slot = templateColors.find((each): each is TemplateColor => each === field)
  if (slot === undefined) return parts
  const node = `${at.slide}.${at.shape}` as At["node"]
  const fill = { fills: { p0: { set: { solid: { scheme: slot } } } } }
  const register = landed(indexed(parts), [
    { command: "add", node, floor: "", route: "clean" },
    { command: "person", node, v: format, patch: fill },
  ])
  if (register === null) throw new Error(field)
  return exportParts(parts, register)
}

function themeBytes(parts: Parts, at: At): Uint8Array {
  const theme = slideTheme(parts, at.part)
  return theme === null ? new Uint8Array() : (parts.get(theme) ?? new Uint8Array())
}

const titleStyle = "ppt/slideMasters/slideMaster1.xml/titleStyle/0"

function shownTextStyle(parts: Parts, at: At) {
  const theme = slideTheme(parts, at.part)
  if (theme === null) return []
  const read = readTemplateTextEdit(parts, theme, titleStyle)
  return read === null ? [] : [read]
}

export const themeProbe: Probe<"theme"> = {
  deck: "two-templates.pptx",
  kind: "deck",
  opening: () => ({ v: format, patch: { theme: themeOpening } }),
  edit: (_, field, value) => ({ v: format, patch: { theme: { [field]: { set: value } } } }),
  painted: (parts, at, field) => {
    if (field === "textStyle") {
      const read = shownTextStyle(parts, at)
      return read.length === 0 ? "none" : String(read[0]?.size ?? "none")
    }
    if (field === "removed") return parts.has("ppt/theme/theme2.xml") ? "kept" : "dropped"
    if (field === "custom") return JSON.stringify(themeCustomColors(themeBytes(parts, at)) ?? [])
    return field === "name"
      ? (templateStyle(parts, at.part).name ?? "")
      : JSON.stringify(paintReader(named(parts, at, field)).slide(at.part).elements)
  },
  fields: {
    name: { file: (parts, at) => templateStyle(parts, at.part).name, shows: (value) => value },
    dk1: shown("dk1"),
    lt1: shown("lt1"),
    dk2: shown("dk2"),
    lt2: shown("lt2"),
    accent1: shown("accent1"),
    accent2: shown("accent2"),
    accent3: shown("accent3"),
    accent4: shown("accent4"),
    accent5: shown("accent5"),
    accent6: shown("accent6"),
    hlink: shown("hlink"),
    folHlink: shown("folHlink"),
    major: shown("major"),
    minor: shown("minor"),
    custom: {
      file: (parts, at) => themeCustomColors(themeBytes(parts, at)) ?? [],
      shows: (value) => value,
    },
    removed: {
      file: (parts) => !parts.has("ppt/theme/theme2.xml"),
      shows: (value) => value,
    },
    textStyle: {
      file: shownTextStyle,
      shows: (value) => value,
    },
  },
}
