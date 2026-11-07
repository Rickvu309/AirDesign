import { spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const declarations = spawnSync("npx", ["tsc", "-p", "packages/ui/tsconfig.declarations.json"], { stdio: "inherit" })
if (declarations.status !== 0) process.exit(declarations.status ?? 1)

const css = readFileSync("packages/ui/src/tokens/tokens.css", "utf8").replaceAll("../../fonts/", "../fonts/")
const copyKit = JSON.parse(readFileSync("packages/ui/src/copy/copy-kit.json", "utf8"))
mkdirSync("packages/ui/dist/copy", { recursive: true })
writeFileSync("packages/ui/dist/tokens.css", css)
writeFileSync("packages/ui/dist/copy/copy-kit.json", `${JSON.stringify(copyKit, null, 2)}\n`)
