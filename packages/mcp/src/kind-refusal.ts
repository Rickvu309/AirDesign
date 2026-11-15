import { traitWire, type AgentChange, type WireSet } from "@airdesign/catalog"
import {
  alphaKeys,
  boxOnly,
  editMissing,
  kindTraits,
  writtenField,
  namedFields,
  opacityFields,
  openingElement,
  planChange,
  registerScope,
  removable,
  shapeOf,
  storedValue,
  takes,
  type ElementId,
  type FieldKey,
  type Kind,
  type TraitName,
  type Missing,
  type Register,
} from "@airdesign/document"

const kindWords: Readonly<Record<Kind, string>> = {
  deck: "the deck",
  theme: "the theme",
  master: "a slide master",
  layout: "a layout",
  section: "a section",
  slide: "the slide itself, whose fill is its background",
  notes: "the slide's speaker notes",
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
  ["fill.value", "a fill"],
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
  if (facts.kind === "table") return `Set its cells with table's value, as airdesign_read_deck lists it, or ${beside}.`
  if (facts.kind === "kept") return "Leave it, or tell the person."
  return `To put words beside it, call airdesign_add_text_box on slide ${shapeOf(node).slide}.`
}

function boxNext({ facts, box }: Missing): string {
  if (facts.kind === "table" && box !== null)
    return `A table moves but does not resize. Send its box with cx ${String(box.cx)} and cy ${String(box.cy)}.`
  if (facts.kind === "notes") return "Notes have no box. Send their text only."
  if (facts.kind === "slide") return "Send the slide's fill only."
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

function setLines(register: Register, change: WireSet, at: number): readonly string[] {
  const scope = registerScope(register)
  const nodes = scope.expand(change.target)
  if (nodes === "indexing") return []
  return nodes.flatMap((node) => {
    const view = scope.view(node)
    if (view === undefined) return []
    const faded = change.opacity !== undefined && opacityFields(view.facts).length === 0 ? alphaKeys : []
    const missing = [...namedFields(change).filter((field) => !takes(view.facts).includes(field)), ...faded]
    if (missing.length === 0 || (view.facts.grouped && boxOnly(missing))) return []
    const found = { facts: view.facts, missing, box: openingElement(register, node)?.box ?? null }
    return [`Change ${String(at + 1)} (${node}): ${kindSentence(node, found)}`]
  })
}

export function kindProblem(register: Register, changes: readonly AgentChange[]): string | undefined {
  const lines = changes.flatMap((change, at) => {
    if ("op" in change) return change.op === "set" ? setLines(register, change, at) : []
    const found = editMissing(register, { command: "agent", node: change.node, ...storedValue(change) })
    if (found === null) return []
    if (found.facts.grouped && boxOnly(found.missing)) return []
    return [`Change ${String(at + 1)} (${change.node}): ${kindSentence(change.node, found)}`]
  })
  return lines.length === 0 ? undefined : lines.join("\n")
}

export function setProblem(
  register: Register,
  changes: readonly AgentChange[],
): { readonly code: "indexing" | "dead"; readonly detail: string } | undefined {
  for (const [at, change] of changes.entries()) {
    if (!("op" in change) || change.op !== "set" || "node" in change.target) continue
    const planned = planChange(change, registerScope(register))
    const code = planned.ok ? undefined : planned.refusals.find((refusal) => refusal.node === null)?.code
    if (!("role" in change.target)) {
      if (code !== "dead") continue
      return {
        code,
        detail: `Change ${String(at + 1)} (${change.target.slide}): the deck has no slide ${change.target.slide}. Choose a present slide from airdesign_read_deck.`,
      }
    }
    const named = `Change ${String(at + 1)} (${change.target.slide === "every" ? "*" : change.target.slide}.${change.target.role})`
    if (code === "indexing")
      return {
        code,
        detail: `${named}: this deck's index has no roles yet. The owner must open the deck in AirDesign to index it again. Until then, name each element by its id from airdesign_read_deck.`,
      }
    if (code === "dead")
      return {
        code,
        detail: `${named}: no element on ${change.target.slide === "every" ? "any slide" : `slide ${change.target.slide}`} has the role ${change.target.role}. Check the roles airdesign_read_deck lists.`,
      }
  }
  return undefined
}

const instructedKinds: readonly (readonly [Kind, string])[] = [
  ["shape", "A shape"],
  ["picture", "A picture"],
  ["connector", "A line"],
  ["group", "A group"],
  ["table", "A table"],
  ["chart", "A chart"],
  ["kept", "An element kept exactly as the file has it, such as a diagram or an embedded object,"],
  ["slide", "A slide itself, target <slide> or node <slide>.slide,"],
  ["notes", "A slide's speaker notes, node <slide>.notes,"],
]

function traitWords(kind: Kind): string | undefined {
  const taken = takes({ kind, text: true, grouped: false, animated: false })
  const traits = kindTraits[kind].flatMap((trait: TraitName) => {
    const fields = Object.keys(traitWire[trait].fields).filter((field) => taken.includes(writtenField(trait, field)))
    return fields.length === 0 ? [] : [`${trait} (${fields.join(", ")})`]
  })
  if (opacityFields({ kind, text: true, grouped: false, animated: false }).length > 0) traits.push("opacity")
  const last = traits.at(-1)
  if (last === undefined) return undefined
  return traits.length === 1 ? last : `${traits.slice(0, -1).join(", ")} and ${last}`
}

export function kindInstructions(): string {
  return [
    'airdesign_edit_deck sets fields with { "op": "set", "target": ..., "<trait>": { "<field>": value } }. The target is an element id, <slide> for the slide itself, whose fill is its background, <slide>.<role> for the element with that role on one slide, or *.<role> for it on every slide. One call lands on every element it names, or on none.',
    "What each kind of element takes:",
    ...instructedKinds.map(([kind, named]) => `${named} takes ${traitWords(kind) ?? "no field yet"}.`),
    'opacity sits beside the target, { "op": "set", "target": ..., "opacity": 60 }, in percent from 0, invisible, to 100, solid. It fades the element\'s fill, line, text and picture together.',
    'Add a Lucide icon with { "op": "add", "kind": "picture", "slide": ..., "icon": "rocket" }; an unknown name is refused with close names. Give it alt text with { "identity": { "alt": "..." } }.',
    "An element inside a group takes no box, and a shape that holds no text takes no text. Any other field cannot be set yet.",
  ].join("\n")
}
