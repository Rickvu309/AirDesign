import { expect, it } from "vitest"
import type { PanelControl, PanelModel } from "./panel"
import { selectedWeight } from "./selected-weight"

const weight = {
  trait: "text",
  field: "weight",
  label: "Weight",
  value: "Regular",
  mixed: true,
  desc: { kind: "choice", options: ["Regular", "Bold"] },
  choices: [
    { value: "Regular", label: "Regular" },
    { value: "Bold", label: "Bold" },
  ],
} as unknown as PanelControl
const size = { trait: "text", field: "size", value: 3600, mixed: false } as unknown as PanelControl
const model = {
  node: "256.2",
  nodes: ["256.2"],
  kind: "text",
  sections: [{ trait: "text", label: "Text", open: true, strips: [[size], [weight]] }],
} as unknown as PanelModel

function shown(next: PanelModel) {
  return next.sections[0]?.strips.flat().find((control) => control.field === "weight")
}

it("shows the selected words' weight in the Weight field", () => {
  const next = shown(selectedWeight(model, { weight: 600, italic: false }))
  expect(next?.value).toBe("SemiBold")
  expect(next?.mixed).toBe(false)
  expect(next?.choices?.map((choice) => choice.value)).toEqual(["Regular", "SemiBold", "Bold"])
  expect(next?.desc).toEqual({ kind: "choice", options: ["Regular", "SemiBold", "Bold"] })
})

it("reads Mixed when the selected words differ", () => {
  const plain = { ...weight, mixed: false }
  const one = { ...model, sections: model.sections.map((section) => ({ ...section, strips: [[plain]] })) }
  const next = shown(selectedWeight(one, "mixed"))
  expect(next?.mixed).toBe(true)
  expect(next?.value).toBeUndefined()
})

it("leaves the panel as it is with no words selected", () => {
  expect(selectedWeight(model, null)).toBe(model)
})
