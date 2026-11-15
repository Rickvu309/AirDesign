import { useId, type ReactNode } from "react"
import { blurDeviation, edgeDeviation, slideShift, tidy } from "./effect-art.js"
import type { CanvasElement } from "./record.js"
import type { Scaled } from "./text-look.js"

export function paintsGroupEffects(element: CanvasElement): boolean {
  const effects = element.effects
  return (
    element.kind === "group" &&
    element.box !== null &&
    effects !== undefined &&
    (effects.shadow !== undefined || effects.glow !== undefined || effects.softEdge !== undefined)
  )
}

export function layered(
  elements: readonly CanvasElement[],
  paint: (element: CanvasElement) => ReactNode,
  hold: (group: CanvasElement, members: readonly ReactNode[]) => ReactNode,
): readonly ReactNode[] {
  const nodes: ReactNode[] = []
  for (let at = 0; at < elements.length;) {
    const element = elements[at]!
    nodes.push(paint(element))
    const held = paintsGroupEffects(element) ? Math.min(element.held ?? 0, elements.length - at - 1) : 0
    if (held > 0) nodes.push(hold(element, layered(elements.slice(at + 1, at + 1 + held), paint, hold)))
    at += 1 + held
  }
  return nodes
}

function GroupFilter(props: { readonly id: string; readonly element: CanvasElement; readonly scaled: Scaled }) {
  const { element, id, scaled } = props
  const { glow, shadow, softEdge } = element.effects ?? {}
  const shift =
    shadow === undefined || element.box === null ? null : slideShift(shadow, element.box, scaled(shadow.distance))
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      {softEdge === undefined ? null : (
        <>
          <feMorphology in="SourceAlpha" operator="erode" radius={scaled(softEdge.radius) / 2} result="worn" />
          <feGaussianBlur in="worn" stdDeviation={scaled(softEdge.radius) / edgeDeviation} result="edge" />
          <feComposite in="SourceGraphic" in2="edge" operator="in" result="soft" />
        </>
      )}
      {shadow === undefined || shift === null ? null : (
        <>
          <feGaussianBlur in="SourceAlpha" stdDeviation={scaled(shadow.blur) / blurDeviation} result="shade" />
          <feOffset in="shade" dx={tidy(shift.x)} dy={tidy(shift.y)} result="cast" />
          <feFlood floodColor={shadow.color} result="shadow-color" />
          <feComposite in="shadow-color" in2="cast" operator="in" result="shadow-shape" />
          <feComposite in="shadow-shape" in2="SourceAlpha" operator="out" result="shadow" />
        </>
      )}
      {glow === undefined ? null : (
        <>
          <feMorphology in="SourceAlpha" operator="dilate" radius={scaled(glow.radius) / 2} result="grown" />
          <feGaussianBlur in="grown" stdDeviation={scaled(glow.radius) / edgeDeviation} result="halo" />
          <feFlood floodColor={glow.color} result="glow-color" />
          <feComposite in="glow-color" in2="halo" operator="in" result="glow-shape" />
          <feComposite in="glow-shape" in2="SourceAlpha" operator="out" result="glow" />
        </>
      )}
      <feMerge>
        {shadow === undefined ? null : <feMergeNode in="shadow" />}
        {glow === undefined ? null : <feMergeNode in="glow" />}
        <feMergeNode in={softEdge === undefined ? "SourceGraphic" : "soft"} />
      </feMerge>
    </filter>
  )
}

export function GroupEffects(props: {
  readonly element: CanvasElement
  readonly scaled: Scaled
  readonly children: readonly ReactNode[]
}) {
  const id = `${useId().replaceAll(":", "")}-group`
  return (
    <>
      <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
        <GroupFilter id={id} element={props.element} scaled={props.scaled} />
      </svg>
      <div
        data-group-effects={props.element.key}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", filter: `url(#${id})` }}
      >
        {props.children}
      </div>
    </>
  )
}
