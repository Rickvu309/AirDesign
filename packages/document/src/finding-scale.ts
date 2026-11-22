import { points, type Finding } from "./finding.js"
import type { ResolvedSlide } from "./resolved-slide.js"

export const typeSteps = [1, 0.9, 0.8, 0.7, 0.6] as const
export const scaleMark = "Heading"

const within = 0.05
const least = 8

export function scaleFindings(slide: ResolvedSlide): readonly Finding[] {
  const scale = slide.scale ?? []
  if (!scale.some((style) => style.name === scaleMark)) return []
  const named = scale.flatMap((style) =>
    typeSteps.map((step) => Math.max(least, Math.round(style.size * step * 100) / 100)),
  )
  return slide.elements.flatMap((element): readonly Finding[] => {
    if (element.from !== "slide" || element.text === null) return []
    const sizes = element.text.paragraphs.flatMap((paragraph) =>
      paragraph.runs.filter((run) => run.text.trim() !== "").map((run) => run.size),
    )
    const size = sizes.find((each) => !named.some((step) => Math.abs(step - each) <= within))
    if (size === undefined) return []
    const nearest = scale.reduce((best, style) => {
      const closer = Math.abs(style.size - size) - Math.abs(best.size - size)
      return closer < 0 || (closer === 0 && style.size < best.size) ? style : best
    })
    return [
      {
        slide: slide.slide,
        node: element.node,
        code: "off-scale",
        level: "note",
        size: points(size),
        style: nearest.name,
        fix: { size: nearest.size },
      },
    ]
  })
}
