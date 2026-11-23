import path from "node:path"
import { fileURLToPath } from "node:url"

const separators = new Set([";", "&", "|", "(", ")", "`", "\n"])
const wordEnds = new Set([" ", "\t", "<", ">"])

const heredocStart = (line, at) => {
  let index = at + 2
  const stripTabs = line[index] === "-"
  if (stripTabs) index += 1
  while (line[index] === " " || line[index] === "\t") index += 1
  let delimiter = ""
  while (index < line.length && !wordEnds.has(line[index]) && !separators.has(line[index])) {
    if (line[index] !== "'" && line[index] !== '"' && line[index] !== "\\") delimiter += line[index]
    index += 1
  }
  return { delimiter, stripTabs, next: index }
}

const skipHeredocs = (line, at, heredocs) => {
  let index = at
  for (const { delimiter, stripTabs } of heredocs) {
    while (index < line.length) {
      const end = line.indexOf("\n", index)
      const text = line.slice(index, end === -1 ? line.length : end)
      index = end === -1 ? line.length : end + 1
      if ((stripTabs ? text.replace(/^\t+/, "") : text) === delimiter) break
    }
  }
  return index
}

const parse = (line, start, nested) => {
  const commands = []
  let words = []
  let word
  let heredocs = []
  let depth = 0
  const endWord = () => {
    if (word !== undefined) words.push(word)
    word = undefined
  }
  const endCommand = () => {
    endWord()
    if (words.length > 0) commands.push(words)
    words = []
  }
  const substitution = (at) => {
    const inner = parse(line, at + 2, true)
    commands.push(...inner.commands)
    return inner.end + 1
  }
  let index = start
  while (index < line.length) {
    const char = line[index]
    if (char === "\\") {
      if (line[index + 1] !== "\n") word = (word ?? "") + (line[index + 1] ?? "")
      index += 2
    } else if (char === "'") {
      const end = line.indexOf("'", index + 1)
      word = (word ?? "") + line.slice(index + 1, end === -1 ? line.length : end)
      index = end === -1 ? line.length : end + 1
    } else if (char === '"') {
      let text = ""
      index += 1
      while (index < line.length && line[index] !== '"') {
        if (line[index] === "$" && line[index + 1] === "(") {
          index = substitution(index)
          continue
        }
        if (line[index] === "\\" && index + 1 < line.length) index += 1
        text += line[index]
        index += 1
      }
      word = (word ?? "") + text
      index += 1
    } else if (char === "$" && line[index + 1] === "(") {
      word = word ?? ""
      index = substitution(index)
    } else if (char === "#" && word === undefined) {
      while (index < line.length && line[index] !== "\n") index += 1
    } else if (char === "<" && line[index + 1] === "<" && line[index + 2] !== "<") {
      endWord()
      const heredoc = heredocStart(line, index)
      heredocs.push(heredoc)
      index = heredoc.next
    } else if (char === "\n") {
      endCommand()
      index = skipHeredocs(line, index + 1, heredocs)
      heredocs = []
    } else if (char === ")" && depth === 0 && nested) {
      endCommand()
      return { commands, end: index }
    } else if (separators.has(char)) {
      if (char === "(") depth += 1
      if (char === ")") depth = Math.max(0, depth - 1)
      endCommand()
      index += 1
    } else if (wordEnds.has(char)) {
      endWord()
      index += 1
    } else {
      word = (word ?? "") + char
      index += 1
    }
  }
  endCommand()
  return { commands, end: index }
}

export const simpleCommands = (line) => parse(line, 0, false).commands

