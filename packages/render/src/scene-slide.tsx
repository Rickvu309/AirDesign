import { type FontWidths, scene } from "@airdesign/document"
import { useEffect, useMemo, useState } from "react"
import { useIcons } from "./icon-nodes.js"
import { type AssetUrl, PaintLayers } from "./node-fills.js"
import { NodeArt } from "./node-art.js"
import { measureFaces } from "./scene-widths.js"

type Resolved = scene.Resolved

const noAssets: AssetUrl = () => undefined

function useSceneMeasure(value: scene.Scene): scene.Measure | null {
  const needs = useMemo(() => scene.sceneFaces(value), [value])
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
  return useMemo(() => (widths === null ? null : scene.measureWith(widths)), [widths])
}

function iconNames(nodes: readonly Resolved[]): readonly string[] {
  return nodes.flatMap((node) => [
    ...(node.geometry?.kind === "icon" ? [node.geometry.name] : []),
    ...iconNames(node.children),
  ])
}

export function SlidePaint(props: {
  readonly nodes: readonly Resolved[]
  readonly background: readonly scene.ResolvedPaint[]
  readonly size: { readonly w: number; readonly h: number }
  readonly width: number
  readonly assetUrl?: AssetUrl
  readonly waiting?: string
}) {
  const { size, width, waiting } = props
  const assetUrl = props.assetUrl ?? noAssets
  const scale = width / size.w
  return (
    <div
      data-scene-slide=""
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
        {props.nodes.map((node) => (
          <NodeArt key={node.id} node={node} assetUrl={assetUrl} {...(waiting === undefined ? {} : { waiting })} />
        ))}
      </div>
    </div>
  )
}

export function useSceneSlide(
  value: scene.Scene,
  slide: scene.NodeId,
): {
  readonly nodes: readonly Resolved[] | null
  readonly background: readonly scene.ResolvedPaint[]
  readonly ready: boolean
} {
  const measure = useSceneMeasure(value)
  const nodes = useMemo(
    () => (measure === null ? null : scene.resolveSlide(value, slide, measure)),
    [value, slide, measure],
  )
  const iconsReady = useIcons(nodes === null ? [] : iconNames(nodes))
  const background = useMemo(() => scene.slideBackground(value, slide), [value, slide])
  return { nodes, background, ready: nodes !== null && iconsReady }
}

export function SceneSlide(props: {
  readonly scene: scene.Scene
  readonly slide: scene.NodeId
  readonly width: number
  readonly assetUrl?: AssetUrl
  readonly waiting?: string
}) {
  const { nodes, background, ready } = useSceneSlide(props.scene, props.slide)
  const { size } = scene.deckOf(props.scene)
  return (
    <div data-fonts-pending={ready ? undefined : ""}>
      <SlidePaint
        nodes={nodes ?? []}
        background={background}
        size={size}
        width={props.width}
        {...(props.assetUrl === undefined ? {} : { assetUrl: props.assetUrl })}
        {...(props.waiting === undefined ? {} : { waiting: props.waiting })}
      />
    </div>
  )
}
