import { startTransition, useCallback, useState } from "react"
import * as doom from "@airdesign/doom"
import { measureDoom } from "@airdesign/render"
import { readLayoutPictures, warmLayoutPictures, type LayoutPictureSource } from "@/editor/layout-pictures"

export function useLayoutPictures(view: doom.Doom, slide: doom.NodeId | undefined): LayoutPictureSource {
  const { theme, size } = doom.deckOf(view)
  const fills = slide === undefined ? undefined : doom.propOf(view.nodes.get(slide), "fills")
  const pictures = typeof document === "undefined" ? null : readLayoutPictures(theme, size, fills)
  const [, refresh] = useState(0)
  const { w, h } = size
  const warm = useCallback(() => {
    if (typeof document === "undefined") return
    void warmLayoutPictures(theme, { w, h }, fills, (value) => measureDoom(document, value)).then(
      () => startTransition(() => refresh((tick) => tick + 1)),
      () => undefined,
    )
  }, [theme, w, h, fills])
  return { pictures, size: { w, h }, warm }
}
