import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { SlidePaint, useDoomSlide } from "@airdesign/render"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CanvasOverlay, type Preview } from "./canvas-overlay"
import { ThinNoticeView, type ThinNotice } from "./thin-notice"
import { AgentAtWork } from "./agent-at-work"
import type { AssetUrls } from "./use-asset-urls"
import { useDoomPictures } from "./use-pictures"
import { cropModeWrites, croppedPaint } from "./crop-drag"
import { usePictureNatural } from "./use-picture-natural"
import { useSlidePictures } from "./use-slide-pictures"
import { scaleToFill, steppedScale, wheelScale, type Size, type Zoom } from "./canvas-view"
import { kept, type Rect, type Selection } from "./selection"
import { aroundPlaced, apply, geometryOf, invert, type Point, type SlideGeometry } from "./slide-geometry"
import { TextBar } from "./text-bar"
import { TextHost } from "./text-host"
import { linkedWords, type LinkedWords } from "./text-edit"
import { useTextSession } from "./use-text-session"
import { propOf } from "@airdesign/doom"
import { useCanvasKeys } from "./use-canvas-keys"
import { useCanvasPointer, type DrawRequest, type Tool } from "./use-canvas-pointer"
import { chartArea, chartWrites, drawWrites, iconSwapWrites, iconWrites } from "./create-writes"
import { EditorToolbar, type RightPanel } from "./editor-toolbar"
import type { ShapesShown } from "@/editor/shape-tool"
import type { EditorClient } from "./use-deck"
import { canvasInset, slideTop, type ZoomKey } from "@/editing/canvas-zoom"
import { slideFrame } from "@/editor/slide-frame"
import { pictureCopy } from "@/copy/picture-copy"
import { editorCopy } from "@/copy/editor-copy"

const estimate = doom.measureWith({})
const author: doom.Author = { kind: "person", id: "preview" }
const emptyGeometry: SlideGeometry = { roots: [], byId: new Map() }

export type CanvasCommands = {
  zoomTo: (zoom: Zoom) => void
  zoomSelection: (() => void) | null
  linkWords: (link: string | null) => void
}

export type CaretWords = LinkedWords & { readonly node: doom.NodeId }

