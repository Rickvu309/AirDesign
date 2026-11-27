export { newDeckTheme, themePresets, themePresetById, themePresetOf } from "./theme-presets.js"

const fs = () => process.getBuiltinModule("node:fs")
const nodePath = () => process.getBuiltinModule("node:path")
const defaultDir = () => process.getBuiltinModule("node:url").fileURLToPath(new URL("../files", import.meta.url))
const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/
const styleNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const indexEntryPattern = /^- `([a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)`:\s*(.+)$/
const parameterPattern = /^- `([^`]+)`:\s*(.+)$/

function stripMarkdownExtension(raw: string): string {
  return raw.endsWith(".md") ? raw.slice(0, -3) : raw
}

function inside(root: string, candidate: string): boolean {
  const path = nodePath()
  const relative = path.relative(root, candidate)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function parseSkillIndex(markdown: string): readonly { readonly name: string; readonly when: string }[] {
  const entries: { readonly name: string; readonly when: string }[] = []
  for (const line of markdown.split(/\r?\n/)) {
    const matched = indexEntryPattern.exec(line.trim())
    if (matched !== null) {
      entries.push({ name: matched[1]!, when: matched[2]!.trim() })
    }
  }
  return entries
}

function summaryOf(markdown: string): string {
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith("## ")) break
    if (trimmed === "" || trimmed.startsWith("#")) continue
    return trimmed
  }
  return ""
}

function parseParameters(markdown: string): readonly { readonly name: string; readonly description: string }[] {
  const parameters: { readonly name: string; readonly description: string }[] = []
  let inParameters = false
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (/^##\s+/.test(trimmed)) {
      inParameters = /^##\s+parameters\s*$/i.test(trimmed)
      continue
    }
    if (!inParameters) continue
    const matched = parameterPattern.exec(trimmed)
    if (matched !== null) {
      parameters.push({ name: matched[1]!, description: matched[2]!.trim() })
    }
  }
  return parameters
}

export function readSkillIndex(dir: string = defaultDir()): {
  readonly markdown: string
  readonly skills: readonly { readonly name: string; readonly when: string }[]
} {
  const markdown = fs().readFileSync(nodePath().join(dir, "index.md"), "utf8").trimEnd()
  return { markdown, skills: parseSkillIndex(markdown) }
}

export function readSkill(
  rawName: string,
  dir: string = defaultDir(),
): { readonly name: string; readonly markdown: string } | undefined {
  const name = stripMarkdownExtension(rawName.trim())
  if (!skillNamePattern.test(name) || name === "index" || name === "styles" || name.startsWith("styles/")) {
    return undefined
  }
  const path = nodePath()
  const { existsSync, readFileSync, statSync } = fs()
  const root = path.resolve(dir)
  const target = path.resolve(root, `${name}.md`)
  if (!inside(root, target) || !existsSync(target) || !statSync(target).isFile()) return undefined
  return { name, markdown: readFileSync(target, "utf8").trimEnd() }
}

export function listStyles(dir: string = defaultDir()): readonly { readonly name: string; readonly summary: string }[] {
  const path = nodePath()
  const { existsSync, readdirSync, readFileSync, statSync } = fs()
  const stylesDir = path.join(dir, "styles")
  if (!existsSync(stylesDir) || !statSync(stylesDir).isDirectory()) return []
  const names = readdirSync(stylesDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => entry.slice(0, -3))
    .filter((name) => styleNamePattern.test(name))
    .sort()
  return names.map((name) => {
    const markdown = readFileSync(path.join(stylesDir, `${name}.md`), "utf8")
    return { name, summary: summaryOf(markdown) }
  })
}

export function readStyle(
  rawName: string,
  dir: string = defaultDir(),
):
  | {
      readonly name: string
      readonly markdown: string
      readonly parameters: readonly { readonly name: string; readonly description: string }[]
    }
  | undefined {
  const name = stripMarkdownExtension(rawName.trim())
  if (!styleNamePattern.test(name)) return undefined
  const path = nodePath()
  const { existsSync, readFileSync, statSync } = fs()
  const stylesDir = path.resolve(dir, "styles")
  const target = path.resolve(stylesDir, `${name}.md`)
  if (!inside(stylesDir, target) || !existsSync(target) || !statSync(target).isFile()) return undefined
  const markdown = readFileSync(target, "utf8").trimEnd()
  return { name, markdown, parameters: parseParameters(markdown) }
}
