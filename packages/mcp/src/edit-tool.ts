import {
  closeIcons,
  readAddChange,
  readAgentEdit,
  readDiagramChange,
  groupOps,
  readGroupChange,
  readSetChange,
  readSlideChange,
  readDeleteChange,
  slideOps,
  type AgentChange,
  type WireChange,
} from "@airdesign/catalog"
import { registerScope, type ElementId, type Register, slideBirths } from "@airdesign/document"
import { call } from "@airdesign/engine"
import type { Session, ToolResult } from "./call-tool.js"
import { editLanded, editRefusal, namedNodes } from "./edit-answer.js"
import { kindProblem, setProblem } from "./kind-refusal.js"
import {
  agentCaller,
  elementFloors,
  joinRun,
  nodeChanges,
  openRun,
  runElements,
  setNodes,
  stopForNewTurn,
} from "./run.js"
import { changeDetail } from "./change-detail.js"
import { imageLookup, imageProblem } from "./named-image.js"
import { styleProblem } from "./style-problem.js"
import { formProblem } from "./text-form.js"
import { textProblem } from "./text-from.js"
import { heldRun, holders } from "./turn.js"

function startedTurn(raw: unknown, session: Session) {
  const { deck } = session
  const held = heldRun(session)
  if (held !== undefined) return joinRun(deck.register, raw, held.runId, holders(session))
  return openRun(deck.register, raw, () => session.caller.runId, holders(session))
}

function addTurn(session: Session, base: number) {
  const before = session.deck
  const held = heldRun(session)
  const stopped =
    held === undefined && base === before.revision
      ? stopForNewTurn(before, holders(session))
      : ({ ok: true, deck: before } as const)
  if (!stopped.ok) return stopped
  return {
    ok: true,
    register: stopped.deck.register,
    caller: agentCaller(held?.runId ?? session.caller.runId),
  } as const
}

type IconNamed = {
  readonly icon?: unknown
  readonly image?: { readonly source?: unknown }
  readonly fills?: { readonly source?: unknown; readonly paint?: { readonly image?: unknown } }
}

function iconName(field: string, named: IconNamed): unknown {
  if (field === "icon") return named.icon
  if (field === "fills.source") return named.fills?.source ?? named.image?.source
  return field === "fills.paint" ? named.fills?.paint?.image : undefined
}

function iconHint(field: string, change: unknown): string {
  const name = iconName(field, change as IconNamed)
  if (typeof name !== "string") return ""
  const close = closeIcons(name)
  const quoted = JSON.stringify(name)
  if (close.length === 0) return ` No Lucide icon is named ${quoted}, and none is close; try a plainer word.`
  return ` No Lucide icon is named ${quoted}. Close names: ${close.join(", ")}.`
}

function fieldDetail(raw: unknown): string | undefined {
  const changes = typeof raw === "object" && raw !== null ? (raw as { readonly changes?: unknown }).changes : undefined
  if (!Array.isArray(changes)) return undefined
  for (const [at, change] of changes.entries()) {
    const op = typeof change === "object" && change !== null ? (change as { readonly op?: unknown }).op : undefined
    const read =
      op === "set"
        ? readSetChange(change)
        : op === "add"
          ? readAddChange(change)
          : groupOps.some((each) => each === op)
            ? readGroupChange(change)
            : op === "diagram"
              ? readDiagramChange(change)
              : op === "delete"
                ? readDeleteChange(change)
                : slideOps.some((each) => each === op)
                  ? readSlideChange(change)
                  : undefined
    if (read !== undefined && !read.ok) {
      const detail = "detail" in read && read.detail !== undefined ? ` ${read.detail}` : ""
      return `Change ${String(at + 1)}: ${read.field} is missing or has the wrong form.${detail}${iconHint(read.field, change)}`
    }
  }
  return undefined
}

function setTexts(register: Register, changes: readonly AgentChange[]): readonly WireChange[] {
  const scope = registerScope(register)
  return changes.flatMap((change) => {
    const value = "op" in change && change.op === "set" ? change.text?.value : undefined
    const nodes = value === undefined || !("op" in change) || change.op !== "set" ? [] : scope.expand(change.target)
    return value === undefined || nodes === "indexing" ? [] : nodes.map((node) => ({ node, value, readAt: 0 }))
  })
}

function addedNodes(before: Register, after: Register): readonly ElementId[] {
  return after.order
    .slice(before.order.length)
    .flatMap((command) =>
      command.slide === "element-add" || command.slide === "element-clone" || command.slide === "element-group"
        ? [command.element.node]
        : [],
    )
}

function groupDetail(changes: readonly AgentChange[], refusal: string): string | undefined {
  if (refusal !== "kind" || !changes.some((change) => "elements" in change)) return undefined
  return "Only shapes, images, lines, charts and groups that are not placeholders can be grouped or framed, only a group can be ungrouped, only a group or frame can be joined, a frame joins only a group that keeps the slide's scale and turn, and a chart, a group holding one or a layer inside a frame cannot be duplicated."
}

export function editDeck(raw: unknown, session: Session): ToolResult {
  const before = session.deck
  const parsed = readAgentEdit(raw)
  if (!parsed.ok)
    return editRefusal(before, parsed.refusal, [], parsed.refusal === "field" ? fieldDetail(raw) : undefined)
  if (parsed.deck !== before.id) return editRefusal(before, "deck", [])
  const named = nodeChanges(parsed.changes)
  const nodes = namedNodes(named, setNodes(before.register, parsed.changes))
  const unfit = kindProblem(before.register, parsed.changes)
  if (unfit !== undefined) return editRefusal(before, "kind", nodes, unfit)
  const unset = setProblem(before.register, parsed.changes)
  if (unset !== undefined) return editRefusal(before, unset.code, nodes, unset.detail)
  const checked = [...named, ...setTexts(before.register, parsed.changes)]
  const floors = elementFloors(before.register, checked)
  if (!floors.ok) return editRefusal(before, floors.refusal, nodes)
  const problem =
    formProblem(before.register, parsed.changes) ??
    textProblem(floors.floors, checked) ??
    styleProblem(before.register, parsed.changes)
  if (problem !== undefined) return editRefusal(before, problem.code, nodes, problem.detail)
  const unfetched = imageProblem(parsed.changes, session.images)
  if (unfetched !== undefined) return editRefusal(before, "image", nodes, unfetched)
  const holds = runElements(before.register, parsed.changes).length > 0
  const opened = holds ? startedTurn(raw, session) : addTurn(session, parsed.base)
  if (!opened.ok) return editRefusal(before, opened.refusal, nodes)
  const deck = { id: before.id, revision: before.revision, register: opened.register }
  const result = call("edit_deck", deck, opened.caller, raw, imageLookup(session.images))
  if (!result.ok)
    return {
      ...editRefusal(
        deck,
        result.refusal,
        nodes,
        groupDetail(parsed.changes, result.refusal) ?? changeDetail(before, parsed.changes, result.refusal),
      ),
      deck: before,
    }
  const slides = result.deck.register.order
    .slice(deck.register.order.length)
    .flatMap(slideBirths)
    .map((birth) => birth.id)
  return editLanded(
    result.deck,
    [...nodes, ...addedNodes(deck.register, result.deck.register)],
    opened.caller.runId,
    slides,
  )
}
