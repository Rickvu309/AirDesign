import {expect, it, vi} from "vitest"
import {fixtureDeck} from "../../../deck/src/fixture.ts"
import {prepareNativeTextEdit} from "../../../deck/src/text/operations.ts"
import {parseNativeArchiveV3, type NativeDeck} from "../../../deck/src/text/native-v3.ts"
import {commandId, initialHistory, projectHistory, type History} from "../../src/index.ts"
import {executeNative, nativeHistoryModel} from "../../src/text/native-model.ts"
import {transduceLegacyHistory} from "../../src/text/history-transducer.ts"

it.each(["shrink", "resize-shape"] as const)("accepts %s, geometry and text atomically with frozen reopen and undo/redo", async kind => {
  let history = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(1, 1)), immutable: {version: 2, events: [], receipts: []}}).history
  const previous = history.deck.slides[0]?.elements[0]
  if (previous?.kind !== "text") throw new Error("text-required")
  const next = structuredClone(previous)
  next.box.height = 80
  next.body.frame.autofit = kind === "shrink" ? {kind, fontScale: null, lineReduction: null} : {kind}
  next.body.paragraphs[0].runs = [{kind: "text", text: "A changed native paragraph", style: next.body.paragraphs[0].endStyle}]
  const measure = vi.fn(async (text: typeof next) => ({width: text.box.width, height: 240 * (text.body.frame.autofit.kind === "shrink" ? text.body.frame.autofit.fontScale ?? 1 : 1)}))
  const changes = await prepareNativeTextEdit(previous, next, measure)
  const result = executeNative(history, {id: commandId("measured-edit"), kind: "edit", base: history.seq, run: null, changes})
  expect(result.receipt.kind).toBe("applied")
  expect(result.history.events).toHaveLength(history.events.length + 1)
  history = result.history
  const accepted = structuredClone(history.deck)
  const frozen: History<NativeDeck> = JSON.parse(JSON.stringify(history))
  Object.freeze(frozen)
  expect(parseNativeArchiveV3({version: 3, deck: projectHistory(frozen, nativeHistoryModel)}).deck).toEqual(accepted)
  const calls = measure.mock.calls.length
  const undo = executeNative(frozen, {id: commandId("undo-fit"), kind: "undo", target: commandId("measured-edit")})
  expect(undo.receipt.kind).toBe("applied")
  expect(undo.history.deck.slides[0]?.elements[0]).toEqual(previous)
  const redo = executeNative(undo.history, {id: commandId("redo-fit"), kind: "redo", target: commandId("measured-edit")})
  expect(redo.receipt.kind).toBe("applied")
  expect(redo.history.deck.slides[0]?.elements[0]).toEqual(accepted.slides[0]?.elements[0])
  expect(projectHistory(redo.history, nativeHistoryModel)).toEqual(redo.history.deck)
  expect(measure).toHaveBeenCalledTimes(calls)
})
