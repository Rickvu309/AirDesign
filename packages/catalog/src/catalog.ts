import * as z from "zod/v4"

import { advertisedSchema } from "./advertised-schema.js"
import { readCreateDeck } from "./create-wire.js"
import { readDeckEdit } from "./deck-edit-wire.js"
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
    description: "Create a deck this account owns. The answer has its deck id and its first airdesign_read_deck.",
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
      "Call when your turn is finished, with the runId from airdesign_edit_deck, so a person's changes stop closing layers to you.",
  },
  undo_run: { kind: "command", exposure: "web" },
  watch_deck: { kind: "stream", exposure: "web" },
  edit_deck: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    openWorld: true,
    read: readDeckEdit,
    description:
      "Change the deck, all of it landing or none. Send airdesign_read_deck's rev as base. The answer has the new rev, the ids of the layers and slides you added, and a runId: send it with your next edits and to airdesign_stop_run when done.",
  },
  list_decks: {
    kind: "query",
    exposure: "agent",
    runsOn: "server",
    read: readListDecks,
    description: "List owned decks with id, name and rev.",
  },
  read_deck: {
    kind: "query",
    exposure: "agent",
    runsOn: "server",
    read: readDeckQuery,
    description:
      "Read an owned deck, one line for each layer: its id, what it is, @x,y and size, then its look. rev is the base to send to airdesign_edit_deck. Send slide or cursor to read the rest.",
  },
} as const satisfies Readonly<Record<string, OpRow>>

const inputSchemas = new Map<AgentOp, Readonly<Record<string, unknown>>>()

function builtInputSchema(op: AgentOp): Readonly<Record<string, unknown>> {
  return sharedSchemas(advertisedSchema(z.toJSONSchema(catalog[op].read.input, { io: "input" })))
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
