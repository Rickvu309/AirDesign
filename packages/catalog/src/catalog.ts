export type OpRow = {
  readonly kind: "query" | "command" | "action" | "stream"
  readonly exposure: "web" | "agent"
  readonly runsOn?: "server" | "device"
  readonly description?: string
  readonly destructive?: true
}

export type AgentTool = {
  readonly name: string
  readonly op: string
  readonly description: string
  readonly runsOn: "server" | "device"
  readonly readOnlyHint: boolean
  readonly destructiveHint: boolean
  readonly idempotentHint: true
  readonly openWorldHint: false
}

export const catalog = {
  commit_edits: { kind: "command", exposure: "web" },
  watch_deck: { kind: "stream", exposure: "web" },
  edit_deck: {
    kind: "command",
    exposure: "agent",
    runsOn: "server",
    destructive: true,
    description: "Write values on one deck. The server names the actor.",
  },
  capture_slide: {
    kind: "action",
    exposure: "agent",
    runsOn: "device",
    description: "Render one slide in the person's open tab.",
  },
} as const satisfies Readonly<Record<string, OpRow>>

function toolOrder(left: AgentTool, right: AgentTool): number {
  if (left.name < right.name) return -1
  if (left.name > right.name) return 1
  return 0
}

export function projectTools(ops: Readonly<Record<string, OpRow>>): readonly AgentTool[] {
  const tools: AgentTool[] = []
  for (const [op, row] of Object.entries(ops)) {
    if (row.exposure !== "agent") continue
    if (row.runsOn !== "server" && row.runsOn !== "device") {
      throw new Error(`agent tool ${op} must say where it runs`)
    }
    tools.push({
      name: `airdesign_${op}`,
      op,
      description: row.description ?? "",
      runsOn: row.runsOn,
      readOnlyHint: row.kind !== "command",
      destructiveHint: row.destructive === true,
      idempotentHint: true,
      openWorldHint: false,
    })
  }
  tools.sort(toolOrder)
  return tools
}
