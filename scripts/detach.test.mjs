import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { startDetached, waitDetached } from "./detach.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "detach-"))
const root = path.join(folder, "worktree")
let runFile
process.on("exit", () => {
  if (runFile && !fs.existsSync(path.join(path.dirname(runFile), "status"))) {
    const { pid } = JSON.parse(fs.readFileSync(runFile, "utf8"))
    try {
      process.kill(-pid, "SIGKILL")
    } catch {}
  }
  fs.rmSync(folder, { recursive: true, force: true })
})
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => process.exit(128 + os.constants.signals[signal]))
}
fs.mkdirSync(root)
const node = (script) => [process.execPath, "-e", script]

const said = []
const started = startDetached({
  folder,
  root,
  command: node(
    "setTimeout(() => { console.log('half'); }, 300); setTimeout(() => { console.log('done'); process.exit(3) }, 900)",
  ),
  say: (line) => said.push(line),
})
same("a detached run starts", started, 0)
same("and says how to follow it", said.at(-1).includes("pnpm detach --wait"), true)
same(
  "a second run in the same worktree is refused while the first goes on",
  startDetached({ folder, root, command: node(""), say: (line) => said.push(line) }),
  1,
)
same("naming the wait", said.at(-1).includes("pnpm detach --wait"), true)

runFile = path.join(
  folder,
  fs.readdirSync(folder).find((name) => name !== "worktree"),
  "run.json",
)
const record = JSON.parse(fs.readFileSync(runFile, "utf8"))
same(
  "the run sits in its own session, so the end of the call that started it does not end it",
  spawnSync("ps", ["-o", "sid=", "-p", String(record.pid)], { encoding: "utf8" }).stdout.trim(),
  String(record.pid),
)

const early = []
same(
  "a wait shorter than the run says it still runs",
  await waitDetached({ folder, root, limitMs: 100, say: (line) => early.push(line) }),
  75,
)
same("and how to go on", early.at(-1).includes("pnpm detach --wait"), true)

const late = []
same(
  "a wait that sees the end exits with the run's code",
  await waitDetached({ folder, root, limitMs: 20_000, say: (line) => late.push(line) }),
  3,
)
same(
  "it prints the output once, in order",
  late.filter((line) => ["half", "done"].includes(line)),
  ["half", "done"],
)
same("and the end", late.at(-1).includes("exit 3"), true)

const again = []
same(
  "a wait after the end repeats the code",
  await waitDetached({ folder, root, limitMs: 100, say: (line) => again.push(line) }),
  3,
)
same(
  "and prints no output twice",
  again.some((line) => ["half", "done"].includes(line)),
  false,
)

same(
  "another run starts after the first ends",
  startDetached({
    folder,
    root,
    command: node("process.stdout.write('hé'); setTimeout(() => console.log('llo'), 1500)"),
    say: () => {},
  }),
  0,
)
const deadline = Date.now() + 10000
while (!fs.existsSync(record.log) || fs.readFileSync(record.log).length === 0) {
  if (Date.now() > deadline) throw new Error("the run never wrote its partial line")
  await new Promise((resolve) => setTimeout(resolve, 10))
}
same(
  "a bounded wait ends while the partial line is pending",
  await waitDetached({ folder, root, limitMs: 20, say: () => {} }),
  75,
)
const completed = []
same(
  "the next wait finishes",
  await waitDetached({ folder, root, limitMs: 20000, say: (line) => completed.push(line) }),
  0,
)
same("a partial UTF-8 line survives between waits", completed.includes("héllo"), true)

same("a finished run lets the next start", startDetached({ folder, root, command: node(""), say: () => {} }), 0)
same("the last detached run finishes", await waitDetached({ folder, root, limitMs: 20000, say: () => {} }), 0)
same(
  "a worktree with no run has nothing to wait for",
  await waitDetached({ folder, root: path.join(folder, "other"), limitMs: 100, say: () => {} }),
  1,
)

console.log("detach tests passed")
