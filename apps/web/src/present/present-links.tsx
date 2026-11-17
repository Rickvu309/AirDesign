import type { LinkTarget } from "@airdesign/document"
import type { ReactNode } from "react"
import { readSlides, shownLink, paintReader } from "@airdesign/pptx"

function activate(target: LinkTarget, destination: number, go: (index: number) => void) {
  if (target.kind === "slide") go(destination)
  else window.open(target.url, "_blank", "noopener,noreferrer")
}

export function PresentLinks({
  parts,
  index,
  width,
  go,
  children,
}: {
  parts: ReadonlyMap<string, Uint8Array>
  index: number
  width: number
  go: (index: number) => void
  children: ReactNode
}) {
  const slides = readSlides(parts)
  const slide = slides[index]
  if (slide === undefined) return children
  const size = paintReader(parts).slide(slide.part)
  const scale = width / size.width
  return (
    <div className="relative">
      {children}
      {size.elements.flatMap((shape) => {
        if (shape.from !== "slide" || shape.kind !== "p:sp" || shape.box === null) return []
        const target = shownLink(parts, { ...shape, slide: slide.slide })
        if (target === null || target.kind === "none" || target.kind === "unsupported") return []
        const destination = target.kind === "slide" ? slides.findIndex((each) => each.slide === target.slide) : -1
        if (target.kind === "slide" && destination < 0) return []
        return [
          <button
            key={shape.shape}
            type="button"
            aria-label={target.kind === "url" ? target.url : String(destination + 1)}
            className="absolute cursor-pointer bg-transparent"
            style={{
              transform: `rotate(${String(shape.box.rotation)}deg)`,
              left: shape.box.x * scale,
              top: shape.box.y * scale,
              width: shape.box.width * scale,
              height: shape.box.height * scale,
            }}
            onClick={(event) => {
              event.stopPropagation()
              activate(target, destination, go)
            }}
          />,
        ]
      })}
    </div>
  )
}
