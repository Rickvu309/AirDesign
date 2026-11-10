import type { WireEdit } from "./index.js"

// @ts-expect-error
export const personActor: WireEdit = { value: "hi", actor: "person" }

// @ts-expect-error
export const agentCommand: WireEdit = { value: "hi", command: "agent" }
