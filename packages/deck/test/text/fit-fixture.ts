import {fixtureDeck} from "../../src/fixture.ts"
import {initialHistory} from "../../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../../change-log/src/text/history-transducer.ts"
import type {NativeText} from "../../src/text/native-v3.ts"

export function fitFixture(): NativeText {
  const deck = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(1, 1)), immutable: {version: 2, events: [], receipts: []}}).history.deck
  const text = deck.slides[0]?.elements[0]
  if (text?.kind !== "text") throw new Error("fixture-text-required")
  text.body.frame.autofit = {kind: "shrink", fontScale: 0.62537, lineReduction: 0.12347}
  return text
}
