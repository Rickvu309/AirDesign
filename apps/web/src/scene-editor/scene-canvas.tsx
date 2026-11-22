import { scene } from "@airdesign/document"
import { SlidePaint, useSceneSlide } from "@airdesign/render"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { CanvasOverlay, type Preview } from "./canvas-overlay"
import { ZoomControl } from "./zoom-control"
import { roomInset, scaleOf, scaleToFill, steppedScale, wheelScale, type Size, type Zoom } from "./canvas-view"
import { kept, type Rect, type Selection } from "./selection"
import { aroundPlaced, geometryOf, type Point, type SlideGeometry } from "./slide-geometry"
import { useCanvasKeys } from "./use-canvas-keys"
import { useCanvasPointer, type Tool } from "./use-canvas-pointer"
import type { EditorClient } from "./use-scene-deck"
import type { ZoomKey } from "@/editor/canvas-zoom"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"

const author: scene.Author = { kind: "person", id: "preview" }
const emptyGeometry: SlideGeometry = { roots: [], byId: new Map() }

export function SceneCanvas(props: {
  readonly deck: string
  readonly client: EditorClient
  readonly view: scene.Scene
  readonly slide: scene.NodeId
  readonly selection: Selection
  readonly onSelection: (next: Selection) => void
  readonly tool: Tool
  readonly onTool: (tool: Tool) => void
}) {
  const { client, view, slide, selection, onSelection, tool, onTool } = props
  const stage = useRef<HTMLDivElement>(null)
  const slideBox = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState<Size>({ w: 0, h: 0 })
  const [zoom, setZoom] = useState<Zoom>("fit")
  const [space, setSpace] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [hover, setHover] = useState<scene.NodeId | null>(null)
  const anchor = useRef<{ readonly point: Point; readonly at: Point } | null>(null)

  const { size } = scene.deckOf(view)
  const scale = scaleOf(zoom, room, size)
  const shown = useMemo(
    () => (preview === null ? view : scene.viewOf(view, [{ once: "preview", author, writes: preview.writes }])),
    [view, preview],
  )
  const painted = useSceneSlide(shown, slide)
  const geometry = useMemo(() => (painted.nodes === null ? emptyGeometry : geometryOf(painted.nodes)), [painted.nodes])
  const current = kept(selection, geometry)
  const panning = space || tool === "hand"

  useEffect(() => {
    const element = stage.current
    if (element === null) return
    const measure = () => setRoom({ w: element.clientWidth, h: element.clientHeight })
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(element)
    return () => watcher.disconnect()
  }, [])

  function zoomTo(next: Zoom, about?: { readonly clientX: number; readonly clientY: number }, point?: Point) {
    const element = stage.current
    const paper = slideBox.current
    if (element !== null && paper !== null) {
      const rect = element.getBoundingClientRect()
      const at =
        about === undefined
          ? { x: rect.width / 2, y: rect.height / 2 }
          : { x: about.clientX - rect.left, y: about.clientY - rect.top }
      const box = paper.getBoundingClientRect()
      anchor.current = {
        point: point ?? { x: (rect.left + at.x - box.left) / scale, y: (rect.top + at.y - box.top) / scale },
        at,
      }
    }
    setZoom(next)
  }

  useLayoutEffect(() => {
    const held = anchor.current
    const element = stage.current
    const paper = slideBox.current
    anchor.current = null
    if (held === null || element === null || paper === null) return
    const rect = element.getBoundingClientRect()
    const box = paper.getBoundingClientRect()
    element.scrollLeft += box.left + held.point.x * scale - (rect.left + held.at.x)
    element.scrollTop += box.top + held.point.y * scale - (rect.top + held.at.y)
  }, [scale])

  useEffect(() => {
    const element = stage.current
    if (element === null) return
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      zoomTo(wheelScale(scale, event.deltaY), event)
    }
    element.addEventListener("wheel", wheel, { passive: false })
    return () => element.removeEventListener("wheel", wheel)
  })

  const pointer = useCanvasPointer({
    stage,
    slideBox,
    client,
    view,
    geometry,
    selection: current,
    onSelection,
    scale,
    size,
    panning,
    setPreview,
    setMarquee,
    setHover,
  })

  function onZoomKey(key: ZoomKey) {
    if (key === "fit") zoomTo("fit")
    else if (key === "actual") zoomTo(1)
    else if (key === "in" || key === "out") zoomTo(steppedScale(scale, key === "in" ? 1 : -1))
    else {
      const frame = aroundPlaced(current.ids.flatMap((id) => geometry.byId.get(id) ?? []))
      if (frame === null) return
      zoomTo(scaleToFill(room, { w: frame.right - frame.left, h: frame.bottom - frame.top }), undefined, {
        x: (frame.left + frame.right) / 2,
        y: (frame.top + frame.bottom) / 2,
      })
    }
  }

  useCanvasKeys({
    client,
    view,
    geometry,
    selection: current,
    slide,
    onSelection,
    onTool,
    onZoom: onZoomKey,
    onSpace: setSpace,
    cancelDrag: pointer.cancelDrag,
  })

  const pad = roomInset
  const width = Math.max(room.w, size.w * scale + 2 * pad)
  const height = Math.max(room.h, size.h * scale + 2 * pad)
  return (
    <>
      <div
        ref={stage}
        data-scene-stage=""
        data-scene-ready={painted.ready ? props.deck : undefined}
        aria-label={sceneEditorCopy.canvas}
        role="application"
        tabIndex={0}
        className="relative min-h-0 flex-1 touch-none overflow-auto bg-canvas outline-none select-none"
        style={{ cursor: panning ? "grab" : "default" }}
        onPointerDown={pointer.down}
        onPointerMove={pointer.move}
        onPointerUp={pointer.up}
        onPointerCancel={pointer.cancel}
        onPointerLeave={pointer.leave}
        onDoubleClick={pointer.double}
      >
        <div style={{ position: "relative", width, height }}>
          <div
            ref={slideBox}
            data-slide-box=""
            className="shadow-card"
            style={{
              position: "absolute",
              left: (width - size.w * scale) / 2,
              top: (height - size.h * scale) / 2,
              width: size.w * scale,
              height: size.h * scale,
            }}
          >
            <SlidePaint
              nodes={painted.nodes ?? []}
              background={painted.background}
              size={size}
              width={size.w * scale}
            />
            <CanvasOverlay
              view={shown}
              preview={preview}
              geometry={geometry}
              selected={current.ids}
              hovered={hover}
              marquee={marquee}
              scale={scale}
              size={size}
            />
          </div>
        </div>
      </div>
      <ZoomControl scale={scale} fitted={zoom === "fit"} onZoom={(next) => zoomTo(next)} />
    </>
  )
}
