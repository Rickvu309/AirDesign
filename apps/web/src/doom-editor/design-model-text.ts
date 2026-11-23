import * as doom from "@airdesign/doom"
import { fontFamily, plainStyles, boldWeight, regularWeight, styleName } from "@airdesign/fonts"
import { fillCopy } from "@/copy/fill-copy"
import { doomEditorCopy } from "@/copy/doom-editor-copy"
import { textCopy } from "@/copy/text-copy"
import type { PanelControl, PanelSection } from "@/design/panel"
import type { PanelKind } from "@/design/panel-order"
import { arrange, resolveControl } from "@/design/panel-arrangement"
import { spacingUnits } from "@/design/spacing-units"
import { choiceDesc, oldControl, doomControl } from "./design-controls"
import { lineOld, shownText, sizeOld } from "./design-text-values"
import type { ModelInput } from "./design-model"
import { propOf } from "@/editing/node-props"

const casings = ["none", "upper", "lower", "title"]
const fillDesc = { kind: "union", plain: "solid", cases: { solid: { kind: "color" } } } as const

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
  const bold = oldControl("text", "bold", look.bold)
  const italic = oldControl("text", "italic", look.italic)
  const fill = doomControl({ trait: "text", field: "fill" }, textCopy.value, fillDesc, {
    value: { solid: look.color.value },
    mixed: look.color.mixed,
  })
  const size = sizeOld(look.size.value)
  const controls: PanelControl[] = [
    typography(oldControl("text", "style", { value: shown.style }), theme, shown.style),
    oldControl("text", "font", look.font),
    weight(bold, italic),
    oldControl("text", "size", { value: size, mixed: look.size.mixed }),
    oldControl(
      "text",
      "letterSpacing",
      { value: Math.round(look.tracking.value * 100), mixed: look.tracking.mixed },
      spacingUnits("text", "letterSpacing", size),
    ),
    oldControl("text", "lineHeight", { value: lineOld(shown.lineHeight.value), mixed: shown.lineHeight.mixed }),
    bold,
    italic,
    oldControl("text", "underline", look.underline),
    oldControl("text", "strike", look.strike),
    oldControl("text", "align", shown.align),
    oldControl("text", "list", shown.list),
    oldControl("text", "case", look.case, { desc: choiceDesc(casings) }),
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
