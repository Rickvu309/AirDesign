import { openRegister, siteKinds, type ElementId, type ScopedElement } from "@airdesign/document"
import type { NodeChoice } from "@/design/panel"
import { plainNames } from "@/design/node-names"
import { siteNames } from "@/design/site-names"
import { deviceScope } from "@/design/trait-edit"
import type { DesigningDeck } from "./live-design-panel"

export function nodeChoices(
  deck: DesigningDeck,
  connector: ScopedElement,
  nameOf: (node: ElementId) => unknown,
): readonly NodeChoice[] {
  const { shown } = deck
  const scope = deviceScope(shown.shownParts.current, shown.shownRegister.current ?? openRegister("", ""))
  const nodes = shown.store.current.slides()[shown.current]?.elements ?? []
  const found = nodes.flatMap((node) => {
    const view = node === connector.node ? undefined : scope.view(node)
    if (
      view === undefined ||
      !siteKinds.includes(view.facts.kind) ||
      view.outline === undefined ||
      view.outline === null
    )
      return []
    if ((view.parent ?? null) !== (connector.parent ?? null)) return []
    const name = nameOf(node)
    const frame = view.box ?? { cx: 0, cy: 0 }
    return [
      {
        node,
        name: typeof name === "string" ? name : "",
        kind: view.facts.kind,
        sites: siteNames(view.outline, frame),
      },
    ]
  })
  const names = plainNames(found)
  return found.map(({ node, sites }, at) => ({ node, name: names[at] ?? node, sites }))
}
