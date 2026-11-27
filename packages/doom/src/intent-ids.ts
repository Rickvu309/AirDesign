import { type NodeId, readNodeId } from "./ids.js"
import { accepting, formed, literal, union } from "./read-kit.js"

export const idSchema = { $ref: "#/$defs/id" }
export const readId = formed(readNodeId, { code: "node-id" })
export const readAfter = accepting({ code: "node-id-or-null" }, (raw) => (raw === null ? null : readId(raw)))
export const readGroup = union<NodeId | "new">({ code: "slide-group-or-new" }, [readId, literal(["new"])])
