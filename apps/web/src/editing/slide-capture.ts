import * as doom from "@airdesign/doom"
import { DoomSlide, waitForDoomFonts } from "@airdesign/render"
import { createElement } from "react"
import { paintedElement, PictureFontError } from "./painted-picture"
import { jpegOf, pictureFit } from "./slide-pictures"
import type { SlideCapture } from "./slide-picture-report"

export async function captureSlide(
  view: doom.Doom,
  slide: doom.NodeId,
  assetUrl: (asset: string) => string | undefined,
): Promise<SlideCapture> {
  if (!(await waitForDoomFonts(document, view, [slide]))) return { failure: "fonts" }
  const { size } = doom.deckOf(view)
  const width = Math.min(pictureFit.width, size.w)
  const height = Math.ceil((width * size.h) / size.w)
  try {
    const { image } = await paintedElement(
      createElement(DoomSlide, { doom: view, slide, width, assetUrl }),
      width,
      height,
      true,
      (host) => host.querySelector("[data-fonts-pending]") === null,
    )
    return jpegOf(image, width, height)
  } catch (error) {
    if (error instanceof PictureFontError) return { failure: "fonts" }
    throw error
  }
}
