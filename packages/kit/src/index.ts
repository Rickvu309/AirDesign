import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NodeId, TreeNode } from "@airdesign/doom"

const piecesDir = fileURLToPath(new URL("../pieces", import.meta.url))
const pieceName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type KitPiece = {
  readonly name: string
  readonly size: { readonly w: number; readonly h: number }
  readonly tree: TreeNode
}

type Fields = Readonly<Record<string, unknown>>
type NamedEnd = { readonly layer: string } & Fields

function sizeOf(tree: TreeNode): KitPiece["size"] {
  const box = (tree.props as { readonly box?: { readonly w: number; readonly h: number } } | undefined)?.box
  return { w: box?.w ?? 0, h: box?.h ?? 0 }
}

const named = (end: unknown): end is NamedEnd =>
  typeof end === "object" && end !== null && typeof (end as Fields).layer === "string"

function attached(node: TreeNode): TreeNode {
  const children = node.children?.map(attached)
  const props = node.props as Fields | undefined
  const geometry = props?.geometry as Fields | undefined
  if (props === undefined || geometry?.kind !== "line" || !(named(geometry.start) || named(geometry.end)))
    return children === undefined ? node : { ...node, children }
  const end = (at: unknown, ids: Readonly<Record<string, NodeId>>) => {
    if (!named(at)) return at
    const { layer, ...site } = at
    return { node: ids[layer], ...site }
  }
  return {
    ...node,
    ...(children === undefined ? {} : { children }),
    props: ((ids: Readonly<Record<string, NodeId>>) => ({
      ...props,
      geometry: { ...geometry, start: end(geometry.start, ids), end: end(geometry.end, ids) },
    })) as NonNullable<TreeNode["props"]>,
  }
}

export function readKitPiece(name: string): KitPiece | undefined {
  if (!pieceName.test(name)) return undefined
  const file = path.join(piecesDir, `${name}.json`)
  if (!existsSync(file)) return undefined
  const tree = JSON.parse(readFileSync(file, "utf8")) as TreeNode
  return { name, size: sizeOf(tree), tree: attached(tree) }
}

export function kitPieces(): readonly KitPiece[] {
  return readdirSync(piecesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -5))
    .sort()
    .flatMap((name) => readKitPiece(name) ?? [])
}
