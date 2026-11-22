import { scene } from "@airdesign/document"
import { SceneSlide } from "@airdesign/render"
import { createElement } from "react"
import { paintedElement } from "@/painted-picture"
import { jpegOf, pictureFit } from "@/slide-pictures"

export async function captureSlide(
  view: scene.Scene,
  slide: scene.NodeId,
  assetUrl: (asset: string) => string | undefined,
): Promise<string | null> {
  const { size } = scene.deckOf(view)
  const width = Math.min(pictureFit.width, size.w)
  const height = Math.ceil((width * size.h) / size.w)
  const { image } = await paintedElement(
    createElement(SceneSlide, { scene: view, slide, width, assetUrl }),
    width,
    height,
    true,
    (host) => host.querySelector("[data-fonts-pending]") === null,
  )
  return jpegOf(image, width, height)
}
