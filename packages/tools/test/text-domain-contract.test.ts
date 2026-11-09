import {expect, it} from "vitest"
import {textDomainContract} from "../src/text/domain-contract.ts"
import {decodeLegacyRunsV2} from "../../deck/src/text/legacy-v2.ts"
import {parseTextBody} from "../../deck/src/text/body-codec.ts"
import {id} from "../../deck/src/model.ts"

it.each([
  {kind: "number", format: "decimal", punctuation: "plain", start: null},
  {kind: "number", format: "romanUpper", punctuation: "parentheses", start: 4},
  {kind: "number", format: "alphaLower", start: 27},
  {kind: "source-number", scheme: "thaiAlphaPeriod", start: null},
])("shares the validated marker with the stored codec: %j", value => {
  const contract = textDomainContract.parse({kind: "paragraph-marker", value})
  const body = decodeLegacyRunsV2([{text: "", font: "Geist", size: 20, color: "#123456", bold: false}], id("contractFrame"), id("contractParagraph"))
  body.paragraphs[0].marker = contract.value
  expect(parseTextBody(body).paragraphs[0].marker).toEqual(value)
})
it.each([
  {kind: "number", format: "romanUpper", punctuation: "plain", start: null},
  {kind: "number", format: "decimal", punctuation: "colon", start: 1},
  {kind: "number", format: "decimal", start: 0},
  {kind: "number", format: "decimal", punctuation: null, start: null},
  {kind: "source-number", scheme: "madeUp", start: null},
  {kind: "source-number", scheme: "thaiAlphaPeriod", start: 32768},
  {kind: "source-number", scheme: "thaiAlphaPeriod", start: null, xml: "<evil/>"},
])("rejects invalid domain input in contract and stored codec: %j", value => {
  expect(textDomainContract.safeParse({kind: "paragraph-marker", value}).success).toBe(false)
  const body = decodeLegacyRunsV2([{text: "", font: "Geist", size: 20, color: "#123456", bold: false}], id("badFrame"), id("badParagraph"))
  expect(() => parseTextBody({...body, paragraphs: [{...body.paragraphs[0], marker: value}]})).toThrow()
})
it("keeps the contract strict and compact", () => {
  expect(textDomainContract.safeParse({kind: "paragraph-marker", value: {kind: "none"}, extra: true}).success).toBe(false)
  expect(JSON.stringify(textDomainContract.toJSONSchema({unrepresentable: "any"})).length).toBeLessThan(8000)
})
