import * as doom from "@airdesign/doom"
import { fontFamily, plainStyles, boldWeight, regularWeight, styleName } from "@airdesign/fonts"
import { fillCopy } from "@/copy/fill-copy"
import { formatCopy } from "@/copy/format-copy"
import { doomEditorCopy } from "@/copy/doom-editor-copy"
import { textCopy } from "@/copy/text-copy"
import type { PanelControl, PanelSection } from "@/design/panel"
import type { PanelKind } from "@/design/panel-order"
import { arrange, resolveControl } from "@/design/panel-arrangement"
import { spacingUnits } from "@/design/spacing-units"
import { choiceDesc, type Desc } from "@/design/control-desc"
import { doomControl, flagDesc, fontDesc, type Held } from "./design-controls"
import { lineToFraction, shownText, sizeToHundredths } from "./design-text-values"
import type { ModelInput } from "./design-model"
import { propOf } from "@/editing/node-props"

const casings = ["none", "upper", "lower", "title"]
const lists = ["none", "bullets", "numbers"]
const fillDesc: Desc = { kind: "union", plain: "solid", cases: { solid: { kind: "color" } } }
const styleDesc: Desc = { kind: "words", max: 200 }
const { size: sizeLimit, tracking: trackingLimit, lineHeight: lineLimit } = doom.textLimits
const sizeDesc: Desc = {
  kind: "number",
  unit: "hundredth-point",
  min: sizeToHundredths(sizeLimit.min),
  max: sizeToHundredths(sizeLimit.max),
}
const spacingDesc: Desc = {
  kind: "number",
  unit: "hundredth-point",
  min: sizeToHundredths(trackingLimit.min),
  max: sizeToHundredths(trackingLimit.max),
}
const lineDesc: Desc = {
  kind: "number",
  unit: "fraction",
  min: lineToFraction(lineLimit.min),
  max: lineToFraction(lineLimit.max),
}

const textControl = (field: string, label: string, desc: Desc, held: Held, extra: Partial<PanelControl> = {}) =>
  doomControl({ trait: "text", field }, label, desc, held, extra)

function typography(control: PanelControl, theme: doom.Theme, current: doom.TextStyleName): PanelControl {
  const names = Object.keys(doomEditorCopy.textStyles) as doom.TextStyleName[]
  const choices = names.map((name) => {
    const style = theme.textStyles[name]
    const font = theme.fonts[style.font]
    return {
      value: name,
      label: doomEditorCopy.textStyles[name],
      font,
      detail: String(style.size),
      appearance: {
        fontFamily: fontFamily(font),
        fontSize: Math.max(12, Math.min(28, style.size / 3)),
        fontWeight: style.weight >= 600 ? 700 : 400,
      },
    }
  })
  return { ...control, kind: "typography", value: current, choices, placeholder: textCopy.custom }
}

function weight(bold: PanelControl, italic: PanelControl): PanelControl {
  const choices = plainStyles.map((style) => ({ value: styleName(style), label: styleName(style) }))
  const mixed = bold.mixed || italic.mixed
  const current = { weight: bold.value === true ? boldWeight : regularWeight, italic: italic.value === true }
  return resolveControl({
    ...bold,
    field: "weight",
    label: textCopy.weight,
    desc: choiceDesc(choices.map((choice) => choice.value)),
    value: mixed ? undefined : styleName(current),
    mixed,
    reset: null,
    choices,
  })
}

export function textSections(input: ModelInput, kind: PanelKind): PanelSection[] {
  const text = propOf(input.view.nodes.get(input.id), "text")
  if (text === undefined) return []
  const { theme } = input
  const shown = shownText(text, theme)
  const { look } = shown
  const bold = textControl("bold", formatCopy.named.bold, flagDesc, look.bold)
  const italic = textControl("italic", formatCopy.named.italic, flagDesc, look.italic)
  const fill = textControl("fill", textCopy.value, fillDesc, {
    value: { solid: look.color.value },
    mixed: look.color.mixed,
  })
  const size = sizeToHundredths(look.size.value)
  const controls: PanelControl[] = [
    typography(textControl("style", textCopy.style, styleDesc, { value: shown.style }), theme, shown.style),
    textControl("font", textCopy.font, fontDesc, look.font),
    weight(bold, italic),
    textControl("size", formatCopy.sizeGroup, sizeDesc, { value: size, mixed: look.size.mixed }),
    textControl(
      "letterSpacing",
      textCopy.letterSpacing,
      spacingDesc,
      { value: Math.round(look.tracking.value * 100), mixed: look.tracking.mixed },
      spacingUnits("text", "letterSpacing", size),
    ),
    textControl("lineHeight", textCopy.lineHeight, lineDesc, {
      value: lineToFraction(shown.lineHeight.value),
      mixed: shown.lineHeight.mixed,
    }),
    bold,
    italic,
    textControl("underline", formatCopy.named.underline, flagDesc, look.underline),
    textControl("strike", formatCopy.named.strike, flagDesc, look.strike),
    textControl("align", formatCopy.alignGroup, choiceDesc(doom.paragraphAligns), shown.align),
    textControl("list", textCopy.list, choiceDesc(lists), shown.list),
    textControl("case", textCopy.case, choiceDesc(casings), look.case),
    fill,
  ]
  const named = kind === "text" ? controls.filter((control) => control !== fill) : controls
  const section: PanelSection = {
    trait: "text",
    label: textCopy.section,
    open: true,
    strips: arrange("text", named),
  }
  if (kind !== "text") return [section]
  const box = { ...fill, trait: "textFill" as const, field: "value" }
  return [
    section,
    {
      trait: "textFill",
      label: fillCopy.section,
      open: true,
      strips: arrange("textFill", [resolveControl(box)]),
    },
  ]
}
