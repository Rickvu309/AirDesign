import { colorPattern } from "./agent-color.js"
import { elementReaders } from "./agent-element-wire.js"
import { slideReaders } from "./agent-slide-wire.js"
import * as z from "zod/v4"

import { readAgentEdit } from "./edit-wire.js"
import { readDeckQuery, readListDecks } from "./read-wire.js"
import { sharedSchemas } from "./shared-schema.js"
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
      "Write values on one deck. A slide element whose node ends in .notes holds plain-text speaker notes; send its value as plain text. Read it first with airdesign_read_deck and send that revision as base and each element's version as readAt. A change with op set sets fields on one element, on the element with a role on one slide, or on it on every slide, and needs no readAt. A change with op add adds a text box. The server names the actor. Each answer carries the runId of your turn. Call airdesign_stop_run with it when your turn is finished.",
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
      "Read one deck this account owns. Send revision as base to airdesign_edit_deck and each element's version as readAt. slides lists slide ids in position order. Indexed elements include node, slide, kind, opening or edited value and box, and version (0 before edits). role names a placeholder: title, subtitle, body, date, footer, number, picture, chart, table or object. design is one line of the element's look as it opened, field by field, each followed by (layout), (master) or (style) when that part shows it rather than the element itself; once a change lands on an element, its text fields follow its first run as it is now. Colors name a theme slot or hex; palettes give each slot's hex, and a slide uses palette 0 unless it names another. closed means a person's newer edit or another run holds it. grouped elements refuse box edits. index is ready, pending, or missing; pending or missing means the owner must open the deck in AirDesign to finish indexing. Send slide or cursor to read the rest.",
  },
} as const satisfies Readonly<Record<string, OpRow>>

const colorRef = "#/$defs/color"
const colorSchema = { type: "string", pattern: `^${colorPattern}$` } as const

function sharedColors(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sharedColors)
  if (typeof schema !== "object" || schema === null) return schema
  const node = schema as Readonly<Record<string, unknown>>
  if (node.type === colorSchema.type && node.pattern === colorSchema.pattern) {
    const { type: _type, pattern: _pattern, ...rest } = node
    return { $ref: colorRef, ...rest }
  }
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, sharedColors(value)]))
}

export function toolInputSchema(op: AgentOp): Readonly<Record<string, unknown>> {
  const schema = z.toJSONSchema(catalog[op].read.input, { io: "input" })
  const shared = sharedColors(schema) as Readonly<Record<string, unknown>>
  const colored = JSON.stringify(shared).includes(colorRef) ? { ...shared, $defs: { color: colorSchema } } : shared
  return sharedSchemas(colored)
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
