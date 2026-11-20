import { format, type Kind } from "@airdesign/document"
import {
  shownPictureMode,
  shownCrop,
  shownIdentity,
  shownImage,
  shownSlots,
  shownTileScale,
  exportParts,
} from "@airdesign/pptx"
import { agentRegister, indexed, type At, type Parts, type Probe } from "./parity-probe"

const on = { deck: "doe-heat-pumps.pptx", kind: "shape" as Kind, node: "2883.13" }

const identityOpening = {
  name: "opening",
  alt: "opening",
  hidden: "opening",
  locked: "opening",
  mask: "opening",
} as const

export const identityProbe: Probe<"identity"> = {
  ...on,
  opening: () => ({ v: format, patch: { identity: identityOpening } }),
  edit: (_, field, value) => ({ v: format, patch: { identity: { [field]: { set: value } } } }),
  fields: {
    name: { file: (parts, at) => shownIdentity(parts, at)?.name, shows: (value) => value },
    alt: { file: (parts, at) => shownIdentity(parts, at)?.alt, shows: (value) => value },
    hidden: { file: (parts, at) => shownIdentity(parts, at)?.hidden, shows: (value) => value },
    locked: { file: (parts, at) => shownIdentity(parts, at)?.locked, shows: (value) => value },
    mask: { file: (parts, at) => shownIdentity(parts, at)?.mask, shows: (value) => value },
  },
}

function imageProbe(file: (parts: Parts, at: At) => unknown) {
  return { on, file, shows: (value: unknown) => value }
}

export const imageProbes = {
  mode: imageProbe((parts, at) => shownPictureMode(parts, at)),
  source: imageProbe((parts, at) => shownImage(parts, at)?.source),
  tileScale: {
    ...imageProbe(shownTileScale),
    prepare: (parts: Parts, at: At) => {
      const tiled = agentRegister(indexed(parts), at, { fills: { mode: "tile" } })
      if (tiled === null) throw new Error("tile-probe")
      return exportParts(parts, tiled)
    },
  },
  crop: imageProbe((parts, at) => shownCrop(parts, at)),
  recolor: imageProbe((parts, at) => shownImage(parts, at)?.recolor),
  blur: imageProbe((parts, at) => shownImage(parts, at)?.blur),
  overlay: imageProbe((parts, at) => shownSlots(parts, at)[3]),
}
