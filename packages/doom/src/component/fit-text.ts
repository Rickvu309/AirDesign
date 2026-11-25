import { type Measure, type Measured, type Text, type Theme, textLimits } from "../index.js"
import { finite, naming, reject } from "../read-kit.js"
import type { GroupedText, Kept, PreparedPart, TextPart } from "./nodes.js"
import type { TextFitFinding } from "./findings.js"
import { type Charge, numeric } from "./values.js"

export type FittingContext = {
  readonly measure: Measure
  readonly theme: Theme
  readonly charge: Charge
}

export const textSize = finite(textLimits.size.min, textLimits.size.max)
const tolerance = 1e-6

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

function prepareFit(part: TextPart, size: number, context: FittingContext, wrap: boolean): Fit {
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
  const filled = text.overflow === "ellipsis"
  const single = measurePart(part, resized, context, wrap && !filled ? "two-lines" : undefined)
  if (filled && wrap && !fits(part, single, Infinity)) {
    const wrapped = measurePart(part, resized, context, undefined, box.w)
    const ink = Math.max(0, ...wrapped.lines.map((line) => line.ink))
    const inset = (text.padding?.l ?? 0) + (text.padding?.r ?? 0)
    return { part, text: resized, size, single, split: undefined, wrapped, neededWidth: ink + inset }
  }
  const candidate = single.wordFit
  const split = candidate !== undefined && candidate.h <= box.h + tolerance ? candidate : undefined
  return { part, text: resized, size, single, split, neededWidth: Math.min(single.w, split?.w ?? Infinity) }
}

function withWidth(fit: Fit, part: TextPart): TextPart | undefined {
  if (fits(part, fit.single, 2)) return withText(part, fit.text)
  if (
    fit.wrapped !== undefined &&
    fits(part, fit.wrapped, Infinity) &&
    fit.wrapped.lines.every((line) => line.ink <= line.w + tolerance)
  )
    return withText(part, fit.text)
  if (fit.split !== undefined && fit.split.w <= part.props.box.w + tolerance) return withText(part, fit.text)
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
  return part.props.fills === undefined ? found : { kind: "kept", part: withText(part, text), finding: found }
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
  return withWidth(fit, part) ?? missed(part, fit.text, finding(part, smaller, fit.neededWidth))
}

type Group = {
  readonly entries: GroupedText[]
  readonly fullSize: number
  readonly smaller: number
  readonly thin: number | undefined
  shrink: boolean
}

function widen(part: TextPart, width: number, x = part.props.box.x + (part.props.box.w - width) / 2): TextPart {
  const box = part.props.box
  return { ...part, props: { ...part.props, box: { ...box, x, w: width } } }
}

const center = ({
  part: {
    props: { box },
  },
}: Fit): number => box.x + box.w / 2

function thinGroup(fits: readonly Fit[], frameWidth: number, gap: number, charge: Charge) {
  const slots = fits.map((fit) => {
    const x = center(fit)
    const minimum = fit.neededWidth
    const capacity = 2 * Math.min(x, frameWidth - x)
    const left = x - minimum / 2
    const edgeLeft = Math.max(0, Math.min(left, frameWidth - minimum))
    const label = minimum <= frameWidth ? withWidth(fit, widen(fit.part, minimum, edgeLeft)) : undefined
    return { fit, x, left, edgeLeft, minimum, capacity, label }
  })
  type Slot = (typeof slots)[number] & { readonly placedLeft: number }
  const placed = new Map<TextPart, TextPart>()
  if (slots[0]?.label === undefined) {
    const first = slots.find(({ label }) => label !== undefined)
    if (first?.label !== undefined) placed.set(first.fit.part, first.label)
    return placed
  }

  let selected: Slot[] = []
  for (let stride = 1; stride <= slots.length; stride += 1) {
    charge()
    const sample: Slot[] = []
    for (let i = 0; i < slots.length; i += stride) {
      charge()
      const slot = slots[i]!
      const edge = i === 0 || i + stride >= slots.length
      const placedLeft = edge ? slot.edgeLeft : slot.left
      const before = sample.at(-1)
      if (
        slot.label === undefined ||
        (!edge && slot.capacity + tolerance < slot.minimum) ||
        (before !== undefined && placedLeft + tolerance < before.placedLeft + before.minimum + gap)
      )
        break
      sample.push({ ...slot, placedLeft })
    }
    if (sample.length === Math.ceil(slots.length / stride)) {
      selected = sample
      break
    }
  }

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
    placed.set(slot.fit.part, widen(slot.label, width, slot.x - width / 2))
  }
  return placed
}

export function* fitGroups(
  parts: readonly PreparedPart[],
  context: FittingContext,
  frameWidth: number,
): Iterable<Exclude<PreparedPart, GroupedText>> {
  const groups = new Map<string, Group>()
  const naturalFits = new Set<TextPart>()
  for (const entry of parts) {
    if (entry.kind !== "grouped-text") continue
    const { part, group, smaller, thin } = entry
    const { text } = part.props
    const fullSize = context.theme.textStyles[text.style].size
    const shared = groups.get(group) ?? { entries: [], fullSize, smaller, thin, shrink: false }
    if (shared.fullSize !== fullSize || shared.smaller !== smaller || shared.thin !== thin)
      naming(`${part.field}.fit.group`, () => reject("shape", "A fit group must share sizes and thinning settings."))
    if (thin !== undefined && part.props.fills !== undefined)
      naming(`${part.field}.fit.thin`, () => reject("shape", "A filled text is never thinned."))
    if (thin !== undefined && text.paras.some((para) => para.align !== "center"))
      naming(`${part.field}.fit.thin`, () => reject("shape", "Thinning requires centered text."))
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
        if (withWidth(natural, part) !== undefined) return natural
      }
      return prepareFit(part, group.smaller, context, true)
    })
    for (const fit of fits) {
      const part = withWidth(fit, fit.part)
      if (part !== undefined) fitted.set(fit.part, part)
    }
    const omitted = fits.filter(({ part }) => !fitted.has(part))
    if (omitted.length === 0) continue
    if (group.thin === undefined) {
      for (const fit of omitted)
        fitted.set(fit.part, missed(fit.part, fit.text, finding(fit.part, fit.size, fit.neededWidth)))
      continue
    }

    const ordered = [...fits].sort((a, b) => center(a) - center(b))
    const selected = thinGroup(ordered, frameWidth, group.thin, context.charge)
    for (const { part } of fits) fitted.delete(part)
    for (const [key, part] of selected) fitted.set(key, part)
    if (selected.size < fits.length) {
      const lanes = new Map(group.entries.map((entry) => [entry.part, entry.laneWidth]))
      const deficit = (fit: Fit) => fit.neededWidth - (lanes.get(fit.part) ?? fit.part.props.box.w)
      const empty = selected.size === 0
      const example = empty
        ? fits.reduce((a, b) => (a.neededWidth <= b.neededWidth ? a : b))
        : omitted.reduce((a, b) => (deficit(a) >= deficit(b) ? a : b))
      yield {
        ...finding(example.part, example.size, example.neededWidth, empty ? frameWidth : lanes.get(example.part)),
        key: [name],
        thinned: fits.length - selected.size,
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
