import { nodeId, type NodeId } from "../ids.js"
import { keyString, type PartKey } from "./instance.js"

export const reservedPartId = (node: NodeId): boolean => /^p[a-z0-9]{15}:/.test(node)

export function partId(frame: NodeId, key: PartKey): NodeId {
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const char of `${frame}/${keyString(key)}`)
    hash = BigInt.asUintN(128, (hash ^ BigInt(char.charCodeAt(0))) * 0x1000000000000000000013bn)
  const decimal = 10n ** 12n
  const prefix = ((hash / decimal) % 36n ** 15n).toString(36).padStart(15, "0")
  return nodeId(`p${prefix}:${hash % decimal}`)
}
