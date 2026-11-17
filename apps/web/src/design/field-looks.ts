import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  List,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  Type,
  ArrowDownUp,
  ArrowUpToLine,
  ArrowDownToLine,
  Image,
  Minus,
  PaintBucket,
  Blend,
  Grid2X2,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  type LucideIcon,
} from "lucide-react"
import { optionWord } from "@/copy/option-copy"
import type { PanelRow } from "./panel"

export type FieldLook = {
  readonly icon?: LucideIcon
  readonly short?: string
  readonly line?: string
  readonly beside?: true
  readonly quiet?: true
  readonly order?: number
  readonly options?: Readonly<Record<string, LucideIcon>>
}

const fills = { none: Minus, solid: PaintBucket, gradient: Blend, pattern: Grid2X2, picture: Image }

export const fieldLooks: Readonly<Record<string, FieldLook>> = {
  "text.value": { order: 0 },
  "text.font": { quiet: true, order: 1 },
  "text.size": { icon: Type, line: "type-size", order: 2 },
  "text.lineSpacing": { icon: ArrowDownUp, line: "type-size", order: 3 },
  "text.bold": { icon: Bold, line: "format", order: 4 },
  "text.italic": { icon: Italic, line: "format", order: 5 },
  "text.underline": { icon: Underline, line: "format", order: 6 },
  "text.align": {
    quiet: true,
    options: { left: AlignLeft, center: AlignCenter, right: AlignRight },
    line: "paragraph",
    order: 7,
  },
  "text.bullet": { icon: List, line: "paragraph", order: 8 },
  "text.color": { quiet: true, order: 9 },
  "text.spaceBefore": { icon: ArrowUpToLine, line: "spacing", order: 10 },
  "text.spaceAfter": { icon: ArrowDownToLine, line: "spacing", order: 11 },
  "box.x": { short: "X", line: "position" },
  "box.y": { short: "Y", line: "position" },
  "box.w": { short: "W", line: "size" },
  "box.h": { short: "H", line: "size" },
  "box.rot": { icon: RotateCw, line: "rotation" },
  "box.flipH": { icon: FlipHorizontal2, line: "rotation" },
  "box.flipV": { icon: FlipVertical2, line: "rotation" },
  "box.align": {
    quiet: true,
    options: {
      left: AlignStartVertical,
      center: AlignCenterVertical,
      right: AlignEndVertical,
      top: AlignStartHorizontal,
      middle: AlignCenterHorizontal,
      bottom: AlignEndHorizontal,
    },
  },
  "box.distribute": {
    quiet: true,
    options: { horizontal: AlignHorizontalDistributeCenter, vertical: AlignVerticalDistributeCenter },
  },
  "fill.value": { options: fills },
  "fill.value.solid": { quiet: true },
  "line.fill": { options: fills },
  "line.fill.solid": { quiet: true },
  "line.width": { icon: Minus, line: "stroke" },
  "line.dash": { line: "stroke" },
  "line.cap": { line: "ends" },
  "line.compound": { line: "ends" },
  "line.join": { line: "join" },
  "line.head": { line: "arrows" },
  "line.tail": { line: "arrows" },
  "opacity.opacity": { beside: true },
}

export function lookOf(row: Pick<PanelRow, "trait" | "field">): FieldLook {
  return fieldLooks[`${row.trait}.${row.field}`] ?? {}
}

export function linesOf(rows: readonly PanelRow[]): readonly (readonly PanelRow[])[] {
  const lines: PanelRow[][] = []
  const grouped = new Map<string, PanelRow[]>()
  const ordered = [...rows].sort((a, b) => (lookOf(a).order ?? 100) - (lookOf(b).order ?? 100))
  for (const row of ordered) {
    const line = lookOf(row).line
    const existing = line === undefined ? undefined : grouped.get(line)
    if (existing !== undefined) existing.push(row)
    else {
      const next = [row]
      lines.push(next)
      if (line !== undefined) grouped.set(line, next)
    }
  }
  return lines
}

export type ChoiceLayout = "segments" | "list"

export function choiceLayout(field: string, options: readonly string[]): "segments" | "list" {
  return options.length > 4 || options.some((option) => optionWord(field, option).length > 12) ? "list" : "segments"
}
