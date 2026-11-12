import path from "node:path"
import { fileURLToPath } from "node:url"
import { recordFrozenMigrations } from "../apps/api/src/frozen-migrations.ts"
import { migrations } from "../apps/api/src/migrations.ts"

export const runFrozenMigrations = (argv, current = migrations, file = undefined) => {
  if (argv.length > 0) {
    throw new Error(
      "usage: node scripts/frozen-migrations.mjs (appends unrecorded migrations only and never rewrites existing hashes)",
    )
  }
  const { appended, total } = recordFrozenMigrations(current, file)
  return `frozen-migrations: ${appended} appended, ${total} recorded`
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  try {
    console.log(runFrozenMigrations(process.argv.slice(2)))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
