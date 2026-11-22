import { existsSync } from "node:fs"
import path from "node:path"
import { findings, type Finding } from "./rules.ts"
import { judge, readTodos, writeTodos } from "./todo.ts"
import { configFile, loadWorkspace, packOf, type Workspace } from "./workspace.ts"

type Io = { readonly out: (line: string) => void; readonly err: (line: string) => void }

const usage = `usage: ts-packwerk <command> [options]

commands:
  check [--json]        report references that break pack rules and are not in a pack_todo.yml
  update-todo           record every current violation in pack_todo.yml files
  explain <pack>        describe a pack: its rules, public paths, what it uses and what uses it

options:
  --root <dir>          repository root (default: nearest folder with ${configFile})`

const line = (finding: Finding): string =>
  `${finding.file}:${String(finding.line)}:${String(finding.column)}  ${finding.rule}  ${finding.message}`

const counted = (items: readonly string[]): string[] => {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([item, count]) => `${item} (${String(count)})`)
}

const explain = (workspace: Workspace, name: string, io: Io): number => {
  const pack = workspace.packs.find((item) => item.name === name)
  if (pack === undefined) {
    io.err(`no pack named ${name}; packs: ${workspace.packs.map((item) => item.name).join(", ")}`)
    return 2
  }
  const owned = workspace.files.filter((file) => packOf(workspace.packs, file) === pack)
  const outgoing: string[] = []
  const incoming: string[] = []
  for (const reference of workspace.references) {
    if (reference.target.kind !== "file") continue
    const from = packOf(workspace.packs, reference.file)
    const to = packOf(workspace.packs, reference.target.file)
    if (from === undefined || to === undefined || from === to) continue
    if (from === pack) outgoing.push(to.name)
    if (to === pack) incoming.push(from.name)
  }
  const todos = readTodos(workspace.root, [pack]).get(pack.name) ?? []
  const rules = [
    pack.enforceDependencies && "dependencies",
    pack.enforcePrivacy && "privacy",
    pack.enforceLayers && pack.layer !== undefined && "layers",
  ].filter((item) => item !== false)
  for (const text of [
    `# ${pack.name}`,
    "",
    `layer: ${pack.layer ?? "none"}`,
    `enforces: ${rules.join(", ") || "nothing"}`,
    `files: ${String(owned.length)}`,
    `public: ${pack.publicPaths.join(", ") || "none"}`,
    `declared dependencies: ${pack.dependencies.join(", ") || "none"}`,
    `uses: ${counted(outgoing).join(", ") || "nothing"}`,
    `used by: ${counted(incoming).join(", ") || "nothing"}`,
    `open todos: ${String(todos.length)}`,
  ]) {
    io.out(text)
  }
  return 0
}

const findRoot = (start: string): string => {
  let directory = path.resolve(start)
  for (;;) {
    if (existsConfig(directory)) return directory
    const parent = path.dirname(directory)
    if (parent === directory) return path.resolve(start)
    directory = parent
  }
}

const existsConfig = (directory: string): boolean => existsSync(path.join(directory, configFile))

export const runCli = async (argv: readonly string[], io: Io): Promise<number> => {
  const args = [...argv]
  const rootAt = args.indexOf("--root")
  const root = rootAt >= 0 ? path.resolve(args.splice(rootAt, 2)[1] ?? ".") : findRoot(process.cwd())
  const json = args.includes("--json")
  const [command, ...rest] = args.filter((arg) => arg !== "--json")
  if (command === undefined || command === "help" || command === "--help") {
    io.out(usage)
    return command === undefined ? 2 : 0
  }
  if (!["check", "update-todo", "explain"].includes(command)) {
    io.err(`unknown command ${command}\n\n${usage}`)
    return 2
  }
  const started = performance.now()
  const workspace = await loadWorkspace(root)
  if (workspace.problems.length > 0) {
    for (const problem of workspace.problems) io.err(`config  ${problem}`)
    return 2
  }
  if (command === "explain") return explain(workspace, rest[0] ?? "", io)
  const found = findings(workspace)
  if (command === "update-todo") {
    const written = writeTodos(root, workspace.packs, found)
    const left = found.length - written
    io.out(`recorded ${String(written)} violations in pack_todo.yml files`)
    for (const finding of found.filter((item) => item.rule === "cycle" || item.rule === "package"))
      io.err(line(finding))
    return left === 0 ? 0 : 1
  }
  const verdict = judge(found, readTodos(root, workspace.packs))
  const seconds = ((performance.now() - started) / 1000).toFixed(2)
  if (json) {
    io.out(JSON.stringify({ fresh: verdict.fresh, stale: verdict.stale, listed: verdict.listed.length }, null, 2))
  } else {
    for (const finding of verdict.fresh) io.out(line(finding))
    for (const entry of verdict.stale) {
      io.out(
        `${entry.file}  stale  ${entry.fromPack}/pack_todo.yml lists ${entry.rule} on ${entry.target}, which is fixed; run ts-packwerk update-todo`,
      )
    }
    io.out(
      `${String(workspace.files.length)} files, ${String(workspace.packs.length)} packs, ${String(verdict.fresh.length)} new violations, ${String(verdict.stale.length)} stale todos, ${String(verdict.listed.length)} known, ${seconds} s`,
    )
  }
  return verdict.fresh.length === 0 && verdict.stale.length === 0 ? 0 : 1
}

if (import.meta.main) {
  process.exitCode = await runCli(process.argv.slice(2), {
    out: (text) => console.log(text),
    err: (text) => console.error(text),
  })
}
