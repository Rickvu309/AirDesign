import {
  cycledColor,
  elementId,
  presentSlots,
  readSlideId,
  slideNode,
  type Color,
  type SetChange,
} from "@airdesign/document"
import { shownBackground } from "./fill-read.js"
import { readSlides } from "./read-shapes.js"
import { templateStyles } from "./template-style.js"
import { readTraits } from "./trait-read.js"
import { slideTheme } from "./theme-swatches.js"
import type { Parts } from "./xml-codec.js"

function schemeColor(color: Color | null | undefined): Color | null {
  return color !== null && color !== undefined && "scheme" in color ? color : null
}

export function remixTargets(parts: Parts, part: string): readonly SetChange[] {
  const slide = readSlides(parts).find((item) => item.part === part)?.slide
  const theme = slideTheme(parts, part)
  const style = theme === null ? undefined : templateStyles(parts).find((item) => item.id === theme)
  const slideId = slide === undefined ? undefined : readSlideId(slide)
  if (slide === undefined || style === undefined || slideId === undefined) return []
  const present = presentSlots(style.palette.slots)
  const traits = readTraits(parts)
  const objects: SetChange[] = []
  for (const [node, element] of traits.elements) {
    if (!node.startsWith(`${slide}.`)) continue
    const fillRead = element.reads.fill
    const fill =
      fillRead !== undefined && typeof fillRead.value === "object" && "color" in fillRead.value
        ? schemeColor(fillRead.value.color)
        : null
    const text = schemeColor(element.reads["text.color"]?.value)
    const nextFill = cycledColor(fill, present, style.palette.map)
    const nextText = cycledColor(text, present, style.palette.map)
    if (nextFill === null && nextText === null) continue
    objects.push({
      target: { node: elementId(node) },
      ...(nextFill === null ? {} : { fill: { value: { solid: nextFill } } }),
      ...(nextText === null ? {} : { text: { color: nextText } }),
    })
  }
  if (objects.length === 0) return []
  const background = shownBackground(parts, part)
  const nextBackground = cycledColor(
    background?.value !== null && background?.value !== undefined && "solid" in background.value
      ? schemeColor(background.value.solid)
      : null,
    present,
    style.palette.map,
  )
  return nextBackground === null
    ? objects
    : [...objects, { target: { node: slideNode(slideId, "slide") }, fill: { value: { solid: nextBackground } } }]
}
