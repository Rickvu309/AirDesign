import * as doom from "@airdesign/doom"
import type { ShownSlide } from "@/present/slide-shows"

export function arrivalOf(transition: doom.Props["transition"] | undefined): doom.Props["transition"] | null {
  if (transition === undefined || transition.kind === "none" || transition.ms === 0) return null
  return transition
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
