import { expect, it } from "vitest"
import { planChange, registerScope } from "./change.js"
import { openRegister } from "./decide.js"
import { elementId, slideId } from "./element-id.js"

it("writes a whole-element destination through the shared set path and refuses a missing slide", () => {
  const node = elementId("258.2")
  const picture = elementId("258.4")
  const scope = registerScope({
    ...openRegister("", "clean"),
    index: {
      total: 2,
      pages: [],
      slides: [
        { id: "258", position: 0 },
        { id: "259", position: 1 },
      ],
      elements: [
        { node, kind: "shape", value: "Hello", box: null, grouped: false },
        { node: picture, kind: "shape", value: null, box: null, grouped: false },
      ],
    },
  })
  const target = { node }
  const link = { target: { kind: "slide", slide: slideId("259") } } as const
  expect(planChange({ target, link }, scope)).toMatchObject({
    ok: true,
    rows: [{ node, row: { patch: { link: { target: { set: link.target } } } } }],
  })
  expect(planChange({ target, link: { target: { kind: "slide", slide: slideId("999") } } }, scope)).toMatchObject({
    ok: false,
    refusals: [{ trait: "link", code: "dead" }],
  })
  expect(planChange({ target: { node: picture }, link }, scope)).toMatchObject({ ok: false })
})

it("refuses a new phrase link to a slide outside the deck", () => {
  const node = elementId("258.2")
  const scope = registerScope({
    ...openRegister("", "clean"),
    index: {
      total: 1,
      pages: [],
      slides: [{ id: "258", position: 0 }],
      elements: [{ node, kind: "shape", value: "Hello", box: null, grouped: false }],
    },
  })
  expect(
    planChange(
      {
        target: { node },
        text: {
          value: JSON.stringify([
            { from: 0, runs: [{ from: 0, text: "Hello", link: { kind: "slide", slide: "999" } }] },
          ]),
        },
      },
      scope,
    ),
  ).toMatchObject({ ok: false, refusals: [{ trait: "text", code: "dead" }] })
})

it("lets text change while its original slide destination is inactive", () => {
  const node = elementId("258.2")
  const value = (text: string) =>
    JSON.stringify([{ from: 0, runs: [{ from: 0, text, link: { kind: "slide", slide: "259" } }] }])
  const scope = registerScope({
    ...openRegister("", "clean"),
    index: {
      total: 1,
      pages: [],
      slides: [{ id: "258", position: 0 }],
      elements: [{ node, kind: "shape", value: value("Before"), box: null, grouped: false }],
    },
  })
  expect(planChange({ target: { node }, text: { value: value("After") } }, scope)).toMatchObject({ ok: true })
})
