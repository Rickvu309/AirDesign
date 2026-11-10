import fs from "node:fs"

const vague = new Set(["utils", "helpers", "common"])
const glossaryFile = "tooling/oxlint-plugin-airdesign/glossary.json"
export const glossary = JSON.parse(fs.readFileSync(new URL("./glossary.json", import.meta.url), "utf8"))
export const wordExtensions = new Set([".md", ".json", ".sh", ".html", ".svg", ".tla"])

const banned = Object.entries(glossary.words)
  .sort(([left], [right]) => right.split(" ").length - left.split(" ").length)
  .map(([word, use]) => ({
    word,
    use,
    pattern: new RegExp(`(?<![a-z0-9])${word.split(" ").join("[\\s_-]+")}s?(?![a-z0-9])`, "gu"),
  }))

const bannedIn = (text) => {
  let rest = text.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").toLowerCase()
  const found = []
  for (const entry of banned) {
    rest = rest.replace(entry.pattern, (match) => {
      found.push(entry)
      return " ".repeat(match.length)
    })
  }
  return found
}

const said = (entry) => `Write "${entry.use}" instead of "${entry.word}".`

export const nameFindings = (relative) => [
  ...relative
    .split("/")
    .filter((part) => vague.has(part.split(".")[0].toLowerCase()))
    .map((part) => `${relative}: Rename ${part} after what it contains.`),
  ...bannedIn(relative).map((entry) => `${relative}: ${said(entry)}`),
]

export const wordFindings = (relative, source) => {
  if (relative === glossaryFile) return []
  const allowed = new Set(glossary.allowed.filter((one) => one.file === relative).map((one) => one.text))
  return source
    .split("\n")
    .flatMap((line, index) =>
      allowed.has(line.trim()) ? [] : bannedIn(line).map((entry) => `${relative}:${index + 1}: ${said(entry)}`),
    )
}
