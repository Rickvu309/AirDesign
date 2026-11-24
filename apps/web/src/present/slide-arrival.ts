import * as doom from "@airdesign/doom"
import type { SlideTransition } from "@airdesign/pptx"
import type { ShownSlide } from "@/present/slide-shows"

export function arrivalOf(transition: doom.Props["transition"] | undefined): SlideTransition | null {
  if (transition === undefined || transition.kind === "none" || transition.ms === 0) return null
  if (transition.kind === "fade") return { kind: "fade", direction: null, duration: transition.ms }
  if (transition.kind === "push") return { kind: "push", direction: "l", duration: transition.ms }
  return { kind: "morph", direction: null, duration: transition.ms }
}

export function showsOf(view: doom.Doom, slides: readonly doom.NodeId[]): readonly ShownSlide[] {
  return slides.map((id) => {
    const node = view.nodes.get(id)
    return {
      hidden: doom.propOf(node, "skipped") === true,
      transition: arrivalOf(doom.propOf(node, "transition")),
      advance: null,
    }
  })
}
