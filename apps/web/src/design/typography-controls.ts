import {
  boldWeight,
  fontFamily,
  resolveFont,
  listedStyles,
  namedFace,
  plainStyles,
  readStyleName,
  regularWeight,
  styleName,
  styleTypeface,
  type FontStyle,
} from "@airdesign/fonts"
import { readTextFill, type TextStyle } from "@airdesign/document"
import { designCopy } from "@/copy/design-copy"
import { textCopy } from "@/copy/text-copy"
import type { PanelControl, PanelReads } from "./panel"
import { resolveControl } from "./panel-arrangement"

function stylesOf(family: string | undefined, current: FontStyle | undefined, shown: PanelReads) {
  const listed = family === undefined ? plainStyles : listedStyles(family, (name) => shown.faces?.(name))
  const all = current === undefined || listed.some((style) => sameStyle(style, current)) ? listed : [...listed, current]
  return [...all].sort((left, right) => left.weight - right.weight || Number(left.italic) - Number(right.italic))
}

function sameStyle(left: FontStyle, right: FontStyle): boolean {
  return left.weight === right.weight && left.italic === right.italic
}

function facesUnknown(family: string, shown: PanelReads): boolean {
  return resolveFont(family)?.family.toLowerCase() === family.toLowerCase() && shown.faces?.(family) === undefined
}

function holds(family: string, current: FontStyle, shown: PanelReads): boolean {
  return stylesOf(family, undefined, shown).some((style) => sameStyle(style, current))
}

export function typographyControls(
  controls: readonly PanelControl[],
  styles: readonly TextStyle[],
  shown: PanelReads,
): readonly PanelControl[] {
  const font = controls.find((control) => control.field === "font")
  const typeface =
    font?.value === "+mj-lt" ? shown.fonts?.major : font?.value === "+mn-lt" ? shown.fonts?.minor : font?.value
  const bold = controls.find((control) => control.field === "bold")
  const italic = controls.find((control) => control.field === "italic")
  const named = typeof font?.value === "string" ? namedFace(font.value) : undefined
  const family = named?.family ?? (typeof typeface === "string" ? typeface : undefined)
  const mixed = bold?.mixed === true || font?.mixed === true || italic?.mixed === true
  const current: FontStyle | undefined = mixed
    ? undefined
    : { weight: bold?.value === true ? boldWeight : (named?.weight ?? regularWeight), italic: italic?.value === true }
  const choices = stylesOf(family, current, shown).map((style) => ({
    value: styleName(style),
    label: styleName(style),
  }))
  const weight =
    bold === undefined
      ? []
      : [
          resolveControl({
            ...bold,
            field: "weight",
            label: textCopy.weight,
            desc: { kind: "choice", options: choices.map((choice) => choice.value) },
            value: current === undefined ? undefined : styleName(current),
            mixed,
            reset: null,
            change: (value) => {
              const style = typeof value === "string" ? readStyleName(value) : undefined
              const wanted = style ?? { weight: regularWeight, italic: false }
              const face = family === undefined ? undefined : styleTypeface(family, wanted.weight)
              const plain = wanted.weight === regularWeight || wanted.weight === boldWeight
              const refaced = face !== undefined && (plain ? named !== undefined : face !== font?.value)
              const emboldened = wanted.weight === boldWeight
              return {
                ...bold.change(emboldened),
                text: {
                  ...(refaced ? { font: face } : {}),
                  ...(mixed || bold.value !== emboldened ? { bold: emboldened } : {}),
                  ...(mixed || italic?.value !== wanted.italic ? { italic: wanted.italic } : {}),
                },
              }
            },
            choices,
          }),
        ]
  return [
    ...controls.map((control) => {
      if (control.field === "font" && typeof typeface === "string")
        return {
          ...control,
          value: named?.family ?? typeface,
          faceFallback: () =>
            named === undefined ||
            current === undefined ||
            facesUnknown(named.family, shown) ||
            holds(named.family, current, shown)
              ? null
              : named.family,
          change: (value: unknown) => {
            if (typeof value !== "string" || current === undefined || namedFace(value) !== undefined)
              return control.change(value)
            const kept = facesUnknown(value, shown) || holds(value, current, shown)
            const wanted = kept ? current : { weight: regularWeight, italic: false }
            const emboldened = wanted.weight === boldWeight
            const face = styleTypeface(value, wanted.weight)
            return {
              ...control.change(face),
              text: {
                font: face,
                ...(bold?.value !== emboldened ? { bold: emboldened } : {}),
                ...(italic?.value !== wanted.italic ? { italic: wanted.italic } : {}),
              },
            }
          },
        }
      if (control.field === "bold" && named !== undefined)
        return {
          ...control,
          change: (value: unknown) => ({
            ...control.change(value),
            text: { font: named.family, bold: value === true },
          }),
        }
      if (control.field !== "style") return control
      const matching = styles.find((style) =>
        Object.entries(style.fields).every(([key, value]) => {
          const held = controls.find((each) => each.field === (key === "color" ? "fill" : key))
          const fill = key === "color" ? readTextFill(held?.value) : null
          const current = key === "color" ? (fill !== null && "solid" in fill ? fill.solid : undefined) : held?.value
          const named =
            key === "font" && typeof value === "string" && value.startsWith("+m")
              ? (shown.fonts?.[value === "+mj-lt" ? "major" : "minor"] ?? value)
              : value
          return (
            held !== undefined &&
            !held.mixed &&
            (JSON.stringify(current) === JSON.stringify(value) || JSON.stringify(current) === JSON.stringify(named))
          )
        }),
      )
      return {
        ...control,
        kind: "typography" as const,
        value: matching?.id,
        choices: styles.map((style) => ({
          value: style.id,
          label: style.name,
          font: style.fields.font?.startsWith("+m")
            ? shown.fonts?.[style.fields.font === "+mj-lt" ? "major" : "minor"]
            : style.fields.font,
          detail: style.fields.size === undefined ? undefined : String(style.fields.size / 100),
          appearance: {
            fontFamily: fontFamily(
              (style.fields.font?.startsWith("+m")
                ? shown.fonts?.[style.fields.font === "+mj-lt" ? "major" : "minor"]
                : style.fields.font) ?? null,
            ),
            fontSize: Math.max(12, Math.min(28, (style.fields.size ?? 1800) / 100)),
            fontWeight: style.fields.bold ? 700 : 400,
            fontStyle: style.fields.italic ? "italic" : "normal",
          },
        })),
        placeholder: designCopy.mixed === control.value ? designCopy.mixed : textCopy.custom,
      }
    }),
    ...weight,
  ]
}
