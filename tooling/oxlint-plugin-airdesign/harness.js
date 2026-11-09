import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const pluginRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(pluginRoot, "../..")
const oxlint = path.join(repoRoot, "node_modules/.bin/oxlint")

if (!fs.existsSync(oxlint)) {
  throw new Error(`oxlint binary is missing at ${oxlint}`)
}

export const lintSource = (relativeName, source, rules) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-oxlint-"))
  try {
    const filePath = path.join(fixtureRoot, relativeName)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, source)
    const configPath = path.join(fixtureRoot, "oxlintrc.json")
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        categories: {
          correctness: "off",
          suspicious: "off",
          pedantic: "off",
          perf: "off",
          style: "off",
          restriction: "off",
          nursery: "off",
        },
        jsPlugins: [{ name: "airdesign", specifier: path.join(pluginRoot, "index.js") }],
        rules,
      }),
    )
    const result = spawnSync(oxlint, ["--config", configPath, "--format", "unix", filePath], {
      encoding: "utf8",
    })
    const failure = result.error ? result.error.message : ""
    return {
      status: result.status,
      output: `${result.stdout ?? ""}${result.stderr ?? ""}${failure}`,
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
  }
}

export const expectRejects = (name, relativeName, source, rules, text) => {
  const result = lintSource(relativeName, source, rules)
  if (result.status === 0 || !result.output.includes(text)) {
    throw new Error(`${name}\nexpected a failure containing ${JSON.stringify(text)}\n${result.output}`)
  }
}

export const expectAccepts = (name, relativeName, source, rules) => {
  const result = lintSource(relativeName, source, rules)
  if (result.status !== 0) {
    throw new Error(`${name}\nexpected a pass\n${result.output}`)
  }
}
