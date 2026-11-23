import { format } from "@airdesign/document"
import { paintReader } from "@airdesign/pptx"
import { element, type At, type Parts, type Probe } from "./parity-probe"

function framing(parts: Parts, at: At) {
  return element(parts, at)?.framing?.layout
}

function laidOut(parts: Parts, at: At): string {
  return JSON.stringify(
    paintReader(parts)
      .slide(at.part)
      .elements.map((each) => each.box),
  )
}

const dragged: Readonly<Record<string, Readonly<Record<string, { readonly set: number }>>>> = {
  width: { w: { set: 6_000_000 } },
  height: { h: { set: 2_000_000 } },
}

export const layoutProbe: Probe<"layout"> = {
  deck: "frame.pptx",
  kind: "group",
  opening: () => ({
    v: format,
    patch: {
      layout: {
        flow: "opening",
        gap: "opening",
        padding: "opening",
        align: "opening",
        width: "opening",
        height: "opening",
      },
      box: { w: "opening", h: "opening" },
    },
  }),
  edit: (_, field, value) => ({
    v: format,
    patch: { layout: { [field]: { set: value } }, ...(field in dragged ? { box: dragged[field] } : {}) },
  }),
  painted: laidOut,
  fields: {
    flow: { file: (parts, at) => framing(parts, at)?.flow, shows: (value) => value },
    gap: { file: (parts, at) => framing(parts, at)?.gap, shows: (value) => value },
    padding: {
      file: (parts, at) => framing(parts, at)?.padding,
      shows: (value) => [value.left, value.top, value.right, value.bottom],
    },
    align: { file: (parts, at) => framing(parts, at)?.align, shows: (value) => value },
    width: { file: (parts, at) => framing(parts, at)?.width, shows: (value) => value },
    height: { file: (parts, at) => framing(parts, at)?.height, shows: (value) => value },
  },
}