export function DoomCanvas(props: {
  readonly deck: string
  readonly assets: AssetUrls
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly editingRuns: ReadonlySet<string>
  readonly selection: Selection
  readonly onSelection: (next: Selection) => void
  readonly tool: Tool
  readonly onTool: (tool: Tool) => void
  readonly panel: RightPanel
  readonly onPanel: (next: RightPanel) => void
  readonly zoom: Zoom
  readonly scale: number
  readonly room: Size
  readonly overlay: number
  readonly slideNumber: number
  readonly onZoom: (zoom: Zoom) => void
  readonly onCommands: (commands: CanvasCommands | null) => void
  readonly toolbarHost: HTMLElement | null
  readonly editing?: doom.NodeId
  readonly shapes?: ShapesShown
  readonly notice: ThinNotice | null
  readonly onTryAgain: (notice: ThinNotice) => void
  readonly onTyping?: (writes: readonly doom.Write[], slide: doom.NodeId | undefined) => void
  readonly onExport: () => void
  readonly onWords?: (words: CaretWords | null) => void
  readonly cropping: doom.NodeId | null
  readonly onCropping: (id: doom.NodeId | null) => void
}) {
  const { client, view, slide, selection, onSelection, tool, onTool, zoom, scale, room, overlay } = props
  const stage = useRef<HTMLDivElement>(null)
  const slideBox = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Size>({ w: 0, h: 0 })
  const [space, setSpace] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [hover, setHover] = useState<doom.NodeId | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const anchor = useRef<{ readonly point: Point; readonly at: Point } | null>(null)

  const { size } = doom.deckOf(view)
  const text = useTextSession(client, view)
  const editingFirst = useRef(props.editing)
  useEffect(() => {
    const node = editingFirst.current
    editingFirst.current = undefined
    if (node !== undefined) text.begin(node, { kind: "all" })
  }, [text])
  const { onTyping, onWords } = props
  const typedOn =
    text.session === null ? undefined : doom.slideOf(view, text.session.created?.parent.id ?? text.session.node)
  useEffect(() => onTyping?.(text.preview, typedOn), [onTyping, text.preview, typedOn])
  const session = text.session
  const words = session === null ? null : linkedWords(session.draft, session.anchor, session.focus)
  const caret = session === null || words === null ? null : { ...words, node: session.node }
  const caretKey = caret === null ? "" : JSON.stringify(caret)
  useEffect(() => onWords?.(caret), [onWords, caretKey])
  const shown = useMemo(() => {
    const edits = [
      ...(preview === null ? [] : [{ once: "preview", author, writes: preview.writes }]),
      ...(text.preview.length === 0 ? [] : [{ once: "text-preview", author, writes: text.preview }]),
    ]
    return edits.length === 0 ? view : doom.viewOf(view, edits)
  }, [view, preview, text.preview])
  const painted = useDoomSlide(shown, slide)
  const geometry = useMemo(() => (painted.nodes === null ? emptyGeometry : geometryOf(painted.nodes)), [painted.nodes])
  const current = kept(selection, geometry)
  const panning = space || tool === "hand"

  useEffect(() => {
    const element = stage.current
    if (element === null) return
    const measure = () => setBox({ w: element.clientWidth, h: element.clientHeight })
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
    props.onZoom(next)
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

  const theme = doom.deckOf(shown).theme
  const slides = useMemo(() => doom.slidesOf(view).map((each) => each.id), [view])

  function leaveText() {
    const id = text.session?.node
    text.finish()
    if (id !== undefined) onSelection({ ids: [id], inside: null })
  }

  const drawn = useRef<doom.NodeId | null>(null)

  function slotIn(parent: doom.NodeId) {
    const siblings = view.children.get(parent) ?? []
    const last = siblings[siblings.length - 1]
    const lastAt = last === undefined ? null : (propOf(view.nodes.get(last), "parent")?.at ?? null)
    return { id: parent, at: orderKeyBetween(lastAt, null) }
  }

  function draw(request: DrawRequest): readonly doom.Write[] | null {
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

  function anchorOf(parent: doom.NodeId) {
    const [only] = current.ids
    const box =
      parent === slide && current.ids.length === 1 && only !== undefined ? geometry.byId.get(only)?.node.box : undefined
    return box === undefined ? undefined : { x: box.x, y: box.y, w: box.w, h: box.h }
  }

  function inserted(id: doom.NodeId, writes: readonly doom.Write[]) {
    if (client.push(writes).ok) onSelection({ ids: [id], inside: null })
  }

  const pictures = useDoomPictures({
    deck: props.deck,
    client,
    ...props.assets,
    slide,
    slideBox,
    scale,
    onPlaced: (id) => onSelection({ ids: [id], inside: null }),
  })

  const inserts = {
    icon(name: string) {
      const swapped = iconSwapWrites(view, current.ids, name)
      if (swapped !== null) {
        client.push(swapped)
        return
      }
      const { parent, inside } = insertTarget()
      const id = client.mint()
      inserted(id, iconWrites(view, id, slotIn(parent), name, inside, anchorOf(parent)))
    },
    chart(kind: doom.Chart["kind"]) {
      const { parent, inside } = insertTarget()
      const id = client.mint()
      inserted(id, chartWrites(id, slotIn(parent), chartArea(view, parent, inside, anchorOf(parent)), kind))
    },
    picture(file: File) {
      pictures.add(file)
    },
  }

  const latestInserts = useRef(inserts)
  useLayoutEffect(() => {
    latestInserts.current = inserts
  })
  const latestExport = useRef(props.onExport)
  useEffect(() => {
    latestExport.current = props.onExport
  })
  const run = useMemo(
    () => ({
      chart: (kind: doom.Chart["kind"]) => latestInserts.current.chart(kind),
      icon: (name: string) => latestInserts.current.icon(name),
      picture: (file: File) => latestInserts.current.picture(file),
      exportPdf: () => latestExport.current(),
    }),
    [],
  )

  useSlidePictures(client, pictures.assetUrl)

  const { cropping, onCropping } = props
  const [lone] = current.ids
  const cropNode =
    cropping !== null && current.ids.length === 1 && lone === cropping && croppedPaint(view, cropping) !== null
      ? cropping
      : null
  useEffect(() => {
    if (cropping !== null && cropNode === null) onCropping(null)
  }, [cropping, cropNode, onCropping])
  const cropAsset = cropNode === null ? undefined : croppedPaint(view, cropNode)?.asset
  const cropUrl = cropAsset === undefined ? undefined : pictures.assetUrl(cropAsset)
  const natural = usePictureNatural(cropUrl)
  const crop = cropNode === null ? null : { node: cropNode, natural }

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
    crop,
    onCrop: (id) => {
      client.push(cropModeWrites(view, id))
      onCropping(id)
    },
    onCropEnd: () => onCropping(null),
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
    dragging: pointer.dragging,
    onEditText: (id) => text.begin(id, { kind: "all" }),
    onActions: () => setActionsOpen((open) => !open),
    cropping: cropNode !== null,
    onCropEnd: () => onCropping(null),
    measure: painted.measure ?? estimate,
  })

  useLayoutEffect(() => {
    props.onCommands({
      zoomTo: (next) => zoomTo(next),
      zoomSelection: current.ids.length === 0 ? null : () => onZoomKey("selection"),
      linkWords: (link) => text.link(link),
    })
    return () => props.onCommands(null)
  })

  const slideW = size.w * scale
  const slideH = size.h * scale
  const width = Math.max(box.w, slideW + 2 * canvasInset.side)
  const height = Math.max(box.h, slideH + 2 * canvasInset.gap + overlay)
  const left = (width - slideW) / 2
  const top = slideTop({ height, overlay, slide: slideH })
  return (
    <>
      <div
        ref={stage}
        data-canvas-stage=""
        data-canvas-fit={zoom === "fit" ? "true" : "false"}
        data-editor-stage=""
        data-editor-ready={painted.ready ? props.deck : undefined}
        aria-label={editorCopy.canvas}
        role="application"
        tabIndex={0}
        className="absolute inset-0 touch-none overflow-auto bg-canvas outline-none select-none"
        style={{
          cursor: panning ? "grab" : "default",
          ["--focus-ring-offset" as string]: "calc(-1 * var(--focus-ring-width))",
        }}
        onPointerDown={(event) => {
          event.currentTarget.dataset.pointerFocus = ""
          pointer.down(event)
        }}
        onBlur={(event) => {
          const next = event.relatedTarget
          if (!(next instanceof Node && event.currentTarget.contains(next)))
            delete event.currentTarget.dataset.pointerFocus
        }}
        onPointerMove={pointer.move}
        onPointerUp={pointer.up}
        onPointerCancel={pointer.cancel}
        onDoubleClick={pointer.double}
        onDragOver={pictures.over}
        onDrop={pictures.drop}
      >
        <div style={{ position: "relative", width, height }}>
          <div data-slide-wrapper="" style={{ position: "absolute", left, top, width: slideW, height: slideH }}>
            <span
              className="absolute inset-x-0 bottom-full mb-3 flex items-end justify-between gap-4 text-[length:var(--type-dense)] text-quiet"
              data-slide-label=""
            >
              {props.slideNumber}
              <AgentAtWork
                view={props.view}
                editing={props.editingRuns}
                slide={props.slide}
                onOpen={() => props.onPanel("agent")}
              />
            </span>
            <div ref={slideBox} data-slide-box="" className={slideFrame} style={{ position: "absolute", inset: 0 }}>
              <SlidePaint
                nodes={painted.nodes ?? []}
                background={painted.background}
                size={size}
                width={size.w * scale}
                assetUrl={pictures.assetUrl}
                waiting={pictureCopy.uploading}
                iconsReady={painted.ready}
                {...(text.session === null
                  ? {}
                  : {
                      host: {
                        id: text.session.node,
                        render: (resolved) => (
                          <TextHost
                            deck={props.deck}
                            slides={slides}
                            node={resolved}
                            theme={theme}
                            api={text}
                            onLeave={leaveText}
                          />
                        ),
                      },
                    })}
              />
              <CanvasOverlay
                view={shown}
                preview={preview}
                geometry={geometry}
                selected={current.ids}
                hovered={hover}
                marquee={marquee}
                editing={text.session !== null}
                crop={crop}
                cropUrl={cropUrl}
                scale={scale}
                size={size}
              />
            </div>
          </div>
        </div>
      </div>
      <ThinNoticeView
        notice={pictures.notice ?? (text.refused ? "text-refused" : props.notice)}
        onTryAgain={props.onTryAgain}
      />
      <TextBar api={text} />
      {props.toolbarHost === null
        ? null
        : createPortal(
            <EditorToolbar
              tool={tool}
              onTool={onTool}
              actionsOpen={actionsOpen}
              onActionsOpen={setActionsOpen}
              run={run}
              panel={props.panel}
              onPanel={props.onPanel}
              {...(props.shapes === undefined ? {} : { shapes: props.shapes })}
            />,
            props.toolbarHost,
          )}
    </>
  )
}
