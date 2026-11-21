import { colorPattern, hexPattern } from "./agent-color.js"
import * as z from "zod/v4"

import { advertisedSchema } from "./advertised-schema.js"
import { readCreateDeck } from "./create-wire.js"
import { readAgentEdit } from "./edit-wire.js"
import { readDeckQuery, readListDecks } from "./read-wire.js"
import { sharedSchemas } from "./shared-schema.js"
import { readRun, type WireReader } from "./wire.js"

type OpDetails = {
  readonly kind: "query" | "command" | "action" | "stream"
  readonly destructive?: true
  readonly idempotent?: true
  readonly openWorld?: true
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
  readonly openWorldHint: boolean
}

export const catalog = {
  commit_edits: { kind: "command", exposure: "web" },
  create_deck: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    read: readCreateDeck,
    description:
      "Create a deck this account owns, blank or from a template. The answer has its deck id and its first airdesign_read_deck.",
  },
  index_deck: { kind: "action", exposure: "web", runsOn: "server" },
  start_run: { kind: "command", exposure: "web" },
  stop_run: {
    idempotent: true,
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    read: readRun,
    description:
      "Call when your turn is finished, with the runId from airdesign_edit_deck, so a person's changes stop closing layers to you and other agents can change the layers your turn holds.",
  },
  undo_run: { kind: "command", exposure: "web" },
  watch_deck: { kind: "stream", exposure: "web" },
  edit_deck: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    openWorld: true,
    read: readAgentEdit,
    description:
      "Edit text, boxes, design, layers or slides, all landing or none. Send airdesign_read_deck's revision as base and each layer's version as readAt (a change with op needs none). The answer's findings cover the slides it touched, as in airdesign_read_deck. Pass the returned runId to airdesign_stop_run when done.",
  },
  list_decks: {
    kind: "query",
    exposure: "agent",
    runsOn: "server",
    read: readListDecks,
    description: "List owned decks with id, name, and trash when in Trash, and the templates a deck can start from.",
  },
  read_deck: {
    kind: "query",
    exposure: "agent",
    runsOn: "server",
    read: readDeckQuery,
    description:
      "Read an owned deck. slides lists slide ids in order; groups holds each slide group's first slide id (a PowerPoint section), which added, duplicated and moved slides join. A layer's node is its id, version 0 is unchanged, role names a placeholder, design is one line of its look, and closed means a person's newer change or another run holds it. A grouped layer's box is where it sits on the slide, and its group fits its layers; frame is auto or free. findings names what is wrong on layers read, with a measure and fix, a change to send. If index or findings is pending or missing, the owner must open the deck in AirDesign; broken means the open tab cannot draw that revision. Send slide or cursor to read the rest.",
  },
} as const satisfies Readonly<Record<string, OpRow>>

const colorSchemas = {
  color: { type: "string", pattern: `^${colorPattern}$` },
  hex: { type: "string", pattern: `^${hexPattern}$` },
} as const

function sharedColors(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sharedColors)
  if (typeof schema !== "object" || schema === null) return schema
  const node = schema as Readonly<Record<string, unknown>>
  for (const [name, shared] of Object.entries(colorSchemas)) {
    if (node.type !== shared.type || node.pattern !== shared.pattern) continue
    const { type: _type, pattern: _pattern, ...rest } = node
    return { $ref: `#/$defs/${name}`, ...rest }
  }
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, sharedColors(value)]))
}

const inputSchemas = new Map<AgentOp, Readonly<Record<string, unknown>>>()

function builtInputSchema(op: AgentOp): Readonly<Record<string, unknown>> {
  const schema = advertisedSchema(z.toJSONSchema(catalog[op].read.input, { io: "input" }))
  const shared = sharedColors(schema) as Readonly<Record<string, unknown>>
  const text = JSON.stringify(shared)
  const used = Object.entries(colorSchemas).filter(([name]) => text.includes(`"#/$defs/${name}"`))
  return sharedSchemas(used.length === 0 ? shared : { ...shared, $defs: Object.fromEntries(used) })
}

export function toolInputSchema(op: AgentOp): Readonly<Record<string, unknown>> {
  const known = inputSchemas.get(op)
  if (known !== undefined) return known
  const built = builtInputSchema(op)
  inputSchemas.set(op, built)
  return built
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
      openWorldHint: row.openWorld === true,
    })
  }
  tools.sort(toolOrder)
  return tools
}
