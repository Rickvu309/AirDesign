import * as doom from "@airdesign/doom"
import { DoomSlide } from "@airdesign/render"
import { createElement } from "react"
import { paintedElement } from "@/editing/painted-picture"
import { jpegOf, pictureFit } from "@/slide-pictures"

export async function captureSlide(
  view: doom.Doom,
  slide: doom.NodeId,
  assetUrl: (asset: string) => string | undefined,
): Promise<string | null> {
  const { size } = doom.deckOf(view)
  const width = Math.min(pictureFit.width, size.w)
  const height = Math.ceil((width * size.h) / size.w)
  const { image } = await paintedElement(
    createElement(DoomSlide, { doom: view, slide, width, assetUrl }),
    width,
    height,
    true,
    (host) => host.querySelector("[data-fonts-pending]") === null,
  )
  return jpegOf(image, width, height)
}
