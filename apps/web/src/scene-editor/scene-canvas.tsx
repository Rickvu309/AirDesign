import { orderKeyBetween, scene } from "@airdesign/document"
import { SlidePaint, TextOverride, useSceneSlide } from "@airdesign/render"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { CanvasOverlay, type Preview } from "./canvas-overlay"
import { ZoomControl } from "./zoom-control"
import { ThinNoticeView } from "@/thin-notice"
import { useScenePictures } from "./use-pictures"
import { useSlidePictures } from "./use-slide-pictures"
import { roomInset, scaleOf, scaleToFill, steppedScale, wheelScale, type Size, type Zoom } from "./canvas-view"
import { kept, type Rect, type Selection } from "./selection"
import { aroundPlaced, apply, geometryOf, invert, type Point, type SlideGeometry } from "./slide-geometry"
import { TextBar } from "./text-bar"
import { TextHost } from "./text-host"
import { useTextSession } from "./use-text-session"
import { propOf } from "./node-props"
import { useCanvasKeys } from "./use-canvas-keys"
import { useCanvasPointer, type DrawRequest, type Tool } from "./use-canvas-pointer"
import { chartWrites, drawWrites, iconWrites } from "./create-writes"
import { EditorToolbar, type RightPanel } from "./editor-toolbar"
import type { EditorClient } from "./use-scene-deck"
import type { ZoomKey } from "@/editor/canvas-zoom"
import { pictureCopy } from "@/copy/picture-copy"
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
  readonly panel: RightPanel
  readonly onPanel: (next: RightPanel) => void
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
  const [actionsOpen, setActionsOpen] = useState(false)
  const anchor = useRef<{ readonly point: Point; readonly at: Point } | null>(null)

  const { size } = scene.deckOf(view)
  const scale = scaleOf(zoom, room, size)
  const text = useTextSession(client, view)
  const shown = useMemo(() => {
    const edits = [
      ...(preview === null ? [] : [{ once: "preview", author, writes: preview.writes }]),
      ...(text.preview.length === 0 ? [] : [{ once: "text-preview", author, writes: text.preview }]),
    ]
    return edits.length === 0 ? view : scene.viewOf(view, edits)
  }, [view, preview, text.preview])
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

  const theme = scene.deckOf(shown).theme

  function leaveText() {
    const id = text.session?.node
    text.finish()
    if (id !== undefined) onSelection({ ids: [id], inside: null })
  }

  const drawn = useRef<scene.NodeId | null>(null)

  function slotIn(parent: scene.NodeId) {
    const siblings = view.children.get(parent) ?? []
    const last = siblings[siblings.length - 1]
    const lastAt = last === undefined ? null : (propOf(view.nodes.get(last), "parent")?.at ?? null)
    return { id: parent, at: orderKeyBetween(lastAt, null) }
  }

  function draw(request: DrawRequest): readonly scene.Write[] | null {
    const holder = request.chain?.filter((each) => view.nodes.get(each.id)?.type === "frame").at(-1)
    const parent = holder?.id ?? slide
    const local = (point: Point) => (holder === undefined ? point : apply(invert(holder.matrix), point))
    const from = local(request.from)
    const to = request.to === null ? null : local(request.to)
    if (tool === "text") {
      if (!request.commit) return null
      onTool("move")
      const style = theme.textStyles.body
      const box =
        to === null
          ? { x: Math.round(from.x), y: Math.round(from.y), w: 24, h: Math.round(style.size * style.lineHeight) }
          : {
              x: Math.round(Math.min(from.x, to.x)),
              y: Math.round(Math.min(from.y, to.y)),
              w: Math.max(8, Math.round(Math.abs(to.x - from.x))),
              h: Math.max(8, Math.round(Math.abs(to.y - from.y))),
            }
      const created = {
        id: client.mint(),
        parent: slotIn(parent),
        box: { ...box, rotation: 0, flipH: false, flipV: false },
      }
      text.beginNew(created, to === null ? "widthAndHeight" : "fixed")
      onSelection({ ids: [created.id], inside: null })
      return null
    }
    if (tool === "move" || tool === "hand") return null
    const id = (drawn.current ??= client.mint())
    const writes = drawWrites({
      id,
      parent: slotIn(parent),
      kind: tool,
      from,
      to,
      square: request.shift,
      center: request.alt,
    })
    if (!request.commit) return writes
    drawn.current = null
    onTool("move")
    if (client.push(writes).ok) onSelection({ ids: [id], inside: null })
    return null
  }

  function insertTarget() {
    const [only] = current.ids
    const placed = current.ids.length === 1 && only !== undefined ? geometry.byId.get(only) : undefined
    if (placed !== undefined && view.nodes.get(placed.id)?.type === "frame")
      return { parent: placed.id, inside: { w: placed.node.box.w, h: placed.node.box.h } }
    return { parent: slide, inside: size }
  }

  function inserted(id: scene.NodeId, writes: readonly scene.Write[]) {
    if (client.push(writes).ok) onSelection({ ids: [id], inside: null })
  }

  const inserts = {
    icon(name: string) {
      const { parent, inside } = insertTarget()
      const id = client.mint()
      inserted(id, iconWrites(id, slotIn(parent), name, inside))
    },
    chart(kind: scene.Chart["kind"]) {
      const { parent, inside } = insertTarget()
      const id = client.mint()
      inserted(id, chartWrites(id, slotIn(parent), inside, kind))
    },
  }

  const pictures = useScenePictures({
    deck: props.deck,
    client,
    view,
    slide,
    slideBox,
    scale,
    onPlaced: (id) => onSelection({ ids: [id], inside: null }),
  })

  useSlidePictures(client, pictures.assetUrl)

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
    tool,
    texting: text.session !== null,
    onTextEnd: leaveText,
    onTextEdit: (id, at) => text.begin(id, { kind: "point", x: at.x, y: at.y }),
    onDraw: draw,
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
    onEditText: (id) => text.begin(id, { kind: "all" }),
    onActions: () => setActionsOpen((open) => !open),
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
        onDragOver={pictures.over}
        onDrop={pictures.drop}
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
            <TextOverride.Provider
              value={(resolved) =>
                text.session !== null && resolved.id === text.session.node ? (
                  <TextHost node={resolved} theme={theme} api={text} onLeave={leaveText} />
                ) : null
              }
            >
              <SlidePaint
                nodes={painted.nodes ?? []}
                background={painted.background}
                size={size}
                width={size.w * scale}
                assetUrl={pictures.assetUrl}
                waiting={pictureCopy.uploading}
              />
            </TextOverride.Provider>
            <CanvasOverlay
              view={shown}
              preview={preview}
              geometry={geometry}
              selected={current.ids}
              hovered={hover}
              marquee={marquee}
              editing={text.session !== null}
              scale={scale}
              size={size}
            />
          </div>
        </div>
      </div>
      <ThinNoticeView notice={pictures.notice} onTryAgain={() => undefined} />
      <TextBar api={text} />
      <EditorToolbar
        tool={tool}
        onTool={onTool}
        actionsOpen={actionsOpen}
        onActionsOpen={setActionsOpen}
        run={{ chart: inserts.chart, icon: inserts.icon }}
        panel={props.panel}
        onPanel={props.onPanel}
      />
      <ZoomControl scale={scale} fitted={zoom === "fit"} onZoom={(next) => zoomTo(next)} />
    </>
  )
}
