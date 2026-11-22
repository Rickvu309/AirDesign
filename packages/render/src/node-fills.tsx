import type { scene } from "@airdesign/document"
import type { CSSProperties } from "react"

type Paint = scene.ResolvedPaint

export type AssetUrl = (asset: string) => string | undefined

const stopText = (stops: readonly { readonly at: number; readonly color: string }[]) =>
  stops.map((stop) => `${stop.color} ${String(Math.round(stop.at * 10_000) / 100)}%`).join(", ")

function imageLook(paint: Extract<Paint, { kind: "image" }>, url: string): CSSProperties {
  const filters = paint.filters
  const filter = [
    filters?.exposure === undefined ? "" : `brightness(${String(1 + filters.exposure)})`,
    filters?.contrast === undefined ? "" : `contrast(${String(1 + filters.contrast)})`,
    filters?.saturation === undefined ? "" : `saturate(${String(1 + filters.saturation)})`,
  ]
    .filter((part) => part !== "")
    .join(" ")
  const base: CSSProperties = {
    backgroundImage: `url("${url}")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    ...(filter === "" ? {} : { filter }),
  }
  if (paint.fit === "fit") return { ...base, backgroundSize: "contain" }
  if (paint.fit === "tile") return { ...base, backgroundRepeat: "repeat", backgroundSize: "auto" }
  if (paint.fit === "crop" && paint.crop !== undefined) {
    const { x, y, w, h } = paint.crop
    return {
      ...base,
      backgroundSize: `${String(100 / w)}% ${String(100 / h)}%`,
      backgroundPosition: `${w >= 1 ? 0 : String((x / (1 - w)) * 100)}% ${h >= 1 ? 0 : String((y / (1 - h)) * 100)}%`,
    }
  }
  return { ...base, backgroundSize: "cover" }
}

export function paintLook(paint: Paint, assetUrl: AssetUrl): CSSProperties | null {
  if (paint.kind === "solid") return { background: paint.color }
  if (paint.kind === "gradient")
    return {
      background:
        paint.shape === "radial"
          ? `radial-gradient(closest-side, ${stopText(paint.stops)})`
          : `linear-gradient(${String(paint.angle + 90)}deg, ${stopText(paint.stops)})`,
    }
  const url = assetUrl(paint.asset)
  return url === undefined ? null : imageLook(paint, url)
}

export function PaintLayers(props: { readonly fills: readonly Paint[]; readonly assetUrl: AssetUrl }) {
  return (
    <>
      {props.fills.map((paint, at) => {
        const look = paintLook(paint, props.assetUrl)
        if (look === null) return null
        return (
          <div
            key={at}
            data-paint={paint.kind}
            style={{
              position: "absolute",
              inset: 0,
              opacity: paint.opacity === 1 ? undefined : paint.opacity,
              ...look,
            }}
          />
        )
      })}
    </>
  )
}
