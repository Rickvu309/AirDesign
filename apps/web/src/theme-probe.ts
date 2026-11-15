import { format, themeSlots, type ThemeSlot } from "@airdesign/document"
import { exportParts, paintReader, shownTheme } from "@airdesign/pptx"
import { indexed, landed, type At, type Parts, type Probe } from "./parity-probe"

const themeOpening = {
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
} as const

function shown(field: keyof typeof themeOpening) {
  return { file: (parts: Parts, at: At) => shownTheme(parts, at.part)[field], shows: (value: string) => value }
}

function named(parts: Parts, at: At, field: string): Parts {
  const slot = themeSlots.find((each): each is ThemeSlot => each === field)
  if (slot === undefined) return parts
  const node = `${at.slide}.${at.shape}` as At["node"]
  const fill = { fill: { value: { set: { solid: { scheme: slot } } } } }
  const register = landed(indexed(parts), [
    { command: "add", node, floor: "", route: "clean" },
    { command: "person", node, v: format, patch: fill },
  ])
  if (register === null) throw new Error(field)
  return exportParts(parts, register)
}

export const themeProbe: Probe<"theme"> = {
  deck: "doe-heat-pumps.pptx",
  kind: "deck",
  opening: () => ({ v: format, patch: { theme: themeOpening } }),
  edit: (_, field, value) => ({ v: format, patch: { theme: { [field]: { set: value } } } }),
  painted: (parts, at, field) => JSON.stringify(paintReader(named(parts, at, field)).slide(at.part).elements),
  fields: {
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
  },
}
