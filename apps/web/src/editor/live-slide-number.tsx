import { deviceScope } from "@/design/trait-edit"
import { changeDesign } from "@/design/design-change"
import { openRegister, shapeOf, type ElementId } from "@airdesign/document"
import { slideNumbering } from "@airdesign/pptx"
import type { DesigningDeck } from "./live-design-panel"
import { addSlideNumbers, numberRun, setNumber } from "./slide-number-actions"
import { SlideNumberSection } from "./slide-number-section"

export function liveSlideNumber(deck: DesigningDeck, node: ElementId, value: string | null) {
  const settings = numberRun(value ?? "")?.slideNumber
  if (settings === undefined) return null
  const { shown } = deck
  const numbers = slideNumbering(shown.displayParts.current, shown.shownRegister.current).get(shapeOf(node).slide)
  if (numbers === undefined) return null
  return (
    <SlideNumberSection
      settings={settings}
      numbers={numbers}
      onAddAll={() => void addSlideNumbers(deck, node)}
      onChange={(next) =>
        changeDesign(deck, () => {
          const scope = deviceScope(shown.shownParts.current, shown.shownRegister.current ?? openRegister("", ""))
          const stored = scope.view(node)?.value ?? value ?? ""
          return { target: { node }, text: { value: setNumber(stored, next) } }
        })
      }
    />
  )
}
