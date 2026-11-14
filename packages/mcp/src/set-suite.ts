import { elementId, writeTextValue, type IndexElement } from "@airdesign/document"
import { fixture } from "./fixture.js"
import { edit } from "./score.js"
import type { SuiteRow } from "./suite.js"

const box = { x: 100, y: 200, cx: 3_000_000, cy: 600_000 }

function titled(text: string, color?: "accent1") {
  return writeTextValue([
    { from: 0, runs: [{ from: 0, text, ...(color === undefined ? {} : { color: { scheme: color } }) }] },
  ])
}

const elements: readonly IndexElement[] = [
  { node: elementId("258.7"), kind: "shape", value: titled("Quarterly"), box, grouped: false, role: "title" },
  { node: elementId("258.8"), kind: "shape", value: titled("Body"), box, grouped: false, role: "body" },
  { node: elementId("259.2"), kind: "shape", value: titled("Agenda"), box, grouped: false, role: "title" },
]

function deck() {
  return fixture("titles", [], (register) => ({
    ...register,
    index: {
      format: 2,
      total: elements.length,
      slides: [
        { id: "258", position: 0 },
        { id: "259", position: 1 },
      ],
      elements,
      pages: [{ once: "titles", offset: 0, count: elements.length }],
    },
  }))
}

function set(target: string) {
  const call = edit("titles", [])
  return [
    { name: call.name, raw: { deck: "titles", base: 0, changes: [{ op: "set", target, text: { color: "accent1" } }] } },
  ]
}

export const setSuite: readonly SuiteRow[] = [
  {
    task: {
      id: "set-every-title",
      prompt: "Make every title in deck titles Accent 1 with one airdesign_edit_deck call.",
      deck,
      want: {
        calls: 1,
        steps: [{ name: "edit_deck", outcome: "ok" }],
        elements: { title: [titled("Quarterly", "accent1")], footer: [titled("Agenda", "accent1")] },
      },
    },
    reference: set("*.title"),
    wrong: { attempt: set("258.title"), reason: "landed" },
  },
]
