import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { deckLocale, useDoomSlide } from "@airdesign/render"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react"
import type { Flight, GridCarry } from "./canvas-carry"
import type { Preview } from "./canvas-overlay"
import type { ThinNotice } from "./thin-notice"
import { CanvasStage } from "./canvas-stage"
import type { AssetUrls } from "./use-asset-urls"
import { useDoomPictures } from "./use-pictures"
import { cropModeWrites, croppedPaint } from "./crop-drag"
import { usePictureNatural } from "./use-picture-natural"
import { useSlidePictures } from "./use-slide-pictures"
import { anchorOffset, type ZoomAnchor } from "./canvas-anchor"
import { scaleOf, scaleToFill, steppedScale, wheelScale, type Size, type Zoom } from "./canvas-view"
import { kept, type Rect, type Selection } from "./selection"
import { aroundPlaced, apply, geometryOf, invert, type Point, type SlideGeometry } from "./slide-geometry"
import { linkedWords, type LinkedWords } from "./text-edit"
import { useTextSession } from "./use-text-session"
import { propOf } from "@airdesign/doom"
import { useCanvasKeys } from "./use-canvas-keys"
import { unpanned, useCanvasPan } from "./use-canvas-pan"
import { useCanvasPointer, type DrawRequest, type Tool } from "./use-canvas-pointer"
import type { ActionRun, ChartInsert } from "./actions-popover"
import {
  chartArea,
  componentInsertWrites,
  insertionTarget,
  drawWrites,
  iconSwapWrites,
  iconWrites,
} from "./create-writes"
import type { RightPanel } from "./editor-toolbar"
import type { ShapesShown } from "@/editor/shape-tool"
import type { EditorClient } from "./use-deck"
import { canvasInset, type ZoomKey } from "@/editing/canvas-zoom"

const author: doom.Author = { kind: "person", id: "preview" }
const emptyGeometry: SlideGeometry = { roots: [], byId: new Map() }

export type CanvasCommands = {
  zoomTo: (zoom: Zoom) => void
  zoomSelection: (() => void) | null
  linkWords: (link: string | null) => void
}

export type CaretWords = LinkedWords & { readonly node: doom.NodeId }

export type CanvasHandoff = {
  down: (event: PointerEvent<HTMLDivElement>) => void
  editAt: (event: MouseEvent<HTMLDivElement>) => void
  cancel: () => boolean
}

export type CanvasCard = {
  readonly handoff: RefObject<CanvasHandoff | null>
  readonly onBlank: () => void
  readonly onMode: (mode: "elements" | "text") => void
  readonly onRun: (run: ActionRun) => void
  readonly pointAt?: (client: { readonly x: number; readonly y: number }) => { readonly x: number; readonly y: number }
  readonly carry?: GridCarry
}

const idleRun: ActionRun = {
  chart: null,
  icon: () => undefined,
  picture: () => undefined,
  exportPdf: () => undefined,
}

export type CanvasProps = {
  readonly deck: string
  readonly assets: AssetUrls
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly measure: doom.Measure | null
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
  readonly viewport: Size | null
  readonly overlay: number
  readonly slideNumber: number
  readonly onZoom: (zoom: Zoom) => void
  readonly onCommands: (commands: CanvasCommands | null) => void
  readonly toolbarHost: HTMLElement | null
  readonly actionsOpen: boolean
  readonly onActionsOpen: (open: boolean) => void
  readonly editing?: doom.NodeId
  readonly shapes?: ShapesShown
  readonly notice: ThinNotice | null
  readonly onTryAgain: (notice: ThinNotice) => void
  readonly onTyping?: (writes: readonly doom.Write[], slide: doom.NodeId | undefined) => void
  readonly onExport: () => void
  readonly onWords?: (words: CaretWords | null) => void
  readonly cropping: doom.NodeId | null
  readonly onCropping: (id: doom.NodeId | null) => void
  readonly card?: CanvasCard
}

