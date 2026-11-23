import type * as doom from "@airdesign/doom"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { propOf } from "@airdesign/doom"

type Held = "hidden" | "locked"

function layersUnder(view: doom.Doom, id: doom.NodeId): readonly doom.NodeId[] {
  return (view.children.get(id) ?? []).flatMap((child) =>
    propOf(view.nodes.get(child), "parent") == null ? [] : [child, ...layersUnder(view, child)],
  )
}

export function heldBack(view: doom.Doom, slide: doom.NodeId): Readonly<Record<Held, readonly doom.NodeId[]>> {
  const layers = layersUnder(view, slide)
  const where = (prop: Held) => layers.filter((id) => propOf(view.nodes.get(id), prop) === true)
  return { hidden: where("hidden"), locked: where("locked") }
}

export function showWrites(ids: readonly doom.NodeId[], prop: Held): readonly doom.Write[] {
  return ids.map((node) => ({ node, prop, value: null }))
}

export function HiddenLockedLayers(props: {
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly push: (writes: readonly doom.Write[]) => void
}) {
  const held = heldBack(props.view, props.slide)
  const rows = (["hidden", "locked"] as const).filter((prop) => held[prop].length > 0)
  if (rows.length === 0) return null
  return (
    <section data-held-layers className="flex flex-col border-b border-line px-4 py-2">
      {rows.map((prop) => (
        <div key={prop} data-held={prop} className="flex h-7 items-center justify-between gap-2">
          <span className="text-[length:var(--type-caption)] text-quiet">
            {designCopy.heldLayers[prop](held[prop].length)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mr-2 h-6 px-2 text-[length:var(--type-caption)] font-normal"
            onClick={() => props.push(showWrites(held[prop], prop))}
          >
            {designCopy.heldLayersBack[prop]}
          </Button>
        </div>
      ))}
    </section>
  )
}
