import { fixedLineHeight, type ScopedElement, type SetChange } from "@airdesign/document"
import { fixedLine } from "./typed-number"

export function lineHeightChange(view: ScopedElement): (value: unknown) => SetChange {
  return (value) => {
    const fixed = fixedLine(value)
    const text = fixed === null ? { lineHeight: value } : { value: fixedLineHeight(view.value ?? "", fixed.points) }
    return { target: { node: view.node }, text } as SetChange
  }
}
