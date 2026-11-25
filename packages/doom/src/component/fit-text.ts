import { resolveColor } from "../color.js"
import type { Measure, Measured } from "../measure.js"
import { type Text, textLimits } from "../text.js"
import { paragraphCuts } from "../text-ellipsis.js"
import type { Theme } from "../theme.js"
import { finite, naming, reject } from "../read-kit.js"
import type { GroupedText, Kept, PreparedPart, TextPart } from "./nodes.js"
import type { TextFitFinding } from "./findings.js"
import { type Charge, color, numeric } from "./values.js"

export type FittingContext = {
  readonly measure: Measure
  readonly theme: Theme
  readonly charge: Charge
}

export const textSize = finite(textLimits.size.min, textLimits.size.max)
const tolerance = 1e-6
const spill = 1

export function measurePart(
  part: TextPart,
  text: Text,
  context: FittingContext,
  fit?: "two-lines",
  width: number | null = null,
): Measured {
  return naming(`${part.field}.fit`, () => measureText(text, context, fit, width))
}

export function measureText(
  text: Text,
  { measure, theme, charge }: FittingContext,
  fit?: "two-lines",
  width: number | null = null,
): Measured {
  charge(96 + (fit === undefined ? 2 : 6) * text.chars.length + 8 * (text.paras.length - 1))
  return measure(text, theme, width, fit)
}

export function fits(part: TextPart, result: Measured, limit: number): boolean {
  return (
    numeric(result.w) <= part.props.box.w + tolerance &&
    numeric(result.h) <= part.props.box.h + tolerance &&
    result.lines.length <= (part.props.text.overflow === "ellipsis" ? Infinity : limit)
  )
}

function withText(part: TextPart, text: Text): TextPart {
  return { ...part, props: { ...part.props, text } }
}

type Fit = {
  readonly part: TextPart
  readonly text: Text
  readonly size: number
  readonly single: Measured
  readonly split: Measured["wordFit"]
  readonly wrapped?: Measured
  readonly neededWidth: number
}

function prepareFit(
  part: TextPart,
  size: number,
  context: FittingContext,
  wrap: boolean,
  height = part.props.box.h,
): Fit {
  const { text, box } = part.props
  const base = context.theme.textStyles[text.style].size
  const resized =
    size === base
      ? text
      : {
          ...text,
          spans: text.spans.map((span) => ({
            ...span,
            size: span.size === undefined ? size : Math.max(1, (span.size * size) / base),
          })),
        }
  const keepsOverflow = text.overflow === "ellipsis"
  const single = measurePart(part, resized, context, wrap && !keepsOverflow ? "two-lines" : undefined)
  if (keepsOverflow && wrap && !fits(part, single, Infinity)) {
    const wrapped = measurePart(part, resized, context, undefined, box.w)
    const ink = Math.max(0, ...wrapped.lines.map((line) => line.ink))
    const inset = (text.padding?.l ?? 0) + (text.padding?.r ?? 0)
    return { part, text: resized, size, single, split: undefined, wrapped, neededWidth: ink + inset }
  }
  const candidate = single.wordFit
  const split = candidate !== undefined && candidate.h <= height + tolerance ? candidate : undefined
  return { part, text: resized, size, single, split, neededWidth: Math.min(single.w, split?.w ?? Infinity) }
}

function requiredWidth(fit: Fit, context: FittingContext): number {
  if (fit.wrapped === undefined || paragraphCuts(fit.text, fit.wrapped.lines).size === 0) return fit.neededWidth
  let narrow = Math.floor(fit.part.props.box.w)
  let wide = Math.ceil(fit.single.w)
  while (wide - narrow > 1) {
    const width = Math.floor((narrow + wide) / 2)
    const { lines } = measurePart(fit.part, fit.text, context, undefined, width)
    if (paragraphCuts(fit.text, lines).size === 0 && lines.every((line) => line.ink <= line.w + tolerance)) wide = width
    else narrow = width
  }
  return wide
}

