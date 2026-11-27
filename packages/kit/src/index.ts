import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { TreeNode } from "@airdesign/doom"

const piecesDir = fileURLToPath(new URL("../pieces", import.meta.url))
const pieceName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type KitPiece = {
  readonly name: string
  readonly size: { readonly w: number; readonly h: number }
  readonly tree: TreeNode
}

function sizeOf(tree: TreeNode): KitPiece["size"] {
  const box = (tree.props as { readonly box?: { readonly w: number; readonly h: number } } | undefined)?.box
  return { w: box?.w ?? 0, h: box?.h ?? 0 }
}

export function readKitPiece(name: string): KitPiece | undefined {
  if (!pieceName.test(name)) return undefined
  const file = path.join(piecesDir, `${name}.json`)
  if (!existsSync(file)) return undefined
  const tree = JSON.parse(readFileSync(file, "utf8")) as TreeNode
  return { name, size: sizeOf(tree), tree }
}

export function kitPieces(): readonly KitPiece[] {
  return readdirSync(piecesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -5))
    .sort()
    .flatMap((name) => readKitPiece(name) ?? [])
}
