import { execFileSync, spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { jarPath, javaBin } from "./check-specs.mjs"
import { workingTree } from "./checked.mjs"
import { approvedCommit, guarded, localFork, localOwner, localWarning, packageFile } from "./ratchet.mjs"

const checkFolders = ["tooling/", "scripts/"]
const proofName = /\.test\.(js|mjs|ts)$/
const supportName = /^(harness|run-tests|check-regression-run)\.m?js$/
const proofRun = "scripts/check-regression-run.mjs"
const proofSeconds = 300
const killSeconds = 10
const timedOutStatus = 124
const unprivileged = 65534
const largeOutput = 64 * 1024 * 1024
const proofNeeds = {
  "scripts/bug-rule.test.mjs": ["git"],
  "scripts/check-specs.test.mjs": ["Java 21", "tla2tools.jar"],
  "scripts/check-regression.test.mjs": ["git"],
  "scripts/metrics.test.mjs": ["git"],
  "scripts/ratchet.test.mjs": ["git"],
}
const needFinders = {
  git: () => execFileSync("git", ["--version"], { stdio: "ignore" }),
  "Java 21": javaBin,
  "tla2tools.jar": jarPath,
}
const advice =
  "Restore the behaviour each broken case expects and the lines each proof lost. If the check is meant to change, ask the repo owner to approve the pull request, then run this check again."
const sameProofs = "Every proof is the same as on main, and the tooling and test steps run each one here."
const behindAdvice = "This pull request is behind main. Update it and run again."
const sandboxProbe = [
  'const fs = require("node:fs")',
  'const os = require("node:os")',
  'fs.readFileSync("package.json")',
  'fs.writeFileSync(require("node:path").join(os.tmpdir(), "probe"), "")',
  "let locked = false",
  'try { fs.writeFileSync("probe", "") } catch { locked = true }',
  "const offline = Object.values(os.networkInterfaces()).flat().every((face) => face.internal)",
  "console.log(JSON.stringify({ user: process.getuid(), locked, offline }))",
].join("\n")

const inCheckFolder = (file) => checkFolders.some((folder) => file.startsWith(folder))

export const proofRunner = (file) => {
  if (inCheckFolder(file) && /\.test\.m?js$/.test(file)) return "node"
  if (inCheckFolder(file) && file.endsWith(".test.ts")) return "vitest"
  if (/^tests\/[^/]+\.test\.ts$/.test(file)) return "vitest"
  return undefined
}

export const proofFiles = (baseFiles) => baseFiles.filter((file) => proofRunner(file) !== undefined).sort()

export const proofSupport = (file) => inCheckFolder(file) && supportName.test(path.posix.basename(file))

export const checkFile = (file) =>
  inCheckFolder(file) &&
  !proofName.test(file) &&
  !proofSupport(file) &&
  file
    .split("/")
    .every(
      (part) =>
        part !== "" && part !== ".." && part !== "node_modules" && !part.startsWith(".") && !part.includes("\\"),
    )

export const changedFiles = (fromTree, toTree) =>
  [...new Set([...fromTree.keys(), ...toTree.keys()])].filter((file) => fromTree.get(file) !== toTree.get(file)).sort()

export const checkChanges = (mergeTree, headTree) =>
  changedFiles(mergeTree, headTree)
    .filter(checkFile)
    .map((file) => ({ file, entry: headTree.get(file) }))

export const changedProofs = (mergeTree, headTree) =>
  changedFiles(mergeTree, headTree).filter(
    (file) => mergeTree.has(file) && (proofRunner(file) !== undefined || proofSupport(file)),
  )

export const localProofs = (proofs, changed) =>
  changed.some(proofSupport) ? proofs : proofs.filter((file) => changed.includes(file))

export const lostLines = (numstat) =>
  numstat
    .split("\0")
    .filter((row) => row !== "")
    .map((row) => {
      const [, lost, file] = row.split("\t")
      return { file, lost: lost === "-" ? 1 : Number(lost) }
    })

export const proofLosses = (changed, lost) =>
  changed.flatMap((file) => {
    const lines = lost.find((one) => one.file === file)?.lost ?? 0
    if (lines === 0) return []
    const said = `lost ${lines} ${lines === 1 ? "line" : "lines"} it had on main. A proof may gain cases. It may not lose them.`
    return [{ file, state: "broken", said }]
  })

export const unprovedLines = (mergeTree, headTree) =>
  changedFiles(mergeTree, headTree)
    .filter((file) => !inCheckFolder(file))
    .flatMap((file) => {
      if (guarded(file)) return [`${file} changes how checks run and has no proof. It is listed for the owner.`]
      if (packageFile(file) || file === "pnpm-lock.yaml") return [`${file} changes how checks run and has no proof.`]
      return []
    })

const plainFolder = (base, folder) => {
  let existing = folder
  while (!fs.existsSync(existing)) existing = path.dirname(existing)
  return fs.realpathSync(existing) === existing && (existing === base || existing.startsWith(`${base}${path.sep}`))
}

export const layIn = (baseRoot, changes, headContent) => {
  const base = fs.realpathSync(baseRoot)
  for (const { file, entry } of changes) {
    if (!checkFile(file)) throw new Error(`${file} is not a check file, so it is not taken from the pull request.`)
    const target = path.join(base, file)
    const folder = path.dirname(target)
    if (!plainFolder(base, folder)) {
      throw new Error(`${path.dirname(file)} is a link on main, so ${file} cannot be laid in.`)
    }
    if (entry === undefined) {
      fs.rmSync(target, { force: true })
      continue
    }
    const [mode, print] = entry.split(" ")
    if (mode !== "100644" && mode !== "100755") {
      throw new Error(`${file} is a link in the pull request. A check file must be a plain file.`)
    }
    fs.mkdirSync(folder, { recursive: true })
    fs.rmSync(target, { force: true, recursive: true })
    fs.writeFileSync(target, headContent(file, print), { mode: mode === "100755" ? 0o755 : 0o644 })
  }
}

export const missingNeeds = (file, has) => (proofNeeds[file] ?? []).filter((need) => !has(need))

export const firstFailure = ({ status, output }) => {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
  const failedCase = lines.find((line) => /^(FAIL|×) .* > /.test(line))
  const thrown = lines.map((line) => /^(?:\w+: )?\w*Error(?: \[\w+\])?: (.+)$/.exec(line)?.[1]).find(Boolean)
  const message = [failedCase, thrown].filter(Boolean).join(": ")
  return (message || lines[0] || `exit ${status}`).slice(0, 300)
}

const failedCase = (report) => {
  const cases = (report?.testResults ?? []).flatMap((result) => result.assertionResults ?? [])
  const failed = cases.find((one) => one.status === "failed")
  if (failed === undefined) return undefined
  const reason = String(failed.failureMessages?.[0] ?? "").split("\n")[0]
  return `${failed.fullName}: ${reason}`.slice(0, 300)
}

export const proofState = ({
  runner,
  status,
  stdout = "",
  stderr = "",
  token,
  report,
  timedOut = false,
  seconds = proofSeconds,
}) => {
  const failure = () => firstFailure({ status, output: `${stderr}\n${stdout}` })
  if (timedOut || status === timedOutStatus) return { state: "broken", said: `did not finish in ${seconds} s` }
  if (status !== 0) return { state: "broken", message: failedCase(report) ?? failure() }
  if (runner === "vitest") {
    const failed = failedCase(report)
    if (failed !== undefined) return { state: "broken", message: failed }
    const passed = report?.numPassedTests
    if (!Number.isInteger(passed) || passed < 1 || report.numFailedTests !== 0 || report.success !== true) {
      return { state: "broken", message: "ran no test" }
    }
    return { state: "kept" }
  }
  const finished = token !== "" && stdout.split("\n").some((line) => line.trim() === token)
  return finished ? { state: "kept" } : { state: "broken", message: "stopped before it finished" }
}

export const verdict = ({ results, approved, behind = false }) => {
  const lines = results.map((result) => {
    if (result.state === "kept") return `kept ${result.file}`
    if (result.state === "broken" && result.said !== undefined) return `broken: ${result.file} ${result.said}`
    if (result.state === "broken") return `broken ${result.file}: ${result.message}`
    return `not proved here ${result.file}: ${result.message}`
  })
  if (!results.some((result) => result.state === "broken")) return { pass: true, lines }
  if (approved) return { pass: true, lines: [...lines, "The repo owner approved this commit, so it passes as it is."] }
  return { pass: false, lines: [...lines, behind ? behindAdvice : advice] }
}

export const proofEnv = ({ home, nodeFolder, tools = {} }) => ({
  PATH: `${nodeFolder}:/usr/local/bin:/usr/bin:/bin`,
  HOME: home,
  TMPDIR: home,
  NO_COLOR: "1",
  CI: "true",
  GITHUB_ACTIONS: "true",
  ...tools,
})

export const sandboxed = ({ env, command, runsInCi, seconds = proofSeconds }) => [
  ...(runsInCi
    ? [
        "sudo",
        "-n",
        "unshare",
        "--net",
        "--",
        "setpriv",
        `--reuid=${unprivileged}`,
        `--regid=${unprivileged}`,
        "--clear-groups",
        "--no-new-privs",
        "--",
      ]
    : []),
  "env",
  "-i",
  ...Object.entries(env).map(([name, value]) => `${name}=${value}`),
  "timeout",
  `--kill-after=${killSeconds}`,
  String(seconds),
  ...command,
]

export const withLoopback = (argv) => {
  const split = argv.indexOf("--")
  if (argv[0] !== "sudo" || split === -1) return argv
  return [...argv.slice(0, split + 1), "sh", "-c", 'ip link set lo up && exec "$@"', "sh", ...argv.slice(split + 1)]
}

const found = (need) => {
  try {
    return needFinders[need]() ?? true
  } catch {
    return undefined
  }
}

const tools = () =>
  Object.fromEntries(
    [
      ["JAVA", found("Java 21")],
      ["TLA2TOOLS", found("tla2tools.jar")],
    ].filter(([, value]) => typeof value === "string"),
  )

const scratchHome = (runsInCi) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-check-regression-"))
  fs.writeFileSync(path.join(home, ".gitconfig"), "[safe]\n\tdirectory = *\n")
  if (runsInCi) fs.chmodSync(home, 0o777)
  return home
}

