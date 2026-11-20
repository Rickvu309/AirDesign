import type { ElementId } from "@airdesign/document"
import { useId, useMemo, type ReactNode } from "react"
import { memberAt } from "./box-gesture.js"
import { restingBox, shownBox, useBox, useBoxes, useRotation } from "./element-view.js"
import type { PaintBox } from "./paint-box.js"
import type { CanvasElement } from "./record.js"
import { shapePaths } from "./shape-art.js"
import type { PaintStore } from "./store.js"
import type { Scaled } from "./text-look.js"

const roundCorner = 0.16667

function tidy(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

export function maskPlacement(box: PaintBox, scaled: Scaled): string {
  const left = scaled(box.x)
  const top = scaled(box.y)
  const width = scaled(box.width)
  const height = scaled(box.height)
  if (box.rotation === 0 && !box.flipH && !box.flipV) return `translate(${tidy(left)} ${tidy(top)})`
  const turns = [`translate(${tidy(left + width / 2)} ${tidy(top + height / 2)})`]
  if (box.rotation !== 0) turns.push(`rotate(${tidy(box.rotation)})`)
  if (box.flipH || box.flipV) turns.push(`scale(${box.flipH ? -1 : 1} ${box.flipV ? -1 : 1})`)
  turns.push(`translate(${tidy(-width / 2)} ${tidy(-height / 2)})`)
  return turns.join(" ")
}

function MaskOutline(props: { readonly element: CanvasElement; readonly box: PaintBox; readonly scaled: Scaled }) {
  const { box, scaled } = props
  const element = { ...props.element, box }
  const transform = maskPlacement(box, scaled)
  const width = scaled(box.width)
  const height = scaled(box.height)
  const paths = shapePaths(element, scaled)
  if (paths !== null && paths.length > 0)
    return (
      <>
        {paths
          .filter((path) => path.fill)
          .map((path, at) => (
            <path key={at} d={path.d} transform={transform} />
          ))}
      </>
    )
  if (element.outline === "ellipse")
    return (
      <ellipse
        cx={tidy(width / 2)}
        cy={tidy(height / 2)}
        rx={tidy(width / 2)}
        ry={tidy(height / 2)}
        transform={transform}
      />
    )
  const corner = element.outline === "round" ? Math.min(width, height) * roundCorner : 0
  return (
    <rect
      width={tidy(width)}
      height={tidy(height)}
      {...(corner > 0 ? { rx: tidy(corner) } : {})}
      transform={transform}
    />
  )
}

type ClipProps = {
  readonly store: PaintStore
  readonly element: CanvasElement
  readonly scaled: Scaled
  readonly quiet: boolean
  readonly children: readonly ReactNode[]
}

function LiveClip(props: ClipProps & { readonly node: ElementId }) {
  const { element, store, node } = props
  const read = props.quiet ? restingBox : shownBox
  const own = useBox(store, node, read)
  const rotation = useRotation(store, node)
  const carried = useBox(store, element.group?.id ?? node, read)
  const holders = useMemo(() => element.nestedIn?.map((holder) => holder.id) ?? [], [element.nestedIn])
  const nested = useBoxes(store, holders, read)
  return <PlacedClip {...props} box={memberAt(element, own, rotation, carried, nested)} />
}

function PlacedClip(props: ClipProps & { readonly box: PaintBox | null }) {
  const id = `${useId().replaceAll(":", "")}-mask`
  const { element, scaled, box } = props
  if (box === null) return <>{props.children}</>
  return (
    <>
      <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
        <clipPath id={id} clipPathUnits="userSpaceOnUse">
          <MaskOutline element={element} box={box} scaled={scaled} />
        </clipPath>
      </svg>
      <div
        data-mask-clip={element.key}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          clipPath: `url(#${id})`,
          ...(element.opacity === undefined ? {} : { opacity: element.opacity }),
        }}
      >
        {props.children}
      </div>
    </>
  )
}

export function MaskClip(props: ClipProps) {
  const node = props.element.id
  return node === null ? <PlacedClip {...props} box={props.element.box} /> : <LiveClip {...props} node={node} />
}
