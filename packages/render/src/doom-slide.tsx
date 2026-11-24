import { type FontWidths } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { useEffect, useMemo, useState } from "react"
import { useIcons } from "./icon-nodes.js"
import { type AssetUrl, PaintLayers } from "./node-fills.js"
import { MaskedChildren } from "./mask-layers.js"
import { NodeArt, holds, type NodeHost } from "./node-art.js"
import { measureFaces } from "./doom-widths.js"

type Resolved = doom.Resolved

const noAssets: AssetUrl = () => undefined

function useDoomMeasure(value: doom.Doom): doom.Measure | null {
  const needs = useMemo(() => doom.doomFaces(value), [value])
  const key = JSON.stringify(needs)
  const [widths, setWidths] = useState<FontWidths | null>(null)
  useEffect(() => {
    let current = true
    void measureFaces(document, needs).then((measured) => {
      if (current) setWidths(measured)
    })
    return () => {
      current = false
    }
  }, [key])
  return useMemo(() => (widths === null ? null : doom.measureWith(widths)), [widths])
}

function iconNames(nodes: readonly Resolved[]): readonly string[] {
  return nodes.flatMap((node) => [
    ...(node.geometry?.kind === "icon" ? [node.geometry.name] : []),
    ...iconNames(node.children),
  ])
}

export function SlidePaint(props: {
  readonly nodes: readonly Resolved[]
  readonly background: readonly doom.ResolvedPaint[]
  readonly size: { readonly w: number; readonly h: number }
  readonly width: number
  readonly assetUrl?: AssetUrl
  readonly waiting?: string
  readonly host?: NodeHost
  readonly iconsReady?: boolean
}) {
  const { size, width, waiting, host, iconsReady } = props
  const assetUrl = props.assetUrl ?? noAssets
  const scale = width / size.w
  return (
    <div
      data-doom-slide=""
      data-slide-paint=""
      style={{ position: "relative", width, height: size.h * scale, overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size.w,
          height: size.h,
          transform: `scale(${String(scale)})`,
          transformOrigin: "0 0",
        }}
      >
        <div style={{ position: "absolute", inset: 0 }}>
          <PaintLayers fills={props.background} assetUrl={assetUrl} />
        </div>
        <MaskedChildren
          nodes={props.nodes}
          render={(node) => (
            <NodeArt
              key={node.id}
              node={node}
              assetUrl={assetUrl}
              {...(waiting === undefined ? {} : { waiting })}
              host={host !== undefined && holds(node, host.id) ? host : undefined}
              iconsReady={iconsReady}
            />
          )}
        />
      </div>
    </div>
  )
}

export function useDoomSlide(
  value: doom.Doom,
  slide: doom.NodeId,
): {
  readonly nodes: readonly Resolved[] | null
  readonly background: readonly doom.ResolvedPaint[]
  readonly ready: boolean
  readonly measure: doom.Measure | null
} {
  const measure = useDoomMeasure(value)
  const nodes = useMemo(
    () => (measure === null ? null : doom.resolveSlide(value, slide, measure)),
    [value, slide, measure],
  )
  const iconsReady = useIcons(nodes === null ? [] : iconNames(nodes))
  const background = useMemo(() => doom.slideBackground(value, slide), [value, slide])
  return { nodes, background, ready: nodes !== null && iconsReady, measure }
}

export function DoomSlide(props: {
  readonly doom: doom.Doom
  readonly slide: doom.NodeId
  readonly width: number
  readonly assetUrl?: AssetUrl
  readonly waiting?: string
}) {
  const { nodes, background, ready } = useDoomSlide(props.doom, props.slide)
  const { size } = doom.deckOf(props.doom)
  return (
    <div data-fonts-pending={ready ? undefined : ""}>
      <SlidePaint
        nodes={nodes ?? []}
        background={background}
        size={size}
        width={props.width}
        {...(props.assetUrl === undefined ? {} : { assetUrl: props.assetUrl })}
        {...(props.waiting === undefined ? {} : { waiting: props.waiting })}
        iconsReady={ready}
      />
    </div>
  )
}
