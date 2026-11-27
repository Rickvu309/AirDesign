export const fs = () => process.getBuiltinModule("node:fs")
export const nodePath = () => process.getBuiltinModule("node:path")

export function filesDir(): string {
  const { findPackageJSON } = process.getBuiltinModule("node:module")
  const manifest = findPackageJSON(import.meta.url)
  if (manifest === undefined) throw new Error("The taste package has no package.json.")
  const path = nodePath()
  return path.join(path.dirname(manifest), "files")
}
