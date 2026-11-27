import { catalog, projectTools, type AgentOp } from "@airdesign/catalog"

import { type Answer, refused, unadmitted } from "./answer.js"
import { appStateTool } from "./app-state-tool.js"
import type { DeckHost } from "./deck-host.js"
import { executeTool } from "./execute-tool.js"
import { getStyleTool, readSkillTool } from "./skill-tools.js"
import { stopRunTool } from "./stop-tool.js"
import { undoRunTool } from "./undo-tool.js"

export type Session = {
  readonly agent: string
  readonly name?: string
  readonly mint: () => string
  once?: string | undefined
}

const tools = projectTools(catalog)

const opOf = (name: string): AgentOp | undefined => tools.find((tool) => tool.name === name)?.op

export async function callTool(
  name: string,
  raw: unknown,
  session: Session,
  host: DeckHost,
  pendingFonts: ReadonlySet<string> = new Set(),
): Promise<Answer> {
  const op = opOf(name)
  if (op === undefined) return refused("field")
  const refusal = await unadmitted(host, "tool")
  if (refusal !== undefined) return refusal
  const once = session.once ?? session.mint()
  switch (op) {
    case "get_app_state":
      return appStateTool(raw, host)
    case "read_skill":
      return readSkillTool(raw)
    case "get_style":
      return getStyleTool(raw)
    case "execute":
      return executeTool(raw, { id: session.agent, name: session.name }, once, host, pendingFonts)
    case "stop_run":
      return stopRunTool(raw, session.agent, once, host)
    case "undo_run":
      return undoRunTool(raw, session.agent, once, host)
  }
}
