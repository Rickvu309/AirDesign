import { provisionDatabase } from "./provision.js"

const names = ["ADMIN_DATABASE_URL", "SESSION_DATABASE_URL", "DECK_DATABASE_URL", "LISTEN_DATABASE_URL"] as const

const values = names.map((name) => process.env[name])
const missing = names.filter((_, index) => (values[index] ?? "").length === 0)

if (missing.length > 0) {
  process.stderr.write(`${missing.join(" ")}\n`)
  process.exit(1)
}

const [admin = "", session = "", deck = "", listen = ""] = values

try {
  const result = await provisionDatabase({ admin, session, deck, listen })
  process.stdout.write(`setup: roles 3, schema ${result}\n`)
} catch (error) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "error"
  process.stderr.write(`setup: failed ${code}\n`)
  process.exitCode = 1
}
