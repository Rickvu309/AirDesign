import type { CSSProperties } from "react"
import type { CanvasElement } from "./record.js"

export type CanvasPicture = {
  readonly opacity?: number
  readonly grayscale?: true
  readonly duotone?: readonly [dark: string, light: string]
  readonly blur?: number
  readonly overlay?: string
}

const luminance = "0.2126 0.7152 0.0722 0 0"

function channels(hex: string): readonly number[] {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16)
  return [16, 8, 0].map((shift) => ((value >> shift) & 255) / 255)
}

export function toneId(element: CanvasElement): string {
  let hash = 0x811c9dc5
  for (const unit of `${element.key} ${element.picture?.duotone?.join(" ") ?? ""}`)
    hash = Math.imul(hash ^ unit.charCodeAt(0), 0x01000193) >>> 0
  return `picture-tone-${hash.toString(16)}`
}

function washed(element: CanvasElement): boolean {
  const picture = element.picture
  return picture?.blur !== undefined || picture?.overlay !== undefined
}

export function pictureLook(element: CanvasElement): CSSProperties {
  const picture = element.picture
  if (picture === undefined) return {}
  const filters = washed(element)
    ? []
    : [
        ...(picture.grayscale === true ? ["grayscale(1)"] : []),
        ...(picture.duotone === undefined ? [] : [`url(#${toneId(element)})`]),
      ]
  return {
    ...(filters.length === 0 ? {} : { filter: filters.join(" ") }),
    ...(picture.opacity === undefined ? {} : { opacity: picture.opacity }),
  }
}

export function PictureWash({
  element,
  scaled,
  fill,
}: {
  readonly element: CanvasElement
  readonly scaled: (emu: number) => number
  readonly fill: string | null
}) {
  const picture = element.picture
  if (fill === null || picture === undefined || !washed(element)) return null
  const filters = [
    ...(picture.grayscale === true ? ["grayscale(1)"] : []),
    ...(picture.duotone === undefined ? [] : [`url(#${toneId(element)})`]),
    ...(picture.blur === undefined ? [] : [`blur(${scaled(picture.blur * 9525)}px)`]),
  ]
  return (
    <>
      <div
        data-picture-wash
        style={{
          position: "absolute",
          inset: 0,
          background: fill,
          pointerEvents: "none",
          ...(filters.length === 0 ? {} : { filter: filters.join(" ") }),
        }}
      />
      {picture.overlay === undefined ? null : (
        <div
          data-picture-overlay
          style={{ position: "absolute", inset: 0, background: picture.overlay, pointerEvents: "none" }}
        />
      )}
    </>
  )
}

export function PictureTone(props: { readonly element: CanvasElement }) {
  const duotone = props.element.picture?.duotone
  if (duotone === undefined) return null
  const dark = channels(duotone[0])
  const light = channels(duotone[1])
  const table = (channel: number) => `${String(dark[channel] ?? 0)} ${String(light[channel] ?? 1)}`
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
      <filter id={toneId(props.element)} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={`${luminance} ${luminance} ${luminance} 0 0 0 1 0`} />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={table(0)} />
          <feFuncG type="table" tableValues={table(1)} />
          <feFuncB type="table" tableValues={table(2)} />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}
