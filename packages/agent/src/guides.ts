import { type Guide, guides as tasteGuides } from "@airdesign/taste"

function packageSource(): string {
  const { findPackageJSON } = process.getBuiltinModule("node:module")
  const path = process.getBuiltinModule("node:path")
  const manifest = findPackageJSON(import.meta.url)
  if (manifest === undefined) throw new Error("The agent package has no package.json.")
  return path.join(path.dirname(manifest), "src")
}

export function guides(): readonly Guide[] {
  return [...tasteGuides(), ...tasteGuides(packageSource())].sort((a, b) => (a.name < b.name ? -1 : 1))
}

export function guide(name: string): Guide | undefined {
  return guides().find((candidate) => candidate.name === name)
}
