import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { runToolingTests } from "./tooling-tests.mjs"
import { cleanEnvironment, isInherited, stripInherited } from "./test-environment.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fail = (message) => {
  throw new Error(message)
}
const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const inherited = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "CLAUDECODE",
  "CLAUDE_CODE_SESSION_ID",
  "CODEX_HOME",
  "OPENAI_API_KEY",
]
const kept = ["PATH", "HOME", "CI", "GIT_EDITOR", "GIT_AUTHOR_NAME", "AIRA_ANTHROPIC_KEY", "CLAUDE", "T3CODE_HOME"]

same("each repository selector and provider variable is inherited", inherited.filter(isInherited), inherited)
same("a variable that does not pick a repository or a provider stays", kept.filter(isInherited), [])

const sample = Object.fromEntries([...inherited, ...kept].map((name) => [name, "x"]))
same("cleanEnvironment keeps the rest", Object.keys(cleanEnvironment(sample)), kept)
same("cleanEnvironment leaves its input alone", Object.keys(sample).length, inherited.length + kept.length)
const target = { ...sample }
same("stripInherited names what it removed", stripInherited(target), inherited)
same("stripInherited deletes in place", Object.keys(target), kept)

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "test-environment-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
const identity = ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false"]
const git = (cwd, env, ...args) =>
  execFileSync("git", [...identity, ...args], { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
const commits = (repository) => Number(git(repository, cleanEnvironment(process.env), "rev-list", "--count", "HEAD"))

const outer = path.join(folder, "outer")
const scratch = path.join(folder, "scratch")
for (const repository of [outer, scratch]) {
  fs.mkdirSync(repository)
  git(repository, cleanEnvironment(process.env), "init", "-q", "-b", "main")
  git(repository, cleanEnvironment(process.env), "commit", "-q", "--allow-empty", "-m", "start")
}
fs.writeFileSync(
  path.join(scratch, "scripts-test.mjs"),
  [
    'import { execFileSync } from "node:child_process"',
    'execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "commit", "-q", "--allow-empty", "-m", "fixture"], { stdio: "ignore" })',
    "console.log(Object.keys(process.env).filter((name) => /^(GIT_DIR|ANTHROPIC_|CLAUDE)/.test(name)).join())",
  ].join("\n"),
)

const dirty = { GIT_DIR: path.join(outer, ".git"), ANTHROPIC_API_KEY: "key", CLAUDECODE: "1" }
const before = Object.fromEntries(Object.keys(dirty).map((name) => [name, process.env[name]]))
Object.assign(process.env, dirty)
let results
try {
  results = await runToolingTests(["scripts-test.mjs"], { cwd: scratch, limit: Number.POSITIVE_INFINITY })
} finally {
  for (const [name, value] of Object.entries(before)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}
same(
  "a script test started with GIT_DIR set passes",
  results.map(({ status }) => status),
  [0],
)
same("a script test sees no repository selector and no provider variable", results[0].output.trim(), "")
same("a script test's git commit lands in its own repository", [commits(scratch), commits(outer)], [2, 1])

const metrics = path.join(folder, "metrics.json")
execFileSync(
  "pnpm",
  ["exec", "vitest", "run", "--project", "unit", "--reporter=dot", "tests/clean-environment.test.ts"],
  {
    cwd: root,
    env: {
      ...process.env,
      ...dirty,
      CODEX_HOME: "x",
      OPENAI_API_KEY: "x",
      GIT_INDEX_FILE: "x",
      AIRDESIGN_VITEST_METRICS: metrics,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
)

const config = (await import(pathToFileURL(path.join(root, "vitest.config.mts")).href)).default
const cleaner = "scripts/vitest-clean-environment.mjs"
if (!config.test.setupFiles.includes(cleaner)) fail("vitest.config.mts does not strip the inherited environment")
for (const project of config.test.projects) {
  if (project.extends !== true && !project.test.setupFiles?.includes(cleaner))
    fail(`the ${project.test.name} project does not strip the inherited environment`)
}

const launch = (await import(pathToFileURL(path.join(root, "tests/browser/launch.ts")).href)).default
const savedCi = process.env.CI
const savedOverride = process.env.AIRDESIGN_BROWSER_WORKERS
process.env.CI = "0"
delete process.env.AIRDESIGN_BROWSER_WORKERS
process.env.GIT_DIR = dirty.GIT_DIR
process.env.OPENAI_API_KEY = "key"
try {
  await launch({ workers: 999 }).then(
    () => fail("a browser run with too many workers started"),
    () => undefined,
  )
  same(
    "the browser run starts with no inherited variable",
    [process.env.GIT_DIR, process.env.OPENAI_API_KEY],
    [undefined, undefined],
  )
} finally {
  delete process.env.GIT_DIR
  delete process.env.OPENAI_API_KEY
  if (savedCi === undefined) delete process.env.CI
  else process.env.CI = savedCi
  if (savedOverride !== undefined) process.env.AIRDESIGN_BROWSER_WORKERS = savedOverride
}

console.log("test environment tests passed")