export function DoomCanvas(props: CanvasProps) {
  const { client, view, slide, selection, onSelection, tool, onTool, zoom, scale, room, overlay } = props
  const stage = useRef<HTMLDivElement>(null)
  const slideBox = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [hover, setHover] = useState<doom.NodeId | null>(null)
  const { actionsOpen, onActionsOpen: setActionsOpen } = props
  const anchor = useRef<ZoomAnchor | null>(null)

  const { size } = doom.deckOf(view)
  const viewport = props.viewport
  const content = {
    w: viewport === null ? size.w * scale : Math.max(viewport.w, size.w * scale + 2 * canvasInset.side),
    h: viewport === null ? size.h * scale : Math.max(viewport.h, size.h * scale + 2 * canvasInset.gap + overlay),
  }
  const pan = useCanvasPan(stage, viewport, content)
  const text = useTextSession(client, view, props.measure)
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
  useEffect(
    () => () => {
      onTyping?.([], undefined)
      onWords?.(null)
    },
    [onTyping, onWords],
  )
  const session = text.session
  const words = session === null ? null : linkedWords(session.draft, session.anchor, session.focus)
  const caret = session === null || words === null ? null : { ...words, node: session.node }
  const caretKey = caret === null ? "" : JSON.stringify(caret)
  useEffect(() => onWords?.(caret), [onWords, caretKey])
  const shown = useMemo(() => {
    const transform = preview?.kind === "transform" ? doom.componentEditPreview(view, preview.writes) : null
    const start = transform === null || doom.isRefusal(transform) ? view : transform.view
    const edits = [
      ...(preview === null || start !== view ? [] : [{ once: "preview", author, writes: preview.writes }]),
      ...(text.preview.length === 0 ? [] : [{ once: "text-preview", author, writes: text.preview }]),
    ]
    if (edits.length === 0) return start
    const shown = doom.viewOf(start, edits)
    const layer = preview === null ? text.preview.find(({ prop }) => prop === "text")?.node : undefined
    if (layer !== undefined) deckLocale(shown, { before: view, layer })
    return shown
  }, [view, preview, text.preview])
  const painted = useDoomSlide(shown, slide, 1)
  const geometry = useMemo(() => (painted.nodes === null ? emptyGeometry : geometryOf(painted.nodes)), [painted.nodes])
  const current = kept(selection, geometry)
  const panning = space || tool === "hand"

  function zoomTo(next: Zoom, about?: { readonly clientX: number; readonly clientY: number }, point?: Point) {
    const element = stage.current
    const paper = slideBox.current
    if (next === "fit") {
      anchor.current = null
      pan.moveTo(unpanned)
    } else if (element !== null && paper !== null) {
      const rect = element.getBoundingClientRect()
      const at =
        about !== undefined
          ? { x: about.clientX - rect.left, y: about.clientY - rect.top }
          : point !== undefined
            ? { x: canvasInset.side + room.w / 2, y: canvasInset.gap + room.h / 2 }
            : { x: rect.width / 2, y: rect.height / 2 }
      const box = paper.getBoundingClientRect()
      const held = {
        point: point ?? { x: (rect.left + at.x - box.left) / scale, y: (rect.top + at.y - box.top) / scale },
        at,
      }
      if (scaleOf(next, room, size) === scale) pan.moveTo(anchorOffset(element, paper, held, scale, pan.position()))
      else anchor.current = held
    }
    props.onZoom(next)
  }

  useLayoutEffect(() => {
    const held = anchor.current
    const element = stage.current
    const paper = slideBox.current
    anchor.current = null
    if (held === null || element === null || paper === null) return
    pan.moveTo(anchorOffset(element, paper, held, scale, pan.position()))
  }, [scale])

  useEffect(() => {
    if (viewport === null) return
    const element = stage.current
    if (element === null) return
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        zoomTo(wheelScale(scale, event.deltaY), event)
        return
      }
      event.preventDefault()
      const mode = event.deltaMode
      const horizontal = event.shiftKey && event.deltaX === 0
      const dx = horizontal ? event.deltaY : event.deltaX
      const dy = horizontal ? 0 : event.deltaY
      const line = 40
      const { x, y } = pan.position()
      pan.moveTo({
        x: x - dx * (mode === WheelEvent.DOM_DELTA_PAGE ? viewport.w : mode === WheelEvent.DOM_DELTA_LINE ? line : 1),
        y: y - dy * (mode === WheelEvent.DOM_DELTA_PAGE ? viewport.h : mode === WheelEvent.DOM_DELTA_LINE ? line : 1),
      })
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
    const local = (point: Point) => (holder === undefined ? point : apply(invert(holder.content), point))
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
      const { parent, inside, anchor } = insertionTarget(view, { slide, size, geometry, selected: current.ids })
      const id = client.mint()
      inserted(id, iconWrites(view, id, slotIn(parent), name, inside, anchor))
    },
    chart(chart: ChartInsert) {
      if (props.measure === null) return
      const { parent, inside, anchor } = insertionTarget(view, {
        slide,
        size,
        geometry,
        selected: current.ids,
      })
      const made = componentInsertWrites(view, {
        parent,
        area: chartArea(view, parent, inside, anchor),
        component: chart.component,
        ...("variant" in chart ? { variant: chart.variant } : {}),
        mint: () => client.mint(),
        measure: props.measure,
      })
      if (made !== null && client.push(made.writes, { read: view }).ok) onSelection({ ids: [made.id], inside: null })
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
      chart: props.measure === null ? null : (chart: ChartInsert) => latestInserts.current.chart(chart),
      icon: (name: string) => latestInserts.current.icon(name),
      picture: (file: File) => latestInserts.current.picture(file),
      exportPdf: () => latestExport.current(),
    }),
    [props.measure === null],
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
    pan,
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
    slide,
    setFlight,
    ...(props.card === undefined ? {} : { onBlank: props.card.onBlank }),
    ...(props.card?.pointAt === undefined ? {} : { pointAt: props.card.pointAt }),
    ...(props.card?.carry === undefined ? {} : { carry: props.card.carry }),
  })

  const wasText = useRef(false)
  useLayoutEffect(() => {
    const card = props.card
    if (card === undefined) return
    const texting = text.session !== null
    card.onMode(texting ? "text" : "elements")
    if (wasText.current && !texting) stage.current?.focus({ preventScroll: true })
    wasText.current = texting
  })
  useLayoutEffect(() => {
    const card = props.card
    if (card === undefined) return
    card.handoff.current = {
      down: (event) => pointer.down(event),
      editAt: (event) => pointer.double(event),
      cancel: () => pointer.cancelDrag(),
    }
    return () => {
      card.handoff.current = null
    }
  })
  useLayoutEffect(() => {
    const onRun = props.card?.onRun
    if (onRun === undefined) return
    onRun(run)
    return () => onRun(idleRun)
  }, [props.card?.onRun, run])

  function onZoomKey(key: ZoomKey) {
    if (props.card !== undefined) return
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
    onActions: () => setActionsOpen(!actionsOpen),
    cropping: cropNode !== null,
    onCropEnd: () => onCropping(null),
  })

  useLayoutEffect(() => {
    props.onCommands({
      zoomTo: (next) => zoomTo(next),
      zoomSelection: current.ids.length === 0 ? null : () => onZoomKey("selection"),
      linkWords: (link) => text.link(link),
    })
    return () => props.onCommands(null)
  })

  return (
    <CanvasStage
      placed={props.card !== undefined}
      stage={stage}
      slideBox={slideBox}
      zoom={zoom}
      deck={props.deck}
      ready={painted.ready}
      panning={panning}
      scale={scale}
      size={size}
      content={content}
      panLayer={pan.layer}
      overlay={overlay}
      slideNumber={props.slideNumber}
      view={view}
      shown={shown}
      editingRuns={props.editingRuns}
      slide={slide}
      onPanel={props.onPanel}
      geometry={geometry}
      selected={current}
      onSelection={onSelection}
      client={client}
      nodes={painted.nodes ?? []}
      background={painted.background}
      assetUrl={pictures.assetUrl}
      session={text.session}
      text={text}
      slides={slides}
      theme={theme}
      onLeave={leaveText}
      caught={client.caught}
      preview={preview}
      flight={flight}
      hover={hover}
      marquee={marquee}
      crop={crop}
      cropUrl={cropUrl}
      onPointerDown={pointer.down}
      onPointerMove={pointer.move}
      onPointerUp={pointer.up}
      onPointerCancel={pointer.cancel}
      onDoubleClick={pointer.double}
      onDragOver={pictures.over}
      onDrop={pictures.drop}
      pictureNotice={pictures.notice}
      textRefused={text.refused}
      notice={props.notice}
      onTryAgain={props.onTryAgain}
      toolbarHost={props.toolbarHost}
      tool={tool}
      onTool={onTool}
      actionsOpen={actionsOpen}
      onActionsOpen={setActionsOpen}
      run={run}
      panel={props.panel}
      shapes={props.shapes}
    />
  )
}
