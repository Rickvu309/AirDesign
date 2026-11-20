import type { SetChange } from "@airdesign/document"
import type { PanelModel, PanelControl, PanelSection } from "@/design/panel"
import { fixedLine } from "@/design/typed-number"

export function controlsOf(sections: readonly PanelSection[] | undefined): readonly PanelControl[] {
  return (sections ?? []).flatMap((section) => section.strips.flat())
}

function ownChange(control: PanelControl, value: unknown): boolean {
  return (
    control.trait === "corners" ||
    (control.trait === "text" && control.field === "lineHeight" && fixedLine(value) !== null)
  )
}

export function perDesignChanges(
  designs: readonly { readonly model: PanelModel }[],
  control: PanelControl,
  value: unknown,
): readonly SetChange[] | null {
  if (!ownChange(control, value)) return null
  const own = designs.map(({ model }) =>
    controlsOf(model.sections).find(
      ({ trait, field }) => trait === control.trait && (trait === "corners" || field === control.field),
    ),
  )
  return own.every((each) => each !== undefined) ? own.map((each) => each.change(value)) : []
}
