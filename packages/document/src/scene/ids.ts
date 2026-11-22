declare const nodeIdBrand: unique symbol
declare const revBrand: unique symbol

export type NodeId = string & { readonly [nodeIdBrand]: true }
export type Rev = number & { readonly [revBrand]: true }

const nodeIdPattern = /^[a-z0-9]{1,16}:[0-9]{1,12}$/

export function readNodeId(raw: unknown): NodeId | undefined {
  return typeof raw === "string" && nodeIdPattern.test(raw) ? (raw as NodeId) : undefined
}

export function nodeId(value: string): NodeId {
  const read = readNodeId(value)
  if (read === undefined) throw new Error("node id")
  return read
}

export function readRev(raw: unknown): Rev | undefined {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? (raw as Rev) : undefined
}

export function rev(value: number): Rev {
  const read = readRev(value)
  if (read === undefined) throw new Error("rev")
  return read
}
