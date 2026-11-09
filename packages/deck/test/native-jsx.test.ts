import {placeholderId} from "../src/model.ts"
import {expect, it} from "vitest"
import {fixtureDeck} from "../src/fixture.ts"
import {fromJsx, toJsx, type DeckJsxAdapter} from "../src/jsx.ts"
import {initialHistory} from "../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../change-log/src/text/history-transducer.ts"
it("roundtrips body-only JSX and refuses legacy runs, duplicate body IDs and missing references", () => {
  const deck = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(1)), immutable: {version: 2, events: [], receipts: []}}).history.deck
  const adapter: DeckJsxAdapter<string> = {toJsx: JSON.stringify, fromJsx: JSON.parse}
  const nativeText = deck.slides[0]!.elements[0]!
  if (nativeText.kind !== "text") throw new Error("text-required")
  const paragraph = nativeText.body.paragraphs[0]
  paragraph.endStyle = {...paragraph.endStyle, letterSpacing: 2, baseline: 0.25, strike: true, capitalization: "small", kerning: 12}
  paragraph.runs = [{kind: "text", text: "Native style", style: paragraph.endStyle}]
  paragraph.marker = {kind: "bullet", character: "•", font: "Arial"}
  expect(fromJsx(toJsx(deck, adapter), adapter)).toEqual(deck)
  expect(() => fromJsx(JSON.stringify(fixtureDeck(1)), adapter)).toThrow("invalid-native-archive-v3")
  const text = deck.slides[0]!.elements[0]!
  if (text.kind !== "text") throw new Error("text-required")
  const frameId = text.body.frame.id
  text.body.frame.id = text.body.paragraphs[0].id
  expect(() => fromJsx(JSON.stringify(deck), adapter)).toThrow("invalid-native-archive-v3")
  text.body.frame.id = text.id
  expect(() => fromJsx(JSON.stringify(deck), adapter)).toThrow("duplicate-native-node-id")
  text.body.frame.id = frameId
  deck.slides[0]!.theme = null
  text.placeholder = placeholderId("missing")
  expect(() => fromJsx(JSON.stringify(deck), adapter)).toThrow("invalid-placeholder-reference")
})
