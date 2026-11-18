import type { CSSProperties } from "react"
import { ToneFilter, type CanvasPicture } from "./picture-tone.js"
import type { CanvasElement } from "./record.js"

export type CanvasLayer = { readonly background: string; readonly picture?: CanvasPicture }

const emuPerPixel = 9525

export function layerId(element: CanvasElement, at: number): string {
  let hash = 0x811c9dc5
  for (const unit of `${element.key} ${String(at)}`) hash = Math.imul(hash ^ unit.charCodeAt(0), 0x01000193) >>> 0
  return `fill-tone-${hash.toString(16)}`
}

function layerLook(layer: CanvasLayer, id: string, scaled: (emu: number) => number): CSSProperties {
  const picture = layer.picture
  const filters = [
    ...(picture?.grayscale === true ? ["grayscale(1)"] : []),
    ...(picture?.duotone === undefined ? [] : [`url(#${id})`]),
    ...(picture?.blur === undefined ? [] : [`blur(${scaled(picture.blur * emuPerPixel)}px)`]),
  ]
  return {
    position: "absolute",
    inset: 0,
    background: layer.background,
    pointerEvents: "none",
    ...(filters.length === 0 ? {} : { filter: filters.join(" ") }),
    ...(picture?.opacity === undefined ? {} : { opacity: picture.opacity }),
  }
}

export function FillLayers({
  element,
  scaled,
  unshown,
}: {
  readonly element: CanvasElement
  readonly scaled: (emu: number) => number
  readonly unshown: boolean
}) {
  if (unshown || element.layers === undefined) return null
  return (
    <>
      {element.layers.map((layer, at) => {
        const id = layerId(element, at)
        const overlay = layer.picture?.overlay
        return (
          <div key={at} data-fill-layer={at} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {layer.picture?.duotone === undefined ? null : <ToneFilter id={id} duotone={layer.picture.duotone} />}
            <div
              {...(layer.picture === undefined ? {} : { "data-fill-image": "" })}
              style={layerLook(layer, id, scaled)}
            />
            {overlay === undefined ? null : (
              <div
                data-fill-overlay=""
                style={{ position: "absolute", inset: 0, background: overlay, pointerEvents: "none" }}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
