import { readDeckId, readFindingsReport, type FindingsReport } from "@airdesign/catalog"
import { elementId, openRegister } from "@airdesign/document"
import { expect, it } from "vitest"
import { editLanded, editRefusal } from "./edit-answer.js"
import { editFindings } from "./edit-findings.js"

const id = readDeckId("deck")
if (!id.ok) throw new Error(id.refusal)
const deck = { id: id.deck, revision: 9, register: openRegister("", "deck") }

function report(raw: object): FindingsReport {
  const read = readFindingsReport({ deck: "deck", revision: 9, ...raw })
  if (!read.ok) throw new Error(read.refusal)
  return read
}

const small = (node: string) => ({ code: "small-text", node, size: 8, min: 10, uniform: true })

it("adds the findings on the slides an edit touched to its answer, in the JSON the agent reads", () => {
  const landed = editLanded(deck, [elementId("258.7")], "run", ["301"])
  const found = editFindings(landed, report({ findings: [small("258.9"), small("259.2"), small("301.4")] }))
  if (!found.ok || found.answer === undefined || !found.answer.ok) throw new Error("landed")
  expect(found.answer.findings).toEqual([
    {
      code: "small-text",
      node: "258.9",
      measure: "8 pt, under 10",
      fix: { op: "set", target: "258.9", text: { size: 10 } },
    },
    {
      code: "small-text",
      node: "301.4",
      measure: "8 pt, under 10",
      fix: { op: "set", target: "301.4", text: { size: 10 } },
    },
  ])
  expect(JSON.parse(found.content.at(-1)?.text ?? "{}")).toEqual(found.answer)
  expect(found.content[0]).toEqual(landed.content[0])
})

it("says pending, broken or missing in one word, and leaves a refusal alone", () => {
  const landed = editLanded(deck, [elementId("258.7")], "run")
  const word = (found: ReturnType<typeof editFindings>) =>
    found.ok && found.answer?.ok === true ? found.answer.findings : null
  expect(word(editFindings(landed, undefined))).toBe("missing")
  expect(word(editFindings(landed, { ...report({ findings: [] }), revision: 8 }))).toBe("pending 9")
  expect(word(editFindings(landed, report({ findings: [], broken: true })))).toBe("broken 9")
  const refused = editRefusal(deck, "stale", [])
  expect(editFindings(refused, report({ findings: [] }))).toBe(refused)
})
