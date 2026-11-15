import { format } from "@airdesign/document"
import { shownCrop, shownIdentity, shownImage } from "@airdesign/pptx"
import type { Probe } from "./parity-probe"

const picture = "2883.13"

const identityOpening = { name: "opening", alt: "opening", hidden: "opening" } as const

export const pictureProbes: {
  readonly identity: Probe<"identity">
  readonly image: Probe<"image">
  readonly crop: Probe<"crop">
} = {
  identity: {
    deck: "doe-heat-pumps.pptx",
    kind: "picture",
    node: picture,
    opening: () => ({ v: format, patch: { identity: identityOpening } }),
    edit: (_, field, value) => ({ v: format, patch: { identity: { [field]: { set: value } } } }),
    fields: {
      name: { file: (parts, at) => shownIdentity(parts, at)?.name, shows: (value) => value },
      alt: { file: (parts, at) => shownIdentity(parts, at)?.alt, shows: (value) => value },
      hidden: { file: (parts, at) => shownIdentity(parts, at)?.hidden, shows: (value) => value },
    },
  },
  image: {
    deck: "doe-heat-pumps.pptx",
    kind: "picture",
    node: picture,
    opening: () => ({ v: format, patch: { image: { source: "opening", recolor: "opening" } } }),
    edit: (_, field, value) => ({ v: format, patch: { image: { [field]: { set: value } } } }),
    fields: {
      source: { file: (parts, at) => shownImage(parts, at)?.source, shows: (value) => value },
      recolor: { file: (parts, at) => shownImage(parts, at)?.recolor, shows: (value) => value },
    },
  },
  crop: {
    deck: "doe-heat-pumps.pptx",
    kind: "picture",
    node: picture,
    opening: () => ({ v: format, patch: { crop: { rect: "opening" } } }),
    edit: (_, __, value) => ({ v: format, patch: { crop: { rect: { set: value } } } }),
    fields: { rect: { file: (parts, at) => shownCrop(parts, at), shows: (value) => value } },
  },
}
