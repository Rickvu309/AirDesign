import { paintKind } from "@airdesign/pptx"
import { expect, it } from "vitest"

it("names each kind the way the record does", () => {
  expect(["p:sp", "p:pic", "p:cxnSp", "p:grpSp", "p:graphicFrame"].map((kind) => paintKind(kind as never))).toEqual([
    "shape",
    "shape",
    "connector",
    "group",
    "kept",
  ])
})