function withFit(fit: Fit, part: TextPart): TextPart | undefined {
  if (fits(part, fit.single, 2)) return withText(part, fit.text)
  if (
    fit.wrapped !== undefined &&
    fits(part, fit.wrapped, Infinity) &&
    paragraphCuts(fit.text, fit.wrapped.lines).size === 0 &&
    fit.wrapped.lines.every((line) => line.ink <= line.w + tolerance)
  )
    return withText(part, fit.text)
  if (
    fit.split !== undefined &&
    fit.split.w <= part.props.box.w + tolerance &&
    fit.split.h <= part.props.box.h + tolerance
  )
    return withText(part, fit.text)
}

function finding(part: TextPart, size: number, neededWidth: number, availableWidth = part.props.box.w): TextFitFinding {
  return {
    kind: "text-fit",
    key: part.key,
    field: `${part.field}.chars`,
    size,
    neededWidth,
    availableWidth,
  }
}

function missed(part: TextPart, text: Text, found: TextFitFinding): Kept | TextFitFinding {
  return text.overflow === "ellipsis" ? { kind: "kept", part: withText(part, text), finding: found } : found
}

export function overflowing(part: TextPart, context: FittingContext): TextPart | Kept {
  const { text, box } = part.props
  if (text.overflow === "ellipsis" || text.chars === "") return part
  const measured = measurePart(part, text, context, undefined, box.w)
  const inset = (text.padding?.l ?? 0) + (text.padding?.r ?? 0)
  const ink = Math.max(0, ...measured.lines.map((line) => line.ink)) + inset
  if (measured.h <= box.h + spill && ink <= box.w + spill) return part
  return {
    kind: "kept",
    part,
    finding: {
      kind: "text-overflow",
      key: part.key,
      field: part.field,
      neededWidth: Math.ceil(Math.max(ink, box.w)),
      neededHeight: Math.ceil(measured.h),
      availableWidth: box.w,
      availableHeight: box.h,
    },
  }
}

export function fitOne(
  part: TextPart,
  smaller: number | undefined,
  context: FittingContext,
): TextPart | Kept | TextFitFinding {
  const natural = measurePart(part, part.props.text, context)
  if (fits(part, natural, smaller === undefined ? Infinity : 2)) return part
  if (smaller === undefined)
    return missed(part, part.props.text, finding(part, context.theme.textStyles[part.props.text.style].size, natural.w))
  const fit = prepareFit(part, smaller, context, true)
  return withFit(fit, part) ?? missed(part, fit.text, finding(part, smaller, requiredWidth(fit, context)))
}

type Group = {
  readonly entries: GroupedText[]
  readonly fullSize: number
  readonly smaller: number
  readonly thin: number | undefined
  readonly axis: GroupedText["axis"]
  readonly advice: string | undefined
  shrink: boolean
}

