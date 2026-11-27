import type { TreeNode } from "@airdesign/doom"

import { filesDir, fs, nodePath } from "./package-files.js"

const piecesDir = () => nodePath().join(filesDir(), "kit")
const pieceName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type Piece = {
  readonly name: string
  readonly size: { readonly w: number; readonly h: number }
  readonly tree: TreeNode
}

function sizeOf(tree: TreeNode): Piece["size"] {
  const box = (tree.props as { readonly box?: { readonly w: number; readonly h: number } } | undefined)?.box
  return { w: box?.w ?? 0, h: box?.h ?? 0 }
}

export function piece(name: string): Piece | undefined {
  if (!pieceName.test(name)) return undefined
  const { existsSync, readFileSync } = fs()
  const file = nodePath().join(piecesDir(), `${name}.json`)
  if (!existsSync(file)) return undefined
  const tree = JSON.parse(readFileSync(file, "utf8")) as TreeNode
  return { name, size: sizeOf(tree), tree }
}

export function pieces(): readonly Piece[] {
  return fs()
    .readdirSync(piecesDir())
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -5))
    .sort()
    .flatMap((name) => piece(name) ?? [])
}
