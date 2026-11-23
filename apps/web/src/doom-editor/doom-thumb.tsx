import * as doom from "@airdesign/doom"
import { DoomSlide } from "@airdesign/render"
import { memo, useRef } from "react"
import { sameSignature, slideSignature, type SlideSignature } from "./slide-signature"

const PaintedSlide = memo(DoomSlide)

function useStableView(view: doom.Doom, slide: doom.NodeId): doom.Doom {
  const held = useRef<{ view: doom.Doom; signature: SlideSignature; slide: doom.NodeId } | null>(null)
  const signature = slideSignature(view, slide)
  if (held.current === null || held.current.slide !== slide || !sameSignature(held.current.signature, signature))
    held.current = { view, signature, slide }
  return held.current.view
}

export function DoomThumb(props: {
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly width: number
  readonly assetUrl: (asset: string) => string | undefined
}) {
  const painted = useStableView(props.view, props.slide)
  return <PaintedSlide doom={painted} slide={props.slide} width={props.width} assetUrl={props.assetUrl} />
}
