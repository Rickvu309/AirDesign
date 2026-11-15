import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const folder = path.join(root, ".github/workflows")
const workflowLines = fs
  .readdirSync(folder)
  .filter((name) => name.endsWith(".yml"))
  .flatMap((name) =>
    Object.values(parse(fs.readFileSync(path.join(folder, name), "utf8")).jobs).flatMap(({ steps = [] }) =>
      steps.flatMap((step) => (step.run ?? "").split(/\n|&&/)),
    ),
  )
const packageLines = Object.values(
  JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts,
).flatMap((script) => script.split("&&"))

const buildsTwoProjectsAtOnce = (line) => {
  const words = line.trim().split(/\s+/)
  if (words[0] !== "pnpm" || !words.includes("build")) return false
  const filters = words.filter((word) => word === "--filter" || word === "-F").length
  return filters >= 2 && !words.includes("--workspace-concurrency=1")
}

same(
  "a pnpm command that builds two projects with --filter runs them one at a time, because each `tsc -b` writes the dist of every package it references and two at once leave each other half-written declarations",
  [...workflowLines, ...packageLines].map((line) => line.trim()).filter(buildsTwoProjectsAtOnce),
  [],
)
