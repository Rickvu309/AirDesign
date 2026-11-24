import * as doom from "@airdesign/doom"
import { fontFamily, styleName, stylesHeld } from "@airdesign/fonts"
import { fillCopy } from "@/copy/fill-copy"
import { formatCopy } from "@/copy/format-copy"
import { editorCopy } from "@/copy/editor-copy"
import { textCopy } from "@/copy/text-copy"
import type { PanelControl, PanelSection } from "@/design/panel"
import type { PanelKind } from "@/design/panel-order"
import { arrange, resolveControl } from "@/design/panel-arrangement"
import { choiceDesc, type Desc } from "@/design/control-desc"
import { servedFaces } from "@/design/served-faces"
import { doomControl, flagDesc, fontDesc, type Held } from "./design-controls"
import { shownText, sizeToHundredths, type TextShown } from "./design-text-values"
import type { ModelInput } from "./design-model"
import { paintedFace, propOf } from "@airdesign/doom"

const lists = ["none", "bullets", "numbers"]
const fillDesc: Desc = { kind: "union", plain: "solid", cases: { solid: { kind: "color" } } }
const styleDesc: Desc = { kind: "words", max: 200 }
const sizeLimit = doom.textLimits.size
const sizeDesc: Desc = {
  kind: "number",
  unit: "hundredth-point",
  min: sizeToHundredths(sizeLimit.min),
  max: sizeToHundredths(sizeLimit.max),
}
const textControl = (field: string, label: string, desc: Desc, held: Held, extra: Partial<PanelControl> = {}) =>
  doomControl({ trait: "text", field }, label, desc, held, extra)

function weightChoices(family: string, current: { readonly weight: number; readonly italic: boolean }) {
  const styles = stylesHeld(servedFaces(family))
  const listed = styles.some((style) => style.weight === current.weight && style.italic === current.italic)
  return (listed ? styles : [...styles, current]).map((style) => ({ value: styleName(style), label: styleName(style) }))
}

function typography(control: PanelControl, theme: doom.Theme, current: doom.TextStyleName): PanelControl {
  const names = Object.keys(editorCopy.textStyles) as doom.TextStyleName[]
  const choices = names.map((name) => {
    const style = theme.textStyles[name]
    const font = theme.fonts[style.font]
    const painted = paintedFace(font, style.weight, undefined)
    return {
      value: name,
      label: editorCopy.textStyles[name],
      font,
      detail: String(style.size),
      appearance: {
        fontFamily: fontFamily(painted.family),
        fontSize: Math.max(12, Math.min(28, style.size / 3)),
        fontWeight: painted.weight,
      },
    }
  })
  return { ...control, kind: "typography", value: current, choices, placeholder: textCopy.custom }
}

function weight(shown: TextShown): PanelControl {
  const current = { weight: shown.look.weight.value, italic: shown.look.italic.value }
  const choices = weightChoices(shown.look.font.value, current)
  const mixed = shown.look.weight.mixed || shown.look.italic.mixed
  return {
    ...textControl("weight", textCopy.weight, choiceDesc(choices.map((choice) => choice.value)), {
      value: mixed ? undefined : styleName(current),
      mixed,
    }),
    choices,
  }
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
    weight(shown),
    textControl("size", formatCopy.sizeGroup, sizeDesc, { value: size, mixed: look.size.mixed }),
    bold,
    italic,
    textControl("underline", formatCopy.named.underline, flagDesc, look.underline),
    textControl("strike", formatCopy.named.strike, flagDesc, look.strike),
    textControl("align", formatCopy.alignGroup, choiceDesc(doom.paragraphAligns), shown.align),
    textControl("list", textCopy.list, choiceDesc(lists), shown.list),
    fill,
  ]
  const named = kind === "text" ? controls.filter((control) => control !== fill) : controls
  const section: PanelSection = {
    trait: "text",
    label: textCopy.section,
    strips: arrange("text", named),
  }
  if (kind !== "text") return [section]
  const box = { ...fill, trait: "textFill" as const, field: "value" }
  return [
    section,
    {
      trait: "textFill",
      label: fillCopy.section,
      strips: arrange("textFill", [resolveControl(box)]),
    },
  ]
}
