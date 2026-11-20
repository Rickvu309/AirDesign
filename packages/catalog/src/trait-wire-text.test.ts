import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { readSetChange } from "./index.js"

it("lets an agent justify a layer's paragraphs and refuses distributed", () => {
  expect(readSetChange({ op: "set", target: "258.2", text: { align: "justify" } })).toEqual({
    ok: true,
    change: { op: "set", target: { node: elementId("258.2") }, text: { align: "justify" } },
  })
  expect(readSetChange({ op: "set", target: "258.2", text: { align: "distributed" } })).toMatchObject({ ok: false })
})
