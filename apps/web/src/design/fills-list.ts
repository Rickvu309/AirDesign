import {
  changeFills,
  listedPaints,
  listedSlots,
  type FillsListEdit,
  type ScopedElement,
  type SetChange,
  type ShownFills,
  type SlotPaint,
} from "@airdesign/document"
import { ArrowDown, ArrowUp, Eye, EyeOff, Minus } from "lucide-react"
import { fillCopy } from "@/copy/fill-copy"
import { resolveControl } from "./panel-arrangement"
import type { PanelControl } from "./panel"

const added: Readonly<Record<string, SlotPaint>> = {
  solid: { solid: { scheme: "bg2" } },
  gradient: {
    gradient: {
      stops: [
        { pos: 0, color: { scheme: "tx1", transforms: [{ op: "alpha", val: 0 }] } },
        { pos: 100_000, color: { scheme: "tx1" } },
      ],
      shade: { linear: { angle: 5_400_000, scaled: false } },
      rotateWithShape: true,
    },
  },
  pattern: { pattern: { preset: "pct20", fg: { scheme: "tx1" }, bg: { scheme: "bg1" } } },
}

function listChange(view: ScopedElement, shown: ShownFills, edit: FillsListEdit): SetChange {
  const slots = listedSlots(shown, edit)
  if (slots === null) return { target: { node: view.node } }
  const patch = changeFills({ slots }, shown)
  const fills = Object.fromEntries(
    Object.entries(patch).flatMap(([slot, value]) => (typeof value === "object" ? [[slot, value.set]] : [])),
  )
  return { target: { node: view.node }, fills } as SetChange
}

function paintValue(paint: SlotPaint, shown: ShownFills): unknown {
  return "image" in paint ? { image: shown.source ?? null } : paint
}

function pictureMark(paint: PanelControl, shown: ShownFills, listed: SlotPaint | undefined): PanelControl {
  if (paint.desc.kind !== "union" || listed === undefined || !("image" in listed)) return paint
  const source = shown.source
  if (typeof source === "string" && !source.includes(":")) return paint
  return { ...paint, desc: { ...paint.desc, cases: { ...paint.desc.cases, image: { kind: "mark" } } } }
}

function paintRow(
  paint: PanelControl,
  view: ScopedElement,
  shown: ShownFills,
  at: number,
  count: number,
): PanelControl {
  const listed = listedPaints(shown)[at]
  return {
    ...pictureMark(paint, shown, listed?.paint),
    label: fillCopy.paint(at, count),
    value: listed === undefined ? undefined : paintValue(listed.paint, shown),
    inherited: false,
    reset: null,
    change: (value) => {
      if (typeof value === "object" && value !== null && "image" in value) {
        const image = listChange(view, shown, { at, paint: { image: true } })
        const source = (value as { readonly image: unknown }).image
        return typeof source === "string" ? { ...image, fills: { ...image.fills, source } } : image
      }
      return listChange(view, shown, { at, paint: value as SlotPaint })
    },
  }
}

function orderRow(
  view: ScopedElement,
  shown: ShownFills,
  at: number,
  count: number,
  listed: { readonly hidden: boolean },
): PanelControl {
  const options = [
    ...(at < count - 1 ? ["up"] : []),
    ...(at > 0 ? ["down"] : []),
    listed.hidden ? "show" : "hide",
    "remove",
  ]
  return {
    trait: "fills",
    field: `order.${String(at)}`,
    label: fillCopy.paint(at, count),
    kind: "action",
    look: {
      name: { show: count === 1 ? "hidden" : "above" },
      options: { up: ArrowUp, down: ArrowDown, hide: Eye, show: EyeOff, remove: Minus },
      form: "header",
    },
    desc: { kind: "choice", options },
    value: undefined,
    mixed: false,
    inherited: false,
    reset: null,
    change: (value) => {
      if (value === "up") return listChange(view, shown, { move: at, to: at + 1 })
      if (value === "down") return listChange(view, shown, { move: at, to: at - 1 })
      if (value === "hide" || value === "show") return listChange(view, shown, { hide: at, hidden: value === "hide" })
      return listChange(view, shown, { remove: at })
    },
  }
}

function addRow(view: ScopedElement, shown: ShownFills, count: number): PanelControl {
  return resolveControl({
    trait: "fills",
    field: "add",
    label: fillCopy.add,
    desc: { kind: "choice", options: count >= 4 ? [] : Object.keys(added) },
    value: undefined,
    mixed: false,
    inherited: false,
    reset: null,
    change: (value) => {
      const paint = typeof value === "string" ? added[value] : undefined
      return paint === undefined ? { target: { node: view.node } } : listChange(view, shown, { add: paint })
    },
  })
}

export function fillsList(
  paint: PanelControl,
  view: ScopedElement,
  shown: ShownFills,
): readonly (readonly PanelControl[])[] {
  const listed = listedPaints(shown)
  const rows = listed.map((each, at) => {
    return [
      [orderRow(view, shown, at, listed.length, { hidden: each.hidden })],
      [paintRow(paint, view, shown, at, listed.length)],
    ]
  })
  return [...rows.toReversed().flat(), [addRow(view, shown, listed.length)]]
}
