import * as doom from "@airdesign/doom"
import { memo, useId, type CSSProperties, type ReactNode } from "react"
import { iconNodes, type IconNode } from "./icon-nodes.js"
import { InnerShadowFilter } from "./inner-shadow.js"
import { effectLook, type ShadowFrom } from "./node-effects.js"
import { type AssetUrl, PaintLayers } from "./node-fills.js"
import { outlineOf } from "./node-outline.js"
import { NodeStrokes } from "./node-strokes.js"
import { TextLines } from "./node-text.js"

type Resolved = doom.Resolved

export type NodeHost = { readonly id: string; readonly render: (node: Resolved) => ReactNode }

export const holds = (node: Resolved, id: string): boolean =>
  node.id === id || node.children.some((child) => holds(child, id))

const fill: CSSProperties = { position: "absolute", inset: 0 }

function IconArt({ node, nodes }: { readonly node: Resolved; readonly nodes: readonly IconNode[] }) {
  const { w, h } = node.box
  const paint = node.strokes[0]
  const weight = node.stroke?.weight ?? 2
  const side = Math.max(1, Math.min(w, h))
  if (paint === undefined || paint.kind !== "solid") return null
  const element = ([tag, attributes, children]: IconNode, key: number): React.ReactNode => {
    const { key: _key, ...rest } = attributes
    const Tag = tag as "path"
    return (
      <Tag key={key} {...(rest as object)}>
        {children?.map(element)}
      </Tag>
    )
  }
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      stroke={paint.color}
      strokeOpacity={paint.opacity === 1 ? undefined : paint.opacity}
      strokeWidth={(weight * 24) / side}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      {nodes.map(element)}
    </svg>
  )
}

function flipOf(box: Resolved["box"]): string | undefined {
  return box.flipH || box.flipV ? `scale(${box.flipH ? -1 : 1}, ${box.flipV ? -1 : 1})` : undefined
}

const labelWidth = 283
const labelHeight = 71
const labelSize = 28
const labelInset = 14

function WaitingLabel({ text }: { readonly text: string }) {
  return (
    <div
      data-unshown-label
      style={{
        ...fill,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: labelInset,
        textAlign: "center",
        fontFamily: "var(--font-sans)",
        fontSize: labelSize,
        lineHeight: 1.3,
        color: "var(--placeholder-prompt)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {text}
    </div>
  )
}

export const NodeArt = memo(function NodeArt({
  node,
  assetUrl,
  waiting,
  host,
  iconsReady,
}: {
  readonly node: Resolved
  readonly assetUrl: AssetUrl
  readonly waiting?: string
  readonly host?: NodeHost | undefined
  readonly iconsReady?: boolean | undefined
}) {
  const { box, geometry } = node
  const boxy = geometry === null || geometry.kind === "rect" || geometry.kind === "ellipse"
  const outline = outlineOf(node)
  const painted = node.fills.length > 0 && geometry?.kind !== "line" && geometry?.kind !== "icon"
  const typing = host?.id === node.id && node.text !== null
  const from: ShadowFrom = painted ? (boxy ? "box" : "outline") : typing ? "typing" : "contents"
  const filterId = useId()
  const look = effectLook(node.effects, from, `inner-shadow${filterId.replace(/[^\w-]/g, "-")}`)
  const round = geometry?.kind === "ellipse" ? "50%" : node.radius.map((corner) => `${String(corner)}px`).join(" ")
  const clipped = !boxy && outline.fill !== null ? `path("${outline.fill}")` : undefined
  const icon = geometry?.kind === "icon" ? iconNodes(geometry.name) : undefined
  const missing =
    waiting !== undefined && node.fills.some((paint) => paint.kind === "image" && assetUrl(paint.asset) === undefined)
  const unshown = missing && box.w >= labelWidth && box.h >= labelHeight
  return (
    <div
      data-node={node.id}
      {...(node.derived ? { "data-derived": "" } : {})}
      data-geometry={geometry?.kind ?? "frame"}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        pointerEvents: "none",
        ...(node.opacity === 1 ? {} : { opacity: node.opacity }),
        ...(box.rotation === 0 ? {} : { transform: `rotate(${String(box.rotation)}deg)` }),
        ...(look.wholeFilter === undefined ? {} : { filter: look.wholeFilter }),
        ...(look.textShadow === undefined ? {} : { textShadow: look.textShadow }),
      }}
    >
      {look.inner === undefined ? null : <InnerShadowFilter inner={look.inner} />}
      <div style={{ ...fill, ...(flipOf(box) === undefined ? {} : { transform: flipOf(box) }) }}>
        {painted || missing ? (
          <div style={{ ...fill, ...(look.bodyFilter === undefined ? {} : { filter: look.bodyFilter }) }}>
            <div
              data-body=""
              style={{
                ...fill,
                overflow: "hidden",
                ...(missing ? { background: "var(--line)" } : {}),
                ...(boxy ? { borderRadius: round } : { clipPath: clipped }),
                ...(look.boxShadow === undefined ? {} : { boxShadow: look.boxShadow }),
                ...(look.backdrop === undefined ? {} : { backdropFilter: look.backdrop }),
              }}
            >
              <PaintLayers fills={node.fills} assetUrl={assetUrl} />
            </div>
          </div>
        ) : null}
        {geometry?.kind === "icon" ? (
          icon === undefined ? null : (
            <IconArt node={node} nodes={icon} />
          )
        ) : (
          <NodeStrokes node={node} outline={outline} />
        )}
      </div>
      {unshown ? <WaitingLabel text={waiting} /> : null}
      {(host?.id === node.id ? host.render(node) : null) ??
        (node.text === null ? null : <TextLines lines={node.text.lines} />)}
      {node.children.length === 0 ? null : (
        <div
          style={{
            ...fill,
            ...(node.clip ? { overflow: "hidden", borderRadius: round } : {}),
          }}
        >
          {node.children.map((child) => (
            <NodeArt
              key={child.id}
              node={child}
              assetUrl={assetUrl}
              {...(waiting === undefined ? {} : { waiting })}
              host={host !== undefined && holds(child, host.id) ? host : undefined}
              iconsReady={iconsReady}
            />
          ))}
        </div>
      )}
    </div>
  )
})
