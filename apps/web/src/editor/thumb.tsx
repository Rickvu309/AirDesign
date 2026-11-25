import * as doom from "@airdesign/doom"
import { deckLocale, DoomSlide } from "@airdesign/render"
import { memo, useRef } from "react"
import { sameSignature, slideSignature, type SlideSignature } from "./slide-signature"

const PaintedSlide = memo(DoomSlide)

function useStableView(view: doom.Doom, slide: doom.NodeId): doom.Doom {
  const held = useRef<{ view: doom.Doom; signature: SlideSignature; locale: string; slide: doom.NodeId } | null>(null)
  const signature = slideSignature(view, slide)
  const locale = deckLocale(view)
  if (
    held.current === null ||
    held.current.slide !== slide ||
    held.current.locale !== locale ||
    !sameSignature(held.current.signature, signature)
  )
    held.current = { view, signature, slide, locale }
  return held.current.view
}

export function Thumb(props: {
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly width: number
  readonly assetUrl: (asset: string) => string | undefined
}) {
  const painted = useStableView(props.view, props.slide)
  return <PaintedSlide doom={painted} slide={props.slide} width={props.width} assetUrl={props.assetUrl} />
}
