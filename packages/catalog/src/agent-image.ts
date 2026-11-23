import { type CropRead, type RecolorRead } from "@airdesign/document"
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