const readReport = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return undefined
  }
}

export const runProof = (
  baseRoot,
  file,
  { runsInCi = false, has = (need) => found(need) !== undefined, seconds = proofSeconds } = {},
) => {
  const missing = missingNeeds(file, has)
  if (missing.length > 0) {
    const message = `this machine has no ${missing.join(" or ")}`
    if (runsInCi) return { file, state: "broken", said: `could not be proved here: ${message}` }
    return { file, state: "not proved", message }
  }
  const home = scratchHome(runsInCi)
  const runner = proofRunner(file)
  const token = randomBytes(24).toString("hex")
  const reportFile = path.join(home, "report.json")
  const command =
    runner === "vitest"
      ? [
          path.join(baseRoot, "node_modules", ".bin", "vitest"),
          "run",
          file,
          "--configLoader=runner",
          "--reporter=json",
          `--outputFile=${reportFile}`,
        ]
      : [process.execPath, path.join(baseRoot, proofRun), file]
  const env = proofEnv({ home, nodeFolder: path.dirname(process.execPath), tools: tools() })
  const [program, ...args] = withLoopback(sandboxed({ env, command, runsInCi, seconds }))
  const result = spawnSync(program, args, {
    cwd: baseRoot,
    input: runner === "node" ? `${token}\n` : "",
    encoding: "utf8",
    timeout: (seconds + 3 * killSeconds) * 1000,
    killSignal: "SIGKILL",
    maxBuffer: largeOutput,
  })
  const timedOut = result.error?.code === "ETIMEDOUT"
  const state = proofState({
    runner,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}\n${timedOut ? "" : (result.error?.message ?? "")}`,
    token,
    report: runner === "vitest" ? readReport(reportFile) : undefined,
    timedOut,
    seconds,
  })
  if (!runsInCi) fs.rmSync(home, { recursive: true, force: true })
  return { file, ...state }
}

const git = (root, args, encoding = "utf8") =>
  execFileSync("git", ["-C", root, ...args], { encoding, maxBuffer: largeOutput, stdio: ["ignore", "pipe", "pipe"] })

const tree = (root, commit) =>
  new Map(
    git(root, ["ls-tree", "-r", "-z", commit])
      .split("\0")
      .filter((row) => row !== "")
      .map((row) => {
        const [entry, file] = row.split("\t")
        const [mode, , print] = entry.split(" ")
        return [file, `${mode} ${print}`]
      }),
  )

const mergeCommit = (headRoot, baseCommit) => {
  try {
    return git(headRoot, ["merge-base", "HEAD", baseCommit]).trim()
  } catch {
    throw new Error("The pull request checkout has no history back to main, so check-regression cannot judge it.")
  }
}

export const readLosses = (root, merge, head = "HEAD", mergeTree = tree(root, merge), headTree = tree(root, head)) => {
  const changed = changedProofs(mergeTree, headTree)
  if (changed.length === 0) return []
  const numstat = git(root, ["diff", "--numstat", "--no-renames", "-z", merge, head, "--", ...changed])
  return proofLosses(changed, lostLines(numstat))
}

const read = (baseRoot, headRoot) => {
  const baseCommit = git(baseRoot, ["rev-parse", "HEAD"]).trim()
  const merge = mergeCommit(headRoot, baseCommit)
  const mergeTree = tree(headRoot, merge)
  const headTree = tree(headRoot, "HEAD")
  return {
    proofs: proofFiles([...tree(baseRoot, "HEAD").keys()]),
    changes: checkChanges(mergeTree, headTree),
    unproved: unprovedLines(mergeTree, headTree),
    losses: readLosses(headRoot, merge, "HEAD", mergeTree, headTree),
    behind: merge !== baseCommit,
  }
}

const openToSandbox = (baseRoot) => {
  for (let folder = path.dirname(baseRoot); folder !== path.dirname(folder); folder = path.dirname(folder)) {
    if ((fs.statSync(folder).mode & 0o001) === 0) execFileSync("sudo", ["-n", "chmod", "o+x", folder])
  }
  const home = scratchHome(true)
  const env = proofEnv({ home, nodeFolder: path.dirname(process.execPath) })
  const [program, ...args] = withLoopback(
    sandboxed({ env, command: [process.execPath, "-e", sandboxProbe], runsInCi: true }),
  )
  const probe = spawnSync(program, args, { cwd: baseRoot, encoding: "utf8", timeout: 60000 })
  const seen = readReportText(probe.stdout)
  if (probe.status !== 0 || seen?.user !== unprivileged || seen.locked !== true || seen.offline !== true) {
    const said = `${probe.stdout ?? ""}${probe.stderr ?? ""}${probe.error?.message ?? ""}`.trim().slice(0, 600)
    throw new Error(`The sandbox did not start, so no old proof could run: ${said}`)
  }
}

const readReportText = (text) => {
  try {
    return JSON.parse(String(text).trim().split("\n").at(-1))
  } catch {
    return undefined
  }
}

const judge = ({ proofs, changes, unproved, losses, behind }, approved, { baseRoot, headRoot, local = false }) => {
  for (const line of unproved) console.log(line)
  if (changes.length === 0 || proofs.length === 0) {
    const result = verdict({ results: losses, approved })
    for (const line of result.lines) console.log(line)
    console.log(changes.length === 0 ? "No check changed." : sameProofs)
    return result.pass
  }
  const started = Date.now()
  const runsInCi = Boolean(process.env.CI)
  const install = spawnSync("pnpm", ["install", "--frozen-lockfile", ...(local ? ["--offline"] : [])], {
    cwd: baseRoot,
    encoding: "utf8",
    maxBuffer: largeOutput,
  })
  if (install.status !== 0) {
    console.log(
      `${install.stdout ?? ""}${install.stderr ?? ""}${install.error?.message ?? ""}`.split("\n").slice(-20).join("\n"),
    )
    console.log("The install failed on main, so no old proof could run.")
    if (!local) return false
    console.log("Only the lost lines are judged here. The check on GitHub runs the proofs main has.")
    const result = verdict({ results: losses, approved })
    for (const line of result.lines) console.log(line)
    return result.pass
  }
  layIn(baseRoot, changes, (file, print) => git(headRoot, ["cat-file", "blob", print], "buffer"))
  for (const { file } of changes) console.log(`laid in ${file}`)
  if (runsInCi) openToSandbox(baseRoot)
  const results = [...losses, ...proofs.map((file) => runProof(baseRoot, file, { runsInCi }))]
  const result = verdict({ results, approved, behind })
  for (const line of result.lines) console.log(line)
  console.log(`check-regression took ${Math.round((Date.now() - started) / 1000)} seconds.`)
  return result.pass
}

const judgeLocal = (root) => {
  if (!judgeTree(root)) console.log(localWarning("check-regression", localOwner(root)))
  return true
}

const judgeTree = (root) => {
  const { fork, why } = localFork(root)
  if (why !== undefined) {
    console.log(why)
    return true
  }
  const head = workingTree(root)
  const mergeTree = tree(root, fork)
  const headTree = tree(root, head)
  const found = {
    proofs: localProofs(proofFiles([...mergeTree.keys()]), changedProofs(mergeTree, headTree)),
    changes: checkChanges(mergeTree, headTree),
    unproved: unprovedLines(mergeTree, headTree),
    losses: readLosses(root, fork, head, mergeTree, headTree),
    behind: false,
  }
  if (found.changes.length === 0 || found.proofs.length === 0) return judge(found, false, { headRoot: root })
  const folder = path.join(os.homedir(), ".cache", "airdesign")
  fs.mkdirSync(folder, { recursive: true })
  const baseRoot = fs.mkdtempSync(path.join(folder, "check-regression-"))
  try {
    git(root, ["worktree", "add", "--detach", "--quiet", baseRoot, fork])
    return judge(found, false, { baseRoot, headRoot: root, local: true })
  } finally {
    git(root, ["worktree", "remove", "--force", baseRoot])
  }
}

const approved = (repository, number, sha) => {
  const reviews = execFileSync(
    "gh",
    [
      "api",
      "--paginate",
      `repos/${repository}/pulls/${number}/reviews`,
      "--jq",
      ".[] | {user: .user.login, state: .state, commit: .commit_id} | @json",
    ],
    { encoding: "utf8", maxBuffer: largeOutput },
  )
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line))
  return approvedCommit(repository.split("/")[0], reviews) === sha
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2)
  try {
    if (mode === "approved") console.log(`approved=${approved(...rest)}`)
    else if (mode === "changed") {
      console.log(`changed=${read(path.resolve(rest[0]), path.resolve(rest[1])).changes.length > 0}`)
    } else if (mode === "judge") {
      const [baseRoot, headRoot] = [path.resolve(rest[0]), path.resolve(rest[1])]
      if (!judge(read(baseRoot, headRoot), rest[2] === "--approved=true", { baseRoot, headRoot })) process.exit(1)
    } else if (mode === "local") {
      if (!judgeLocal(path.resolve(rest[0] ?? "."))) process.exit(1)
    } else throw new Error("Use approved, changed, judge or local.")
  } catch (error) {
    console.error(String(error.stderr ?? "").trim() || error.message)
    process.exit(1)
  }
}
