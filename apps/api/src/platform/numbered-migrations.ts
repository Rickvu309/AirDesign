import { readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import type { Migration } from "./migration.js"

export const migrationFile = /^(\d{4})-[a-z0-9-]+\.(?:js|ts)$/

const missing = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"

export function numberedMigrations(folder: URL): Migration[] {
  let names: string[]
  try {
    names = readdirSync(folder)
  } catch (error) {
    if (missing(error)) return []
    throw error
  }
  const load = createRequire(folder)
  return names
    .filter((name) => migrationFile.test(name))
    .sort()
    .map((name) => {
      const loaded = load(fileURLToPath(new URL(name, folder))) as { readonly sql?: unknown }
      if (typeof loaded.sql !== "string") throw new Error(`${name} must export its sql as a string named sql`)
      return { id: Number(migrationFile.exec(name)?.[1]), sql: loaded.sql }
    })
}
