import {isId, type Id} from "../model.ts"
import {isParagraph, isTextFrame} from "./body-codec.ts"
import type {Paragraph, TextFrame} from "./body.ts"
import {isNativeDeck, isNativeElement, isNativeSlide, type NativeDeck, type NativeElement, type NativeSlide} from "./native-v3.ts"

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
