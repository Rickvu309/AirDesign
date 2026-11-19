import type { ReactNode } from "react"
import { slideNode, type TransitionValue } from "@airdesign/document"
import { changeDesign } from "@/design/design-change"
import { designShown } from "@/design-shown"
import { transitionCopy } from "@/copy/transition-copy"
import type { DesigningDeck } from "@/editor/live-design-panel"
import { SlideAnimate } from "@/editor/slide-animate"
import { designCopy } from "@/copy/design-copy"
import {
  arrivalsAt,
  currentSlide,
  sharedArrival,
  slideTargets,
  slideTargetsAt,
  type SlideArrival,
} from "@/editor/transition-value"

export function SlideDesignTabs({
  tab,
  onTab,
}: {
  tab: "design" | "animate"
  onTab: (tab: "design" | "animate") => void
}): ReactNode {
  const tabs = [
    ["design", transitionCopy.design],
    ["animate", transitionCopy.animate],
  ] as const
  return (
    <div role="tablist" aria-label={transitionCopy.transition} className="flex gap-1 px-4 pt-3">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          className={
            tab === id
              ? "rounded-[var(--shape-control)] bg-white px-2.5 py-1 text-[length:var(--type-caption)] shadow-[inset_0px_0px_0px_1px_var(--field-edge)]"
              : "rounded-[var(--shape-control)] px-2.5 py-1 text-[length:var(--type-caption)] text-quiet"
          }
          onClick={() => onTab(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function onAllSlides(deck: DesigningDeck, parts: ReadonlyMap<string, Uint8Array>) {
  return (value: TransitionValue) =>
    changeDesign(deck, () => {
      const nodes = slideTargets(parts)
      return nodes.length === 0 ? [] : { target: { nodes }, transition: { value } }
    })
}

export type SlideTab = { readonly tab: "design" | "animate"; readonly onTab: (tab: "design" | "animate") => void }

function Tabbed({ animate, design, tabs }: { animate: ReactNode; design: ReactNode; tabs: SlideTab }): ReactNode {
  const { tab, onTab: setTab } = tabs
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SlideDesignTabs tab={tab} onTab={setTab} />
      {tab === "animate" ? animate : design}
    </div>
  )
}

export function SlideSurface({
  deck,
  design,
  tabs,
}: {
  deck: DesigningDeck
  design: ReactNode
  tabs: SlideTab
}): ReactNode {
  const { shown } = deck
  const parts = shown.displayParts.current
  const painted = shown.canvases.current(shown.current)?.background ?? null
  const view = designShown(parts, shown.current, painted)
  if (view === null) return null
  const slide = currentSlide(parts, shown.current) ?? view.slide
  const [arrival] = arrivalsAt(parts, [shown.current])
  return (
    <Tabbed
      tabs={tabs}
      design={design}
      animate={
        <SlideAnimate
          arrival={arrival ?? ({ state: "kept" } satisfies SlideArrival)}
          head={designCopy.slide(view.number)}
          onSet={(value) =>
            changeDesign(deck, () => ({ target: { node: slideNode(slide, "slide") }, transition: { value } }))
          }
          onAll={onAllSlides(deck, parts)}
        />
      }
    />
  )
}

export function SlidesSurface({
  deck,
  indices,
  head,
  design,
  tabs,
}: {
  deck: DesigningDeck
  indices: readonly number[]
  head: string
  design: ReactNode
  tabs: SlideTab
}): ReactNode {
  const parts = deck.shown.displayParts.current
  return (
    <Tabbed
      tabs={tabs}
      design={design}
      animate={
        <SlideAnimate
          arrival={sharedArrival(arrivalsAt(parts, indices))}
          head={head}
          onSet={(value) =>
            changeDesign(deck, () => {
              const nodes = slideTargetsAt(parts, indices)
              return nodes.length === 0 ? [] : { target: { nodes }, transition: { value } }
            })
          }
          onAll={onAllSlides(deck, parts)}
        />
      }
    />
  )
}
