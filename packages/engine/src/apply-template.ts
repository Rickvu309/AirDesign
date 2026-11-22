import type { WireTemplateStyle } from "@airdesign/catalog"
import {
  mappedSlots,
  templateStyleIndex,
  type ElementId,
  type MappedSlot,
  type Register,
  type SetChange,
  type TemplateColor,
} from "@airdesign/document"
import { templateTheme, type TemplateTheme } from "@airdesign/templates"

const lightMap: Readonly<Record<MappedSlot, TemplateColor>> = {
  bg1: "lt1",
  tx1: "dk1",
  bg2: "lt2",
  tx2: "dk2",
}

const darkMap: Readonly<Record<MappedSlot, TemplateColor>> = {
  bg1: "dk1",
  tx1: "lt1",
  bg2: "dk2",
  tx2: "lt2",
}

function targetMapOf(register: Register, node: ElementId): Partial<Readonly<Record<MappedSlot, TemplateColor>>> {
  const index = templateStyleIndex(node)
  if (index !== null) return register.index?.templateStyles?.[index]?.palette.map ?? {}
  return register.index?.templateStyles?.[0]?.palette.map ?? register.index?.palettes?.[0]?.map ?? {}
}

export function templateStyleFields(
  theme: TemplateTheme,
  targetMap: Partial<Readonly<Record<MappedSlot, TemplateColor>>>,
): NonNullable<SetChange["templateStyle"]> {
  const sourceMap = theme.map === "dark" ? darkMap : lightMap
  const colors: Record<TemplateColor, string> = { ...theme.colors }
  for (const role of mappedSlots) {
    const sourceSlot = sourceMap[role]
    const targetSlot = targetMap[role] ?? lightMap[role]
    colors[targetSlot] = theme.colors[sourceSlot]
  }
  return { ...colors, major: theme.fonts.major, minor: theme.fonts.minor }
}

type TemplatedSet = Omit<SetChange, "templateStyle"> & { readonly templateStyle?: WireTemplateStyle }

export function expandedTemplateChange(register: Register, node: ElementId, change: TemplatedSet): SetChange | null {
  const style = change.templateStyle
  if (style === undefined || style.template === undefined) return change
  const theme = templateTheme(style.template)
  if (theme === undefined) return null
  const { template: _template, ...overrides } = style
  return {
    ...change,
    target: { node },
    templateStyle: { ...templateStyleFields(theme, targetMapOf(register, node)), ...overrides },
  }
}
