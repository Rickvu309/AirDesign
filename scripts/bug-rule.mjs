import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const extensions = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".css",
  ".astro",
  ".vue",
  ".svelte",
])
const skipDirectories = new Set(["node_modules", "dist", "fixtures", "boundary-fixtures"])

export const sourceLines = (root, relative) => {
  const directory = path.join(root, relative)
  if (!fs.existsSync(directory)) return 0
  let lines = 0
  const walk = (current) => {
    for (const name of fs.readdirSync(current)) {
      if (skipDirectories.has(name)) continue
      const file = path.join(current, name)
      const info = fs.statSync(file)
      if (info.isDirectory()) {
        walk(file)
        continue
      }
      if (!info.isFile() || name.includes(".test.") || !extensions.has(path.extname(name))) continue
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        if (line.trim() !== "") lines += 1
      }
    }
  }
  walk(directory)
  return lines
}

export const budget = (root) => {
  const product = sourceLines(root, "apps") + sourceLines(root, "packages")
  const processLines = sourceLines(root, "tooling") + sourceLines(root, "scripts")
  const percent = product === 0 ? 0 : Math.round((processLines * 1000) / product) / 10
  const over = product > 2000 && processLines * 10 >= product
  return { product, processLines, percent, over }
}

export const report = (result) => [
  `product ${result.product}`,
  `tooling and scripts ${result.processLines}`,
  `percent ${result.percent.toFixed(1)}`,
]

export const ruleGaps = (root) => {
  const plugin = path.join(root, "tooling/oxlint-plugin-airdesign")
  const rulesDirectory = path.join(plugin, "rules")
  if (!fs.existsSync(rulesDirectory)) return []
  const index = fs.readFileSync(path.join(plugin, "index.js"), "utf8")
  const config = fs.readFileSync(path.join(plugin, "oxlintrc.json"), "utf8")
  const gaps = []
  for (const name of fs.readdirSync(rulesDirectory)) {
    if (!name.endsWith(".js") || name.endsWith(".test.js")) continue
    const rule = name.slice(0, -".js".length)
    if (!fs.existsSync(path.join(rulesDirectory, `${rule}.test.js`))) gaps.push(`${rule} has no test`)
    if (!index.includes(`./rules/${rule}.js`)) gaps.push(`${rule} is missing from index.js`)
    if (!config.includes(`"airdesign/${rule}"`)) gaps.push(`${rule} is missing from oxlintrc.json`)
  }
  return gaps
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  const result = budget(root)
  for (const line of report(result)) console.log(line)
  const gaps = ruleGaps(root)
  for (const gap of gaps) console.log(gap)
  if (gaps.length > 0) process.exit(1)
  if (result.over) {
    console.log("A rule must be retired first.")
    process.exit(1)
  }
}
