import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const finished = fs.readFileSync(0, "utf8").trim()
await import(pathToFileURL(path.resolve(process.argv[2])).href)
process.once("beforeExit", () => console.log(finished))
