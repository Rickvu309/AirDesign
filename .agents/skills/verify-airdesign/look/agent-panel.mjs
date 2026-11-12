import { walk } from "./walk.mjs"

export function openAgent(kit) {
  return walk("aira-panel", kit, ["agent-panel"], async () => undefined)
}
