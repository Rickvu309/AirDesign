import { Fragment } from "react"
import type { InnerShadows } from "./node-effects.js"

export function InnerShadowFilter({ inner }: { readonly inner: InnerShadows }) {
  return (
    <svg width={0} height={0} aria-hidden style={{ position: "absolute" }}>
      <filter id={inner.id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
        {inner.shadows.map((shadow, at) => (
          <Fragment key={at}>
            <feOffset in="SourceAlpha" dx={shadow.x} dy={shadow.y} result={`moved-${String(at)}`} />
            {shadow.spread > 0 ? (
              <feMorphology
                in={`moved-${String(at)}`}
                operator="erode"
                radius={shadow.spread}
                result={`moved-${String(at)}`}
              />
            ) : null}
            <feGaussianBlur in={`moved-${String(at)}`} stdDeviation={shadow.blur / 2} result={`soft-${String(at)}`} />
            <feComposite
              in="SourceAlpha"
              in2={`soft-${String(at)}`}
              operator="arithmetic"
              k2={1}
              k3={-1}
              result={`edge-${String(at)}`}
            />
            <feFlood floodColor={shadow.color} floodOpacity={shadow.opacity} />
            <feComposite in2={`edge-${String(at)}`} operator="in" result={`shade-${String(at)}`} />
          </Fragment>
        ))}
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          {inner.shadows.map((_, at) => (
            <feMergeNode key={at} in={`shade-${String(at)}`} />
          ))}
        </feMerge>
      </filter>
    </svg>
  )
}
