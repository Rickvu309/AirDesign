import { catalog, projectTools, type AgentOp } from "@airdesign/catalog"

import { type CallerLog } from "./admit.js"
import { type ToolResult, refused } from "./answer.js"
import { createDeckTool } from "./create-tool.js"
import type { DeckHost } from "./deck-host.js"
import { editDeckTool } from "./edit-tool.js"
import { listDecksTool } from "./list-tool.js"
import { readDeckTool } from "./read-tool.js"
import { stopRunTool } from "./stop-tool.js"
import { undoRunTool } from "./undo-tool.js"

export type Session = {
  readonly agent: string
  readonly name?: string
  readonly mint: () => string
  log: CallerLog
  now: number
  once?: string | undefined
}

const tools = projectTools(catalog)

export const opOf = (name: string): AgentOp | undefined => tools.find((tool) => tool.name === name)?.op

export async function callTool(name: string, raw: unknown, session: Session, host: DeckHost): Promise<ToolResult> {
  const op = opOf(name)
  if (op === undefined) return refused("field")
  const once = session.once ?? session.mint()
  switch (op) {
    case "list_decks":
      return listDecksTool(raw, host)
    case "create_deck":
      return createDeckTool(raw, once, host)
    case "read_deck":
      return readDeckTool(raw, session.agent, host)
    case "edit_deck":
      return editDeckTool(raw, { id: session.agent, name: session.name }, once, host)
    case "stop_run":
      return stopRunTool(raw, session.agent, once, host)
    case "undo_run":
      return undoRunTool(raw, session.agent, once, host)
  }
}
