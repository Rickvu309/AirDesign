import { elementId } from "@airdesign/document"
import { fixture } from "./fixture.js"
import type { SuiteRow } from "./suite.js"

const size = { width: 12_192_000, height: 6_858_000 }
const box = { x: 100, y: 200, cx: 3_000_000, cy: 600_000 }

function deck() {
  return fixture("elements", [], (register) => ({
    ...register,
    index: {
      total: 2,
      slides: [
        { id: "258", position: 0, size, free: 9, animated: ["8"], layout: [] },
        { id: "259", position: 1, size, free: 3, animated: [] },
      ],
      elements: [
        { node: elementId("258.7"), kind: "shape", value: "Title", box, grouped: false },
        { node: elementId("258.8"), kind: "shape", value: "Body", box, grouped: false },
      ],
      pages: [{ once: "elements", offset: 0, count: 2 }],
    },
  }))
}

export const elementSuite: readonly SuiteRow[] = [
  {
    task: {
      id: "add_text_box",
      prompt: "Use airdesign_edit_deck with op add and kind shape to add an empty text box to slide 258.",
      deck,
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: {}, added: ["258.9"] },
    },
    reference: [
      {
        name: "airdesign_edit_deck",
        raw: { deck: "elements", base: 0, changes: [{ op: "add", kind: "shape", slide: "258" }] },
      },
    ],
    wrong: {
      attempt: [
        {
          name: "airdesign_edit_deck",
          raw: { deck: "elements", base: 9, changes: [{ op: "add", kind: "shape", slide: "258" }] },
        },
      ],
      reason: "tool",
    },
  },
  {
    task: {
      id: "delete_element",
      prompt: "Use airdesign_edit_deck with op delete to delete the body of slide 258.",
      deck,
      want: { calls: 1, steps: [{ name: "edit_deck", outcome: "ok" }], elements: {}, removed: ["258.7"] },
    },
    reference: [
      {
        name: "airdesign_edit_deck",
        raw: { deck: "elements", base: 0, changes: [{ op: "delete", node: elementId("258.7") }] },
      },
    ],
    wrong: {
      attempt: [
        {
          name: "airdesign_edit_deck",
          raw: { deck: "elements", base: 0, changes: [{ op: "delete", node: elementId("258.8") }] },
        },
      ],
      reason: "tool",
    },
  },
]
