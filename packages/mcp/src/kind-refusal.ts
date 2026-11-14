import type { WireChange } from "@airdesign/catalog"
import {
  boxOnly,
  editMissing,
  removable,
  shapeOf,
  storedValue,
  takes,
  type ElementId,
  type FieldKey,
  type Kind,
  type Missing,
  type Register,
} from "@airdesign/document"

const kindWords: Readonly<Record<Kind, string>> = {
  deck: "the deck",
  theme: "the theme",
  master: "a slide master",
  layout: "a layout",
  section: "a section",
  slide: "the slide's speaker notes",
  shape: "a shape",
  picture: "a picture",
  connector: "a line",
  group: "a group",
  table: "a table",
  row: "a table row",
  cell: "a table cell",
  chart: "a chart",
  kept: "kept exactly as the file has it: a diagram, an embedded object, or a shape with a copy for older PowerPoint",
}

const takenWords: readonly (readonly [FieldKey | "remove", string])[] = [
  ["text.value", "new text"],
  ["notes.value", "new text"],
  ["box.x", "a move"],
  ["box.w", "a resize"],
  ["remove", "a delete"],
]

const valueFields: readonly string[] = ["text.value", "notes.value", "table.value"]

function listed(words: readonly string[]): string {
  if (words.length <= 1) return words.join("")
  return `${words.slice(0, -1).join(", ")} or ${words.at(-1) ?? ""}`
}

function taken({ facts }: Missing): string {
  const all: readonly string[] = [...takes(facts), ...(removable(facts) ? ["remove"] : [])]
  const edits = takenWords.flatMap(([edit, word]) => (all.includes(edit) ? [word] : []))
  return edits.length === 0 ? "It takes no edit from an agent." : `It takes ${listed(edits)}.`
}

function what(node: ElementId, { facts }: Missing): string {
  if (facts.kind === "shape" && !facts.text) return `Element ${node} is a shape that holds no text.`
  return `Element ${node} is ${kindWords[facts.kind]}.`
}

function textNext(node: ElementId, { facts }: Missing): string {
  const beside = `put words beside it with airdesign_add_text_box on slide ${shapeOf(node).slide}`
  if (facts.kind === "group")
    return "Edit the text of the elements inside it: airdesign_read_deck lists them with grouped true."
  if (facts.kind === "chart") return `No tool edits a chart's data yet. Tell the person, or ${beside}.`
  if (facts.kind === "table") return `No agent tool edits a table's cells yet. Tell the person, or ${beside}.`
  if (facts.kind === "kept") return "Leave it, or tell the person."
  return `To put words beside it, call airdesign_add_text_box on slide ${shapeOf(node).slide}.`
}

function boxNext({ facts, box }: Missing): string {
  if (facts.kind === "table" && box !== null)
    return `A table moves but does not resize. Send its box with cx ${String(box.cx)} and cy ${String(box.cy)}.`
  if (facts.kind === "slide") return "Notes have no box. Send their text only."
  return "Leave it, or tell the person."
}

function nextStep(node: ElementId, found: Missing): string {
  if (found.missing.some((edit) => valueFields.includes(edit))) return textNext(node, found)
  if (found.missing.includes("remove")) return "Leave it, or tell the person."
  return boxNext(found)
}

export function kindSentence(node: ElementId, found: Missing): string {
  const next = nextStep(node, found)
  return `${what(node, found)} ${taken(found)} ${next}`
}

export function kindProblem(register: Register, changes: readonly WireChange[]): string | undefined {
  const lines = changes.flatMap((change, at) => {
    const found = editMissing(register, { command: "agent", node: change.node, ...storedValue(change) })
    if (found === null) return []
    if (found.facts.grouped && boxOnly(found.missing)) return []
    return [`Change ${String(at + 1)} (${change.node}): ${kindSentence(change.node, found)}`]
  })
  return lines.length === 0 ? undefined : lines.join("\n")
}
