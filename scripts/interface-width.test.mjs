import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { unusedExports } from "./interface-width.mjs"

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-interface-width-"))
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }))

const write = (relative, source) => {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, source)
}

write(
  "packages/deck/src/index.ts",
  [
    'export { openDeck, closeDeck, type Deck, type Hidden } from "./deck.js"',
    'export type { Slide } from "./slide.js"',
    "export const limit = 3",
    "export function spare() {}",
    "export {",
    "  moved,",
    "  type Moved,",
    '} from "./move.js"',
    "",
  ].join("\n"),
)
write("packages/deck/src/deck.ts", "export const openDeck = () => closeDeck\nexport const closeDeck = () => spare\n")
write("packages/deck/src/deck.test.ts", "closeDeck()\n")
write("packages/deck/src/slide.test.ts", 'import { limit, type Hidden } from "./index.js"\n')
write("apps/web/src/page.tsx", 'import { openDeck, type Deck, type Slide } from "@airdesign/deck"\nopenDeck as Deck\n')
write("scripts/run.mjs", 'import { limit } from "@airdesign/deck"\n')
write("tests/move.test.ts", "moved()\nlet m: Moved\n")
write("packages/empty/src/index.ts", "")
execFileSync("git", ["init", "-q"], { cwd: root })
execFileSync("git", ["add", "-A"], { cwd: root })

const unused = unusedExports(root)
const expected = ["packages/deck: closeDeck", "packages/deck: spare"]
if (JSON.stringify(unused) !== JSON.stringify(expected))
  throw new Error(`names only the package uses were not listed: ${JSON.stringify(unused)}`)

write("apps/web/src/close.tsx", "closeDeck()\nspare()\n")
if (unusedExports(root).length !== 0) throw new Error("an untracked caller was not seen")
