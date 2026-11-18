import { useState, type ReactNode } from "react"
import { slideNode } from "@airdesign/document"
import { changeDesign } from "@/design/design-change"
import { designShown } from "@/design-shown"
import { transitionCopy } from "@/copy/transition-copy"
import type { DesigningDeck } from "@/editor/live-design-panel"
import { SlideAnimate } from "@/editor/slide-animate"
import { currentSlide, slideTargets } from "@/editor/transition-value"

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
              ? "rounded-[var(--shape-control)] bg-white px-2.5 py-1 text-[length:var(--type-caption)] shadow-[0px_0px_0px_1px_var(--field-edge)]"
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

export function SlideSurface({ deck, design }: { deck: DesigningDeck; design: ReactNode }): ReactNode {
  const { shown } = deck
  const parts = shown.displayParts.current
  const painted = shown.canvases.current(shown.current)?.background ?? null
  const view = designShown(parts, shown.current, painted)
  const [tab, setTab] = useState<"design" | "animate">("design")
  if (view === null) return null
  const slide = currentSlide(parts, shown.current) ?? view.slide
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SlideDesignTabs tab={tab} onTab={setTab} />
      {tab === "animate" ? (
        <SlideAnimate
          parts={parts}
          index={shown.current}
          number={view.number}
          onSet={(value) =>
            changeDesign(deck, () => ({ target: { node: slideNode(slide, "slide") }, transition: { value } }))
          }
          onAll={(value) =>
            changeDesign(deck, () => {
              const nodes = slideTargets(parts)
              return nodes.length === 0 ? [] : { target: { nodes }, transition: { value } }
            })
          }
        />
      ) : (
        design
      )}
    </div>
  )
}
