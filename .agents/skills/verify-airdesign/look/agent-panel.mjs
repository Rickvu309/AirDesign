import { walk } from "./walk.mjs"

export function openAgent(kit) {
  return walk("aira-panel", kit, ["doom-agent-panel"], async () => undefined)
}
