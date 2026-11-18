import { format, type Kind } from "@airdesign/document"
import { shownPictureMode, shownCrop, shownIdentity, shownImage } from "@airdesign/pptx"
import type { At, Parts, Probe } from "./parity-probe"

const on = { deck: "doe-heat-pumps.pptx", kind: "shape" as Kind, node: "2883.13" }

const identityOpening = { name: "opening", alt: "opening", hidden: "opening" } as const

export const identityProbe: Probe<"identity"> = {
  ...on,
  opening: () => ({ v: format, patch: { identity: identityOpening } }),
  edit: (_, field, value) => ({ v: format, patch: { identity: { [field]: { set: value } } } }),
  fields: {
    name: { file: (parts, at) => shownIdentity(parts, at)?.name, shows: (value) => value },
    alt: { file: (parts, at) => shownIdentity(parts, at)?.alt, shows: (value) => value },
    hidden: { file: (parts, at) => shownIdentity(parts, at)?.hidden, shows: (value) => value },
  },
}

function imageProbe(file: (parts: Parts, at: At) => unknown) {
  return { on, file, shows: (value: unknown) => value }
}

export const imageProbes = {
  mode: imageProbe((parts, at) => shownPictureMode(parts, at)),
  source: imageProbe((parts, at) => shownImage(parts, at)?.source),
  crop: imageProbe((parts, at) => shownCrop(parts, at)),
  recolor: imageProbe((parts, at) => shownImage(parts, at)?.recolor),
  blur: imageProbe((parts, at) => shownImage(parts, at)?.blur),
  overlay: imageProbe((parts, at) => shownImage(parts, at)?.overlay),
}
