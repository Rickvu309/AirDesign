import {
  assetIcon,
  iconWeights,
  type CropRead,
  type Design,
  type DesignKey,
  type ElementPatch,
  type FieldEdit,
  type FieldValue,
  type RecolorRead,
  type Shown,
} from "@airdesign/document"
import { agentColor, agentPercent } from "./agent-color.js"

const hundredthsPerPoint = 100

function tenths(value: number): number {
  return Math.round(value * 10) / 10
}

function agentRecolor(recolor: RecolorRead): string {
  return recolor === "grayscale" ? recolor : `duotone ${agentColor(recolor.dark)}, ${agentColor(recolor.light)}`
}

function agentCrop(crop: CropRead): string {
  return `l ${agentPercent(crop.l)} t ${agentPercent(crop.t)} r ${agentPercent(crop.r)} b ${agentPercent(crop.b)}`
}

export const imageAgents = {
  "fills.source": (value: string) => value,
  "fills.weight": (value: number) => tenths(value / hundredthsPerPoint),
  "fills.color": agentColor,
  "fills.mode": (value: string) => value,
  "fills.recolor": agentRecolor,
  "fills.crop": agentCrop,
} as const

function folded<V>(
  design: Design,
  key: DesignKey,
  edit: FieldEdit<V> | undefined,
  shown: (value: V) => Shown[0] | null,
): Design {
  if (edit === undefined || edit === "opening") return design
  const rest: Design = Object.fromEntries(Object.entries(design).filter(([each]) => each !== key))
  const value = edit === "inherit" ? null : shown(edit.set)
  return value === null ? rest : { ...rest, [key]: [value] }
}

type Recolor = FieldValue<"fills", "recolor">

const recolorShown = (recolor: Recolor) =>
  "none" in recolor ? null : agentRecolor("grayscale" in recolor ? "grayscale" : recolor.duotone)

export function foldImage(design: Design, fills: ElementPatch["fills"]): Design {
  let next = folded(design, "fills.source", fills?.source, (value) => assetIcon(value))
  next = folded(next, "fills.weight", fills?.weight, (value) =>
    value === iconWeights.lucide ? null : tenths(value / hundredthsPerPoint),
  )
  next = folded(next, "fills.color", fills?.color, (value) =>
    "rgb" in value && value.rgb === "000000" && value.transforms === undefined ? null : agentColor(value),
  )
  next = folded(next, "fills.mode", fills?.mode, (value) => (value === "stretch" ? null : value))
  next = folded(next, "fills.recolor", fills?.recolor, recolorShown)
  return folded(next, "fills.crop", fills?.crop, (value) =>
    value.l + value.t + value.r + value.b === 0 ? null : agentCrop(value),
  )
}
