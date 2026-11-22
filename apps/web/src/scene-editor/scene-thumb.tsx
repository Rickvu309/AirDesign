import { scene } from "@airdesign/document"
import { Filmstrip, SceneSlide } from "@airdesign/render"
import { memo, useRef } from "react"
import { sameSignature, slideSignature, type SlideSignature } from "./slide-signature"

const PaintedSlide = memo(SceneSlide)

function useStableView(view: scene.Scene, slide: scene.NodeId): scene.Scene {
  const held = useRef<{ view: scene.Scene; signature: SlideSignature; slide: scene.NodeId } | null>(null)
  const signature = slideSignature(view, slide)
  if (held.current === null || held.current.slide !== slide || !sameSignature(held.current.signature, signature))
    held.current = { view, signature, slide }
  return held.current.view
}

export function SceneThumb(props: {
  readonly view: scene.Scene
  readonly slide: scene.NodeId
  readonly width: number
  readonly className?: string
}) {
  const { width, slide } = props
  const painted = useStableView(props.view, slide)
  const { size } = scene.deckOf(painted)
  return (
    <Filmstrip
      width={width}
      height={Math.round((width * size.h) / size.w)}
      {...(props.className === undefined ? {} : { className: props.className })}
      paint={() => <PaintedSlide scene={painted} slide={slide} width={width} />}
    />
  )
}
