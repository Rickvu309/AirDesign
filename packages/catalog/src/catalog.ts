import { elementReaders } from "./agent-element-wire.js"
import { slideReaders } from "./agent-slide-wire.js"
import * as z from "zod/v4"

import { readAgentEdit } from "./edit-wire.js"
import { readDeckQuery, readListDecks } from "./read-wire.js"
import { readRun, type WireReader } from "./wire.js"

type OpDetails = {
  readonly kind: "query" | "command" | "action" | "stream"
  readonly destructive?: true
  readonly idempotent?: true
}

export type OpRow = OpDetails &
  (
    | {
        readonly exposure: "web"
        readonly runsOn?: "server" | "device"
        readonly description?: string
      }
    | {
        readonly exposure: "agent"
        readonly runsOn: "server" | "device"
        readonly description: string
        readonly read: WireReader
      }
  )

type AgentKeys<Ops> = {
  [Op in keyof Ops]: Ops[Op] extends { readonly exposure: "agent" } ? Op : never
}[keyof Ops] &
  string

export type AgentOp = AgentKeys<typeof catalog>
export type CommandOp = {
  [Op in keyof typeof catalog]: (typeof catalog)[Op] extends { readonly kind: "command" } ? Op : never
}[keyof typeof catalog]

export type AgentTool<Op extends string = AgentOp> = {
  readonly name: string
  readonly op: Op
  readonly description: string
  readonly runsOn: "server" | "device"
  readonly readOnlyHint: boolean
  readonly destructiveHint: boolean
  readonly idempotentHint: boolean
  readonly openWorldHint: false
}

export const catalog = {
  commit_edits: { kind: "command", exposure: "web" },
  index_deck: { kind: "action", exposure: "web", runsOn: "server" },
  start_run: { kind: "command", exposure: "web" },
  stop_run: {
    idempotent: true,
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    read: readRun,
    description:
      "Call this when your turn is finished, so a person's edits stop closing elements to you and other agents can change the elements your turn holds. Takes the runId your edit answers carried.",
  },
  undo_run: { kind: "command", exposure: "web" },
  watch_deck: { kind: "stream", exposure: "web" },
  edit_deck: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    read: readAgentEdit,
    description:
      "Write values on one deck. A slide element whose node ends in .notes holds plain-text speaker notes; send its value as plain text. Read it first with airdesign_read_deck and send that revision as base and each element's version as readAt. The server names the actor. Each answer carries the runId of your turn. Call airdesign_stop_run with it when your turn is finished.",
  },
  add_slide: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    read: slideReaders.add_slide,
    description:
      "Add a slide after an existing slide, using the layout of the named slide. Read the deck first and send its revision as base. Returns the new slide id. Open the deck in AirDesign to index its layouts first.",
  },
  duplicate_slide: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    read: slideReaders.duplicate_slide,
    description:
      "Duplicate a slide after itself, including its current text and boxes. Read the deck first and send its revision as base. Returns the new slide id.",
  },
  delete_slide: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    read: slideReaders.delete_slide,
    description:
      "Delete the named slide. The last slide cannot be deleted. Read the deck first and send its revision as base.",
  },
  move_slide: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    read: slideReaders.move_slide,
    description:
      "Move the named slide after another slide, or to the beginning with after: null. Read the deck first and send its revision as base.",
  },
  set_background: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    read: slideReaders.set_background,
    description:
      "Fill the named slide's background with one solid colour, in place of the background it had. Read the deck first and send its revision as base. The person's Undo for your run gives the slide back its earlier background. Open the deck in AirDesign to index its slides first.",
  },
  add_text_box: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    read: elementReaders.add_text_box,
    description:
      "Add a text box to a slide, with a box in EMU and opening text if you send them. Without a box it goes in the largest free area of the slide. Read the deck first and send its revision as base. Returns the new element id in elements, and you can edit it next with airdesign_edit_deck. Open the deck in AirDesign to index its slides first.",
  },
  delete_element: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    read: elementReaders.delete_element,
    description:
      "Delete one element from its slide. A group, an element inside a group, and an element with an animation cannot be deleted. Read the deck first and send its revision as base. The person's Undo for your run brings the element back.",
  },
  list_decks: {
    kind: "query",
    exposure: "agent",
    runsOn: "server",
    read: readListDecks,
    description:
      "List the decks this account owns. Each row has the deck id, its name, and trash when the deck is in Trash.",
  },
  read_deck: {
    kind: "query",
    exposure: "agent",
    runsOn: "server",
    read: readDeckQuery,
    description:
      "Read one deck this account owns. Send revision as base to airdesign_edit_deck and each element's version as readAt. slides lists slide ids in position order. Indexed elements include node, slide, kind, opening or edited value and box, and version (0 before edits). closed means a person's newer edit or another run holds it. grouped elements refuse box edits. index is ready, pending, or missing; pending or missing means the owner must open the deck in AirDesign to finish indexing. Send slide or cursor to read the rest.",
  },
} as const satisfies Readonly<Record<string, OpRow>>

export function toolInputSchema(op: AgentOp): Readonly<Record<string, unknown>> {
  return z.toJSONSchema(catalog[op].read.input, { io: "input" })
}

function toolOrder(left: AgentTool<string>, right: AgentTool<string>): number {
  if (left.name < right.name) return -1
  if (left.name > right.name) return 1
  return 0
}

export function projectTools<Ops extends Readonly<Record<string, OpRow>>>(
  ops: Ops,
): readonly AgentTool<AgentKeys<Ops>>[] {
  const tools: AgentTool<AgentKeys<Ops>>[] = []
  for (const [op, row] of Object.entries(ops)) {
    if (row.exposure !== "agent") continue
    if (row.runsOn !== "server" && row.runsOn !== "device") {
      throw new Error(`agent tool ${op} must say where it runs`)
    }
    tools.push({
      name: `airdesign_${op}`,
      op: op as AgentKeys<Ops>,
      description: row.description,
      runsOn: row.runsOn,
      readOnlyHint: row.kind !== "command",
      destructiveHint: row.destructive === true,
      idempotentHint: row.kind !== "command" || row.idempotent === true,
      openWorldHint: false,
    })
  }
  tools.sort(toolOrder)
  return tools
}
