import {isId, type Id} from "../model.ts"
import {isParagraph, isTextFrame} from "./body-codec.ts"
import type {Paragraph, TextFrame} from "./body.ts"
import {isNativeDeck, isNativeElement, isNativeSlide, type NativeDeck, type NativeElement, type NativeSlide, type NativeText} from "./native-v3.ts"

export type NativeValue = NativeDeck | NativeSlide | NativeElement | Paragraph | TextFrame
export type NativeChange = {kind: "insert"; parent: Id; index: number; value: NativeSlide | NativeElement | Paragraph} | {kind: "set"; target: Id; value: NativeValue} | {kind: "move"; target: Id; parent: Id; index: number} | {kind: "remove"; target: Id}
export type NativeChangeSet = {changes: NativeChange[]}
export function parseNativeChangeSet(value: unknown): NativeChangeSet {
  if (!value || typeof value !== "object" || !("changes" in value) || !Array.isArray(value.changes)) throw new Error("invalid-native-changes")
  return {changes: value.changes.map((change: unknown): NativeChange => {
    if (!change || typeof change !== "object" || !("kind" in change)) throw new Error("invalid-native-change")
    if (change.kind === "remove" && "target" in change && isId(change.target)) return {kind: "remove", target: change.target}
    if (change.kind === "set" && "target" in change && isId(change.target) && "value" in change && (isNativeDeck(change.value) || isNativeSlide(change.value) || isNativeElement(change.value) || isParagraph(change.value) || isTextFrame(change.value))) return {kind: "set", target: change.target, value: change.value}
    if ((change.kind === "insert" || change.kind === "move") && "parent" in change && isId(change.parent) && "index" in change && typeof change.index === "number" && Number.isSafeInteger(change.index) && change.index >= 0) {
      if (change.kind === "insert" && "value" in change && (isNativeSlide(change.value) || isNativeElement(change.value) || isParagraph(change.value))) return {kind: "insert", parent: change.parent, index: change.index, value: change.value}
      if (change.kind === "move" && "target" in change && isId(change.target)) return {kind: "move", parent: change.parent, index: change.index, target: change.target}
    }
    throw new Error("invalid-native-change")
  })}
}

export type TextMeasurement = {width: number; height: number}
export type MeasureText = (text: NativeText) => Promise<TextMeasurement>

function sameLayout(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => sameLayout(value, b[index]))
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false
  const left = Object.entries(a).filter(([key, value]) => value !== undefined && !["color", "highlight", "outerShadow", "opacity", "underline", "strike"].includes(key))
  const right = Object.entries(b).filter(([key, value]) => value !== undefined && !["color", "highlight", "outerShadow", "opacity", "underline", "strike"].includes(key))
  return left.length === right.length && left.every(([key, value]) => right.some(([other, field]) => other === key && sameLayout(value, field)))
}

export function textFitChanged(previous: NativeText, next: NativeText): boolean {
  return previous.box.width !== next.box.width || previous.box.height !== next.box.height || !sameLayout(previous.body, next.body)
}

export async function prepareNativeTextEdit(previous: NativeText, next: NativeText, measure: MeasureText): Promise<NativeChangeSet> {
  if (previous.id !== next.id) throw new Error("text-fit-target-mismatch")
  const value = structuredClone(next)
  const change = (): NativeChangeSet => ({changes: [{kind: "set", target: value.id, value}]})
  const fit = value.body.frame.autofit
  if (fit.kind === "none" || !textFitChanged(previous, next)) return change()
  const read = async () => {
    const result = await measure(structuredClone(value))
    if (![result.width, result.height].every(number => Number.isFinite(number) && number >= 0)) throw new Error("invalid-text-measurement")
    return result
  }
  const fits = (size: TextMeasurement) => size.width <= value.box.width && size.height <= value.box.height
  if (fit.kind === "shrink") {
    let low = 1, high = 100000
    const at = async (step: number) => {
      value.body.frame.autofit = {kind: "shrink", fontScale: step / 100000, lineReduction: 0}
      return fits(await read())
    }
    if (await at(high)) return change()
    if (!await at(low)) throw new Error("text-fit-unavailable")
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2)
      if (await at(middle)) low = middle
      else high = middle
    }
    if (!await at(low)) throw new Error("text-fit-unstable")
  } else {
    for (let attempt = 0; attempt < 4; attempt++) {
      const size = await read()
      const vertical = value.body.frame.verticalFlow === "vertical270"
      if (value.body.frame.wrap === "none" || vertical) value.box.width = Math.ceil(size.width * 64) / 64
      if (value.body.frame.wrap === "none" || !vertical) value.box.height = Math.ceil(size.height * 64) / 64
      if (fits(await read())) return change()
    }
    throw new Error("text-fit-unstable")
  }
  return change()
}
