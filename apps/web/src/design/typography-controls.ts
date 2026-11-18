import { fontFamily, portableFace, portableFaces } from "@airdesign/fonts"
import type { TextStyle } from "@airdesign/document"
import { designCopy } from "@/copy/design-copy"
import { formatCopy } from "@/copy/format-copy"
import { textCopy } from "@/copy/text-copy"
import type { PanelControl, PanelReads } from "./panel"
import { resolveControl } from "./panel-arrangement"

export function typographyControls(
  controls: readonly PanelControl[],
  styles: readonly TextStyle[],
  shown: PanelReads,
): readonly PanelControl[] {
  const font = controls.find((control) => control.field === "font")
  const typeface =
    font?.value === "+mj-lt" ? shown.fonts?.major : font?.value === "+mn-lt" ? shown.fonts?.minor : font?.value
  const bold = controls.find((control) => control.field === "bold")
  const available = portableFaces(typeof typeface === "string" ? typeface : "")
  const choices = [
    ...available.slice(0, 3).map((face) => ({ value: face.typeface, label: face.name })),
    { value: "regular", label: textCopy.regular },
    ...available.slice(3, 5).map((face) => ({ value: face.typeface, label: face.name })),
    { value: "bold", label: formatCopy.named.bold },
    ...available.slice(5).map((face) => ({ value: face.typeface, label: face.name })),
  ]
  const weight =
    bold === undefined
      ? []
      : [
          resolveControl({
            ...bold,
            field: "weight",
            label: textCopy.weight,
            desc: {
              kind: "choice",
              options: choices.map((choice) => choice.value),
            },
            value:
              bold.mixed || font?.mixed
                ? undefined
                : bold.value === true
                  ? "bold"
                  : typeof font?.value === "string"
                    ? (portableFace(font.value)?.typeface ?? "regular")
                    : "regular",
            mixed: bold.mixed || font?.mixed === true,
            reset: null,
            change: (value) => {
              const face = typeof value === "string" ? portableFace(value) : undefined
              const base = typeof font?.value === "string" ? portableFace(font.value)?.family : undefined
              return {
                ...bold.change(value === "bold"),
                text: {
                  ...(bold.mixed || font?.mixed || bold.value !== (value === "bold") ? { bold: value === "bold" } : {}),
                  ...(face === undefined ? (base === undefined ? {} : { font: base }) : { font: face.typeface }),
                },
              }
            },
            choices,
          }),
        ]
  return [
    ...controls.map((control) => {
      const face = typeof font?.value === "string" ? portableFace(font.value) : undefined
      if (control.field === "font" && typeof typeface === "string")
        return { ...control, value: face?.family ?? typeface }
      if (control.field === "bold" && face !== undefined)
        return {
          ...control,
          change: (value: unknown) => ({ ...control.change(value), text: { font: face.family, bold: value === true } }),
        }
      if (control.field !== "style") return control
      const matching = styles.find((style) =>
        Object.entries(style.fields).every(([key, value]) => {
          const held = controls.find((each) => each.field === key)
          const named =
            key === "font" && typeof value === "string" && value.startsWith("+m")
              ? (shown.fonts?.[value === "+mj-lt" ? "major" : "minor"] ?? value)
              : value
          return (
            held !== undefined &&
            !held.mixed &&
            (JSON.stringify(held.value) === JSON.stringify(value) ||
              JSON.stringify(held.value) === JSON.stringify(named))
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
