import { shapeOf, type ElementId } from "@airdesign/document"
import {
  readSlides,
  shownAlphas,
  shownBody,
  shownBorder,
  shownConnection,
  shownCrop,
  shownEffects,
  shownGeometry,
  shownIdentity,
  shownImage,
  shownLink,
  shownPictureMode,
  shownTileScale,
  shownTextStyle,
  shownTurn,
} from "@airdesign/pptx"
import { fillSlotFields } from "@/design/fill-slots"
import type { PanelReads } from "@/design/panel"
import { keptPanelField } from "@/editor/kept-panel-field"

type Parts = ReadonlyMap<string, Uint8Array>

const shownFields = new WeakMap<Parts, Map<ElementId, PanelReads["fields"]>>()

export function fieldsOf(parts: Parts, node: ElementId): PanelReads["fields"] {
  const read = shownFields.get(parts) ?? new Map<ElementId, PanelReads["fields"]>()
  shownFields.set(parts, read)
  if (!read.has(node)) read.set(node, fieldsRead(parts, node))
  return read.get(node)
}

function fieldsRead(parts: Parts, node: ElementId): PanelReads["fields"] {
  const { slide, shape } = shapeOf(node)
  const part = readSlides(parts).find((each) => each.slide === slide)?.part
  if (part === undefined) return {}
  const at = { slide, part, shape }
  try {
    const geometry = shownGeometry(parts, at)
    const turn = shownTurn(parts, at)
    const border = Object.entries(shownBorder(parts, at) ?? {}).map(([field, shown]) => [`border.${field}`, shown])
    const body = Object.entries(shownBody(parts, at) ?? {}).map(([field, shown]) => [`body.${field}`, shown])
    const text = Object.entries(shownTextStyle(parts, at) ?? {}).map(([field, shown]) => [`text.${field}`, shown])
    const alphas = Object.entries(shownAlphas(parts, at)).map(([trait, value]) => [
      `${trait}.alpha`,
      { value, own: true },
    ])
    const effects = Object.entries(shownEffects(parts, at) ?? {}).map(([field, shown]) => [`effects.${field}`, shown])
    const image = shownImage(parts, at)
    const crop = shownCrop(parts, at)
    const link = shownLink(parts, at)
    const connection = shownConnection(parts, at)
    const identity = Object.entries(shownIdentity(parts, at) ?? {}).map(([field, value]) => [
      `identity.${field}`,
      { value, own: true },
    ])
    return {
      "link.target": { value: link, own: true },
      ...(image === null
        ? {}
        : {
            "fills.mode": { value: shownPictureMode(parts, at), own: true },
            "fills.tileScale": { value: shownTileScale(parts, at), own: true },
            "fills.source": { value: image.source, own: true },
            "fills.weight": { value: image.weight, own: true },
            "fills.color": { value: image.color, own: true },
            "fills.recolor": { value: image.recolor, own: true },
            "fills.blur": { value: image.blur === null ? null : Math.min(image.blur, 100_000), own: true },
          }),
      ...(crop === null ? {} : { "fills.crop": { value: crop, own: true } }),
      ...(connection === null
        ? {}
        : {
            "connection.start": { value: connection.start, own: true },
            "connection.end": { value: connection.end, own: true },
          }),
      ...Object.fromEntries(identity),
      ...fillSlotFields(parts, at),
      ...(geometry === null ? {} : { "geometry.shape": geometry }),
      "box.rot": { value: turn.rot, own: true },
      "box.flipH": { value: turn.flipH, own: true },
      "box.flipV": { value: turn.flipV, own: true },
      ...Object.fromEntries(border),
      ...Object.fromEntries(body),
      ...Object.fromEntries(text),
      ...Object.fromEntries(alphas),
      ...Object.fromEntries(effects),
      ...keptPanelField(parts, at),
    }
  } catch {
    return {}
  }
}
