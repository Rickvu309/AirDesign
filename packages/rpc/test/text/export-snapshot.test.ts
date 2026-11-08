import {expect, it} from "vitest"
import {fixtureDeck} from "../../../deck/src/fixture.ts"
import {initialHistory} from "../../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../../change-log/src/text/history-transducer.ts"
import {decodeExportSnapshot, selectExportSlides} from "../../src/text/export-snapshot.ts"

it("decodes frozen deck bytes only at their explicit snapshot version", () => {
  const deck = fixtureDeck(1), legacy = {deck, seq: 0, source: null, title: "Retained export"}
  const native = {...legacy, deck: transduceLegacyHistory({version: 2, history: initialHistory(deck), immutable: {version: 2, events: [], receipts: []}}).history.deck}
  expect(decodeExportSnapshot(2, legacy)).toEqual({snapshotVersion: 2, snapshot: legacy})
  expect(decodeExportSnapshot(3, native)).toEqual({snapshotVersion: 3, snapshot: native})
  expect(() => decodeExportSnapshot(2, native)).toThrow()
  expect(() => decodeExportSnapshot(3, legacy)).toThrow()
  expect(() => decodeExportSnapshot(4, native)).toThrow("unsupported-export-snapshot-version")
  expect(() => decodeExportSnapshot(3, {...native, seq: -1})).toThrow("invalid-saved-version")
})

it("exports the requested saved slide order and refuses unknown slides", () => {
  const slides = [{id: "first"}, {id: "second"}]
  expect(selectExportSlides(slides, ["second", "first"])).toEqual([slides[1], slides[0]])
  expect(selectExportSlides(slides, [])).toEqual(slides)
  expect(() => selectExportSlides(slides, ["missing"])).toThrow("invalid-slide-range")
})
