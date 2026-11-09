import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = import.meta.dirname

const testsIn = (directory) =>
  fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".test.js"))
    .sort()
    .map((name) => path.join(directory, name))

const rulesDirectory = path.join(root, "rules")
const files = [...testsIn(root), ...(fs.existsSync(rulesDirectory) ? testsIn(rulesDirectory) : [])]

for (const file of files) {
  await import(pathToFileURL(file).href)
}
