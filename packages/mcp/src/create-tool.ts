import { readCreateDeck } from "@airdesign/catalog"

import { hostRefused, refused, type ToolResult } from "./answer.js"
import type { DeckHost } from "./deck-host.js"
import { readAnswer } from "./deck-read.js"

export async function createDeckTool(raw: unknown, once: string, host: DeckHost): Promise<ToolResult> {
  const parsed = readCreateDeck(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  const made = await host.create(parsed.name, once)
  if (!made.ok) return hostRefused(made)
  return readAnswer(made, {})
}