const wrappers = new Set(["env", "command", "exec", "time", "nohup", "sudo"])
const shells = new Set(["sh", "bash", "zsh", "dash"])
const assignment = /^[A-Za-z_][A-Za-z0-9_]*=/
const gitOptionsWithValue = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"])
const commitShortWithValue = new Set(["m", "F", "c", "C", "t"])
const commitShortAttachedValue = new Set(["S", "u"])
const commitLongWithValue = new Set([
  "--message",
  "--file",
  "--author",
  "--date",
  "--template",
  "--reuse-message",
  "--reedit-message",
  "--fixup",
  "--squash",
  "--cleanup",
  "--trailer",
  "--pathspec-from-file",
])
const skipsHooks = (word) => word.startsWith("--no-veri") && "--no-verify".startsWith(word.split("=")[0])
const emptiesHooksPath = (value) => /^core\.hookspath=/i.test(value)

const commitSkipsHooks = (args) => {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--") return false
    if (skipsHooks(arg)) return true
    if (commitLongWithValue.has(arg)) index += 1
    else if (/^-[^-]/.test(arg)) {
      for (let at = 1; at < arg.length; at += 1) {
        const flag = arg[at]
        if (flag === "n") return true
        if (commitShortWithValue.has(flag)) {
          if (at === arg.length - 1) index += 1
          break
        }
        if (commitShortAttachedValue.has(flag)) break
      }
    }
  }
  return false
}

const withoutWrappers = (words) => {
  let rest = words
  while (rest.length > 0 && (assignment.test(rest[0]) || wrappers.has(path.basename(rest[0])))) {
    const wrapper = wrappers.has(path.basename(rest[0]))
    rest = rest.slice(1)
    if (wrapper) while (rest.length > 0 && (rest[0].startsWith("-") || assignment.test(rest[0]))) rest = rest.slice(1)
  }
  return rest
}

const gitRefusal = (args) => {
  let hooksEmptied = false
  let index = 0
  while (index < args.length && args[index].startsWith("-")) {
    const option = args[index]
    if (gitOptionsWithValue.has(option)) {
      if (option === "-c" && emptiesHooksPath(args[index + 1] ?? "")) hooksEmptied = true
      index += 2
    } else index += 1
  }
  const [subcommand, ...rest] = args.slice(index)
  if (subcommand === "stash") return refusals.stash
  if (subcommand === "commit" && (hooksEmptied || commitSkipsHooks(rest))) return refusals.commit
  if (subcommand === "push" && (hooksEmptied || rest.some(skipsHooks))) return refusals.push
  return undefined
}

const refusals = {
  commit: {
    kind: "commit",
    message:
      'Refused: this commit skips the pre-commit hook. The hook only formats what parses and refuses nothing, so commit through it. For work in progress, run `git commit -m wip`; before `pnpm land`, fold it into one commit with `node scripts/linear-branch.mjs --rebuild --message "<title>"`.',
  },
  push: {
    kind: "push",
    message:
      "Refused: this push skips the pre-push hook. Open or update the pull request with `pnpm land --title ... --body-file ...`; it runs `pnpm gate` and pushes a stamped commit.",
  },
  stash: {
    kind: "stash",
    message:
      "Refused: every worktree shares one `git stash`, so another agent can pop or drop your entry. Keep work in progress as a commit with `git commit -m wip`, then rebase or switch branches. To read an old entry, run `git reflog refs/stash` and `git diff <hash>^1 <hash>`.",
  },
}

export const refusedGit = (line) => {
  for (const words of simpleCommands(line)) {
    const [program, ...args] = withoutWrappers(words)
    if (program === undefined) continue
    const name = path.basename(program)
    if (shells.has(name)) {
      const script = args.findIndex((arg) => /^-[a-z]*c[a-z]*$/.test(arg))
      const refusal = script === -1 ? undefined : refusedGit(args[script + 1] ?? "")
      if (refusal) return refusal
    } else if (name === "git") {
      const refusal = gitRefusal(args)
      if (refusal) return refusal
    }
  }
  return undefined
}

const readStdin = async () => {
  let text = ""
  for await (const chunk of process.stdin) text += chunk
  return text
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse((await readStdin()) || "{}")
  const command = input.tool_input?.command
  const refusal = typeof command === "string" ? refusedGit(command) : undefined
  if (refusal) {
    process.stderr.write(`${refusal.message}\n`)
    process.exitCode = 2
  }
}