function thinGroup(
  fits: readonly Fit[],
  frameSpan: number,
  gap: number,
  axis: Group["axis"],
  charge: Charge,
  kept: ReadonlySet<TextPart>,
) {
  const across = axis === "horizontal"
  const center = ({
    part: {
      props: { box },
    },
  }: Fit) => (across ? box.x + box.w / 2 : box.y + box.h / 2)
  const place = (part: TextPart, start: number, span: number): TextPart => {
    const box = part.props.box
    return {
      ...part,
      props: { ...part.props, box: across ? { ...box, x: start, w: span } : { ...box, y: start, h: span } },
    }
  }
  const ordered = [...fits].sort((a, b) => center(a) - center(b))
  const firstBox = ordered[0]?.part.props.box
  const last = ordered.at(-1)?.part.props.box
  const from = across ? 0 : Math.max(0, firstBox?.y ?? 0)
  const to = across || last === undefined ? frameSpan : Math.min(frameSpan, last.y + last.h)
  const slots = ordered.map((fit) => {
    const x = center(fit)
    const { w } = fit.part.props.box
    const minimum = across
      ? fit.neededWidth
      : Math.min(
          fit.single.w <= w + tolerance && fit.single.lines.length <= 2 ? fit.single.h : Infinity,
          fit.split !== undefined && fit.split.w <= w + tolerance ? fit.split.h : Infinity,
        )
    const capacity = 2 * Math.min(x - from, to - x)
    const left = x - minimum / 2
    const edgeLeft = Math.max(from, Math.min(left, to - minimum))
    const label = minimum <= to - from ? withFit(fit, place(fit.part, edgeLeft, minimum)) : undefined
    return { fit, x, left, edgeLeft, minimum, capacity, label, keep: kept.has(fit.part) }
  })
  type Slot = (typeof slots)[number] & { readonly placedLeft: number }
  const pinned = slots.filter(({ keep }) => keep)
  const optional = slots.filter(({ keep }) => !keep)
  const placed = new Map<TextPart, TextPart>()
  if (pinned.length === 0 && slots[0]?.label === undefined) {
    const first = slots.find(({ label }) => label !== undefined)
    if (first?.label !== undefined) placed.set(first.fit.part, first.label)
    return placed
  }

  const first =
    pinned.length === 0
      ? 0
      : optional.findIndex((slot) => {
          if (slot.label === undefined) return false
          const left = slot.x < pinned[0]!.x || slot.x > pinned.at(-1)!.x ? slot.edgeLeft : slot.left
          return pinned.every((fixed) => {
            charge()
            return slot.x < fixed.x
              ? left + slot.minimum + gap <= fixed.edgeLeft + tolerance
              : left + tolerance >= fixed.edgeLeft + fixed.minimum + gap
          })
        })
  const sampleAt = (start: number, stride: number): Slot[] | undefined => {
    charge()
    const sample: Slot[] = []
    let i = start
    let fixed = 0
    while (i < optional.length || fixed < pinned.length) {
      charge()
      const candidate = optional[i]
      const required = pinned[fixed]
      const slot =
        required !== undefined && (candidate === undefined || required.x <= candidate.x) ? required : candidate!
      if (slot.keep) fixed += 1
      else i += stride
      const edge = sample.length === 0 || (i >= optional.length && fixed >= pinned.length)
      const placedLeft = edge || slot.keep ? slot.edgeLeft : slot.left
      const before = sample.at(-1)
      if (
        slot.label === undefined ||
        (!edge && !slot.keep && slot.capacity + tolerance < slot.minimum) ||
        (before !== undefined && placedLeft + tolerance < before.placedLeft + before.minimum + gap)
      )
        return undefined
      sample.push({ ...slot, placedLeft })
    }
    return sample
  }
  const required = pinned.map((slot) => ({ ...slot, placedLeft: slot.edgeLeft }))
  const canSample =
    first >= 0 &&
    required.every((slot, i) => {
      const before = required[i - 1]
      return (
        slot.label !== undefined &&
        (before === undefined || slot.placedLeft + tolerance >= before.placedLeft + before.minimum + gap)
      )
    })
  const choose = (): Slot[] => {
    if (!canSample) return required
    for (let stride = 1; first + stride <= optional.length; stride += 1) {
      const phases = pinned.length === 0 ? 1 : stride
      for (let offset = 0; offset < phases; offset += 1) {
        const sample = sampleAt(first + offset, stride)
        if (sample !== undefined) return sample
      }
    }
    return required
  }

  const selected = choose()
  for (const [i, slot] of selected.entries()) {
    if (slot.label === undefined) continue
    if (slot.left !== slot.placedLeft) {
      placed.set(slot.fit.part, slot.label)
      continue
    }
    const roomBeside = (neighbor: Slot | undefined) => {
      if (neighbor === undefined) return Infinity
      const room = Math.abs(neighbor.placedLeft + neighbor.minimum / 2 - slot.x) - gap
      return Math.min(room, 2 * room - neighbor.minimum)
    }
    const width = Math.max(
      slot.minimum,
      Math.min(slot.capacity, roomBeside(selected[i - 1]), roomBeside(selected[i + 1])),
    )
    placed.set(slot.fit.part, place(slot.label, slot.x - width / 2, width))
  }
  return placed
}

