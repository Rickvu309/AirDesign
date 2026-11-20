import type { ElementId } from "@airdesign/document"
import { styleName, readStyleName, type FontStyle } from "@airdesign/fonts"
import type { TextFormatting } from "@airdesign/render"
import { useSyncExternalStore } from "react"
import type { PanelControl, PanelModel } from "./panel"

export function isWeight(control: PanelControl): boolean {
  return control.trait === "text" && control.field === "weight"
}

function weightOrder(value: string): number {
  const style = readStyleName(value)
  return style === undefined ? 0 : style.weight + (style.italic ? 0.5 : 0)
}

function shownWeight(control: PanelControl, style: FontStyle | "mixed"): PanelControl {
  if (style === "mixed") return { ...control, value: undefined, mixed: true }
  const name = styleName(style)
  const listed = control.choices ?? []
  const choices = listed.some((choice) => choice.value === name)
    ? listed
    : [...listed, { value: name, label: name }].sort(
        (left, right) => weightOrder(left.value) - weightOrder(right.value),
      )
  return {
    ...control,
    value: name,
    mixed: false,
    choices,
    desc: { kind: "choice", options: choices.map((choice) => choice.value) },
  }
}

export function selectedWeight(model: PanelModel, style: FontStyle | "mixed" | null): PanelModel {
  if (style === null) return model
  return {
    ...model,
    sections: model.sections.map((section) => ({
      ...section,
      strips: section.strips.map((strip) =>
        strip.map((control) => (isWeight(control) ? shownWeight(control, style) : control)),
      ),
    })),
  }
}

const unsubscribed = () => () => undefined

function selectionStyle(formatting: TextFormatting | undefined, node: ElementId): FontStyle | "mixed" | null {
  if (formatting === undefined || formatting.aimed() !== node || !formatting.selection()) return null
  return formatting.fontStyle()
}

export function useSelectedWeight(formatting: TextFormatting | undefined, node: ElementId): FontStyle | "mixed" | null {
  const seen = useSyncExternalStore(
    formatting?.subscribe ?? unsubscribed,
    () => JSON.stringify(selectionStyle(formatting, node)),
    () => "null",
  )
  const style: unknown = JSON.parse(seen)
  if (style === "mixed") return style
  return typeof style === "object" && style !== null && "weight" in style && "italic" in style
    ? { weight: Number(style.weight), italic: style.italic === true }
    : null
}

export function weightPicked(formatting: TextFormatting | undefined, value: unknown): boolean {
  const style = typeof value === "string" ? readStyleName(value) : undefined
  if (formatting === undefined || style === undefined) return false
  formatting.weightTo(style)
  return true
}
