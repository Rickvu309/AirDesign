import { trait } from "./trait-decl.js"
import { angle, choice, emu, flag, size } from "./value-kind.js"

export const alignments = ["left", "center", "right", "top", "middle", "bottom"] as const

export const box = trait(
  "whole",
  { version: 1, shape: "4f9a7811" },
  { x: emu, y: emu, w: size, h: size, rot: angle, flipH: flag, flipV: flag },
  { align: choice(alignments), distribute: choice(["horizontal", "vertical"]) },
)
