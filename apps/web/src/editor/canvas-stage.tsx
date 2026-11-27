import * as doom from "@airdesign/doom"
import { SlidePaint } from "@airdesign/render"
import { useMemo, type DragEvent, type MouseEvent, type PointerEvent, type RefObject } from "react"
import { createPortal } from "react-dom"
import { slideTop, type Zoom } from "@/editing/canvas-zoom"
import { editorCopy } from "@/copy/editor-copy"
import { pictureCopy } from "@/copy/picture-copy"
import { AgentArrival } from "./agent-arrival"
import { AgentAtWork } from "./agent-at-work"
import type { Flight } from "./canvas-carry"
import type { ActionRun } from "./actions-popover"
import { CanvasOverlay, type Preview } from "./canvas-overlay"
import type { Size } from "./canvas-view"
import { EditorToolbar, type RightPanel } from "./editor-toolbar"
import { LayerMenu } from "./layer-menu"
import type { Rect, Selection } from "./selection"
import type { ShapesShown } from "@/editor/shape-tool"
import { slideFrame } from "@/editor/slide-frame"
import type { SlideGeometry } from "@/editing/slide-geometry"
import { TextHost } from "./text-host"
import { ThinNoticeView, type ThinNotice } from "./thin-notice"
import type { EditorClient } from "./use-deck"
import type { Tool } from "./use-canvas-pointer"
import type { useTextSession } from "./use-text-session"

type TextApi = ReturnType<typeof useTextSession>

