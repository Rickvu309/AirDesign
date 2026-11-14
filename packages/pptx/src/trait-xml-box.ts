import { angle, attribute, emu, flag, inner, type TraitXml } from "./xml-codec.js"

export const boxXml: TraitXml<"box"> = {
  slot: "transform",
  fields: {
    x: inner("a:off", "x", emu),
    y: inner("a:off", "y", emu),
    w: inner("a:ext", "cx", emu),
    h: inner("a:ext", "cy", emu),
    rot: attribute("rot", angle),
    flipH: attribute("flipH", flag),
    flipV: attribute("flipV", flag),
  },
}