export function* fitGroups(
  parts: readonly PreparedPart[],
  context: FittingContext,
  frame: { readonly w: number; readonly h: number },
): Iterable<Exclude<PreparedPart, GroupedText>> {
  const groups = new Map<string, Group>()
  const naturalFits = new Set<TextPart>()
  for (const entry of parts) {
    if (entry.kind !== "grouped-text") continue
    const { part, group, smaller, thin, axis, advice } = entry
    const { text } = part.props
    const fullSize = context.theme.textStyles[text.style].size
    const shared = groups.get(group) ?? { entries: [], fullSize, smaller, thin, axis, advice, shrink: false }
    if (
      shared.fullSize !== fullSize ||
      shared.smaller !== smaller ||
      shared.thin !== thin ||
      shared.axis !== axis ||
      shared.advice !== advice
    )
      naming(`${part.field}.fit.group`, () => reject("shape", "A fit group must share sizes and thinning settings."))
    if (thin !== undefined && part.props.fills !== undefined)
      naming(`${part.field}.fit.thin`, () => reject("shape", "A filled text is never thinned."))
    if (
      thin !== undefined &&
      (axis === "horizontal" ? text.paras.some((para) => para.align !== "center") : text.alignV !== "center")
    )
      naming(`${part.field}.fit.thin`, () => reject("shape", "Text must be centered along its thinning axis."))
    shared.entries.push(entry)
    if (!shared.shrink) {
      if (fits(part, measurePart(part, text, context), 2)) naturalFits.add(part)
      else shared.shrink = true
    }
    groups.set(group, shared)
  }

  const fitted = new Map<TextPart, TextPart | Kept | TextFitFinding>()
  for (const [name, group] of groups) {
    if (!group.shrink) continue
    const fits = group.entries.map(({ part }) => {
      if (naturalFits.has(part)) {
        const natural = prepareFit(part, group.smaller, context, false)
        if (withFit(natural, part) !== undefined) return natural
      }
      return prepareFit(part, group.smaller, context, true, group.axis === "vertical" ? frame.h : undefined)
    })
    for (const fit of fits) {
      const part = withFit(fit, fit.part)
      if (part !== undefined) fitted.set(fit.part, part)
    }
    const omitted = fits.filter(({ part }) => !fitted.has(part))
    if (omitted.length === 0) continue
    if (group.thin === undefined) {
      for (const fit of omitted)
        fitted.set(fit.part, missed(fit.part, fit.text, finding(fit.part, fit.size, requiredWidth(fit, context))))
      continue
    }

    const kept = new Set(group.entries.filter(({ keep }) => keep).map(({ part }) => part))
    const selected = thinGroup(
      fits,
      group.axis === "horizontal" ? frame.w : frame.h,
      group.thin,
      group.axis,
      context.charge,
      kept,
    )
    for (const { part } of fits) fitted.delete(part)
    for (const [key, part] of selected) fitted.set(key, part)
    for (const fit of fits) {
      if (!kept.has(fit.part) || selected.has(fit.part)) continue
      fitted.set(fit.part, withText(fit.part, fit.text))
      yield finding(fit.part, fit.size, fit.neededWidth)
    }
    const thinned = fits.filter(({ part }) => !fitted.has(part))
    if (thinned.length > 0) {
      const lanes = new Map(group.entries.map((entry) => [entry.part, entry.laneWidth]))
      const deficit = (fit: Fit) => fit.neededWidth - (lanes.get(fit.part) ?? fit.part.props.box.w)
      const empty = selected.size === 0
      const example = empty
        ? thinned.reduce((a, b) => (a.neededWidth <= b.neededWidth ? a : b))
        : thinned.reduce((a, b) => (deficit(a) >= deficit(b) ? a : b))
      yield {
        ...finding(
          example.part,
          example.size,
          example.neededWidth,
          empty && group.axis === "horizontal" ? frame.w : lanes.get(example.part),
        ),
        key: [name],
        thinned: thinned.length,
        ...(group.advice === undefined ? {} : { advice: group.advice }),
      }
    }
  }

  for (const entry of parts) {
    if (entry.kind !== "grouped-text") yield entry
    else {
      const group = groups.get(entry.group)
      const part = group?.shrink ? fitted.get(entry.part) : entry.part
      if (part !== undefined) yield part
    }
  }
}

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((i) => {
    const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!
}

export function contrastInk(fill: unknown, first: unknown, second: unknown, theme: Theme) {
  const a = color(first)
  const b = color(second)
  const surface = luminance(resolveColor(color(fill), theme)) + 0.05
  const contrast = (ink: typeof a) => {
    const level = luminance(resolveColor(ink, theme)) + 0.05
    return Math.max(level, surface) / Math.min(level, surface)
  }
  return contrast(a) >= contrast(b) ? a : b
}