export function CanvasStage({
  placed,
  stage,
  slideBox,
  zoom,
  deck,
  ready,
  fontsReady,
  panning,
  scale,
  size,
  content,
  panLayer,
  overlay,
  slideNumber,
  view,
  shown,
  editingRuns,
  slide,
  onPanel,
  geometry,
  selected,
  onSelection,
  client,
  nodes,
  background,
  assetUrl,
  session,
  text,
  slides,
  theme,
  onLeave,
  caught,
  preview,
  flight,
  hover,
  marquee,
  crop,
  cropUrl,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  onDragOver,
  onDrop,
  pictureNotice,
  textRefused,
  notice,
  onTryAgain,
  toolbarHost,
  tool,
  onTool,
  actionsOpen,
  onActionsOpen,
  run,
  panel,
  shapes,
}: {
  readonly placed: boolean
  readonly stage: RefObject<HTMLDivElement | null>
  readonly slideBox: RefObject<HTMLDivElement | null>
  readonly zoom: Zoom
  readonly deck: string
  readonly ready: boolean
  readonly fontsReady: boolean
  readonly panning: boolean
  readonly scale: number
  readonly size: { readonly w: number; readonly h: number }
  readonly content: Size
  readonly panLayer: RefObject<HTMLDivElement | null>
  readonly overlay: number
  readonly slideNumber: number
  readonly view: doom.Doom
  readonly shown: doom.Doom
  readonly editingRuns: ReadonlySet<string>
  readonly slide: doom.NodeId
  readonly onPanel: (next: RightPanel) => void
  readonly geometry: SlideGeometry
  readonly selected: Selection
  readonly onSelection: (next: Selection) => void
  readonly client: EditorClient
  readonly nodes: readonly doom.Resolved[]
  readonly background: readonly doom.ResolvedPaint[]
  readonly assetUrl: (asset: string) => string | undefined
  readonly session: TextApi["session"]
  readonly text: TextApi
  readonly slides: readonly doom.NodeId[]
  readonly theme: doom.Theme
  readonly onLeave: () => void
  readonly caught: EditorClient["caught"]
  readonly preview: Preview | null
  readonly flight: Flight | null
  readonly hover: doom.NodeId | null
  readonly marquee: Rect | null
  readonly crop: {
    readonly node: doom.NodeId
    readonly natural: { readonly width: number; readonly height: number } | null
  } | null
  readonly cropUrl: string | undefined
  readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  readonly onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  readonly onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
  readonly onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void
  readonly onDoubleClick: (event: MouseEvent<HTMLDivElement>) => void
  readonly onDragOver: (event: DragEvent<HTMLDivElement>) => void
  readonly onDrop: (event: DragEvent<HTMLDivElement>) => void
  readonly pictureNotice: ThinNotice | null
  readonly textRefused: boolean
  readonly notice: ThinNotice | null
  readonly onTryAgain: (notice: ThinNotice) => void
  readonly toolbarHost: HTMLElement | null
  readonly tool: Tool
  readonly onTool: (tool: Tool) => void
  readonly actionsOpen: boolean
  readonly onActionsOpen: (open: boolean) => void
  readonly run: ActionRun
  readonly panel: RightPanel
  readonly shapes: ShapesShown | undefined
}) {
  const carried = flight?.carried
  const flying = useMemo(
    () => (carried === undefined ? null : nodes.filter((node) => carried.has(node.id))),
    [nodes, carried],
  )
  const staying = useMemo(
    () => (carried === undefined ? nodes : nodes.filter((node) => !carried.has(node.id))),
    [nodes, carried],
  )
  const slideW = size.w * scale
  const slideH = size.h * scale
  const { w: width, h: height } = content
  const left = placed ? 0 : (width - slideW) / 2
  const top = placed ? 0 : slideTop({ height, overlay, slide: slideH })
  return (
    <>
      <div
        ref={stage}
        data-canvas-stage=""
        data-grid-edit={placed ? "" : undefined}
        data-canvas-fit={zoom === "fit" ? "true" : "false"}
        data-editor-stage=""
        data-editor-ready={ready ? deck : undefined}
        aria-label={editorCopy.canvas}
        role="application"
        tabIndex={0}
        className={
          placed
            ? "absolute top-0 left-0 touch-none overflow-visible outline-none select-none"
            : "absolute inset-0 touch-none overflow-auto bg-canvas outline-none select-none"
        }
        style={{
          cursor: panning ? "grab" : "default",
          ["--focus-ring-offset" as string]: "calc(-1 * var(--focus-ring-width))",
          ...(placed
            ? { width, height, transform: `scale(${String(1 / scale)})`, transformOrigin: "0 0" }
            : { scrollbarWidth: "none", overflowAnchor: "none" }),
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={onDoubleClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div ref={panLayer} style={{ position: "relative", width, height }}>
          <div data-slide-wrapper="" style={{ position: "absolute", left, top, width: slideW, height: slideH }}>
            {placed ? null : (
              <span
                className="absolute inset-x-0 bottom-full mb-3 flex items-end justify-between gap-4 text-[length:var(--type-dense)] text-quiet"
                data-slide-label=""
              >
                {slideNumber}
                <AgentAtWork view={view} editing={editingRuns} slide={slide} onOpen={() => onPanel("agent")} />
              </span>
            )}
            <div ref={slideBox} data-slide-box="" className={slideFrame} style={{ position: "absolute", inset: 0 }}>
              <LayerMenu
                view={view}
                geometry={geometry}
                selection={selected}
                onSelection={onSelection}
                scale={scale}
                client={client}
                slideBox={slideBox}
              >
                <SlidePaint
                  nodes={staying}
                  background={background}
                  size={size}
                  width={size.w * scale}
                  assetUrl={assetUrl}
                  waiting={pictureCopy.uploading}
                  iconsReady={ready}
                  fontsPending={!ready || !fontsReady}
                  {...(session === null
                    ? {}
                    : {
                        host: {
                          id: session.node,
                          render: (resolved: doom.Resolved) => (
                            <TextHost
                              deck={deck}
                              slides={slides}
                              node={resolved}
                              theme={theme}
                              api={text}
                              onLeave={onLeave}
                            />
                          ),
                        },
                      })}
                />
                {flight === null || flying === null ? null : (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 left-0"
                    style={{
                      transform: `translate(${String(flight.by.x * scale)}px, ${String(flight.by.y * scale)}px)`,
                    }}
                    data-carried=""
                  >
                    <SlidePaint
                      nodes={flying}
                      background={[]}
                      size={size}
                      width={size.w * scale}
                      assetUrl={assetUrl}
                      waiting={pictureCopy.uploading}
                      iconsReady={ready}
                    />
                  </div>
                )}
                <AgentArrival
                  view={view}
                  slide={slide}
                  caught={caught}
                  still={`${slide} ${String(scale)} ${session?.node ?? ""} ${preview?.kind ?? ""}`}
                />
                <CanvasOverlay
                  view={shown}
                  preview={preview}
                  flight={flight}
                  geometry={geometry}
                  selected={selected.ids}
                  hovered={hover}
                  marquee={marquee}
                  editing={session !== null}
                  crop={crop}
                  cropUrl={cropUrl}
                  scale={scale}
                  size={size}
                />
              </LayerMenu>
            </div>
          </div>
        </div>
      </div>
      <ThinNoticeView notice={pictureNotice ?? (textRefused ? "text-refused" : notice)} onTryAgain={onTryAgain} />
      {toolbarHost === null
        ? null
        : createPortal(
            <EditorToolbar
              tool={tool}
              onTool={onTool}
              actionsOpen={actionsOpen}
              onActionsOpen={onActionsOpen}
              run={run}
              panel={panel}
              onPanel={onPanel}
              {...(shapes === undefined ? {} : { shapes })}
            />,
            toolbarHost,
          )}
    </>
  )
}
