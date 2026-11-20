import { landedPatch, type IndexSlide, type NodeRegister } from "@airdesign/document"

export type SlideArrangement = Pick<IndexSlide, "transition" | "guides" | "layoutGuides">

export function slideArrangement(body: NodeRegister | undefined, indexed: IndexSlide | undefined): SlideArrangement {
  const patch = body === undefined ? {} : landedPatch(body, "text")
  const transitionEdit = patch.transition?.value
  const guidesEdit = patch.guides?.ruler
  const layoutEdit = patch.guides?.layout
  const transition = typeof transitionEdit === "object" ? transitionEdit.set : indexed?.transition
  const guides = typeof guidesEdit === "object" ? guidesEdit.set : indexed?.guides
  const layoutGuides = typeof layoutEdit === "object" ? layoutEdit.set : indexed?.layoutGuides
  return {
    ...(transition === undefined ? {} : { transition }),
    ...(guides === undefined || guides.length === 0 ? {} : { guides }),
    ...(layoutGuides === undefined || layoutGuides.length === 0 ? {} : { layoutGuides }),
  }
}
