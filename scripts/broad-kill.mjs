import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const killers = ["pk" + "ill", "kill" + "all"].join("|")
const stop = "kil" + "l"
const exe = (names) => `(?:\\S*/)?(?:${names})(?=\\s|$)`
const wrappers = "(?:(?:sudo|exec|env|nohup|xargs)\\s+(?:-\\S+\\s+|\\{\\}\\s+|\\d+\\s+)*)*"
const commandStart = "(?:^|[|;&(]|\\$\\()\\s*(?:\\$\\s+)?"
const searcher = "(?:ps|pgrep|pidof|lsof|fuser)"
const patterns = [
  new RegExp(`${commandStart}${wrappers}${exe(killers)}`),
  new RegExp(`\\b${searcher}\\s[^\\n]*\\|\\s*${wrappers}${exe(stop)}`),
  new RegExp(`${commandStart}${exe(stop)}\\s+(?:-\\S+\\s+)*(?:\\$\\(|\`)\\s*${searcher}\\b`),
]
const broad = { test: (line) => !line.trimStart().startsWith("#") && patterns.some((each) => each.test(line)) }

export const broadKills = (files) =>
  files.flatMap(({ file, text }) =>
    text
      .split("\n")
      .map((line, at) => ({ file, line: at + 1, text: line }))
      .filter((each) => broad.test(each.text)),
  )

export const killFault = (found) =>
  found.length === 0
    ? undefined
    : `a command kills processes by name, which also kills other agents' test runs on this machine: ${found.map((each) => `${each.file}:${String(each.line)}`).join(", ")}. Stop only what you started: run \`verify-airdesign stop <run>\` for a verify stack, or kill the pid your own script recorded.`

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  const names = execFileSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  })
    .split("\0")
    .filter((file) => file !== "")
  const files = names.flatMap((file) => {
    try {
      const text = readFileSync(path.join(root, file), "utf8")
      return text.includes("\0") ? [] : [{ file, text }]
    } catch {
      return []
    }
  })
  const fault = killFault(broadKills(files))
  if (fault !== undefined) {
    console.error(fault)
    process.exit(1)
  }
}
