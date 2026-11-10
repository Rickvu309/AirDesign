import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { jarPath, javaBin } from "./check-specs.mjs"
import { approvedCommit } from "./owner-gate.mjs"

const checkFolders = ["tooling/", "scripts/"]
const proofSeconds = 300
const proofNeeds = { "scripts/check-specs.test.mjs": ["Java 21", "tla2tools.jar"] }
const needFinders = { "Java 21": javaBin, "tla2tools.jar": jarPath }
const advice =
  "Restore the behaviour each broken case expects. If the check is meant to change, ask the repo owner to approve the pull request."

const inCheckFolder = (file) => checkFolders.some((folder) => file.startsWith(folder))

export const proofRunner = (file) => {
  if (file.startsWith("tooling/") && file.endsWith(".test.js")) return "node"
  if (/^scripts\/[^/]+\.test\.mjs$/.test(file)) return "node"
  if (/^tests\/[^/]+\.test\.ts$/.test(file)) return "vitest"
  return undefined
}

export const proofFiles = (baseFiles) => baseFiles.filter((file) => proofRunner(file) !== undefined).sort()

export const proofSupport = (baseFiles) =>
  baseFiles.filter((file) => inCheckFolder(file) && /(^|\/)harness\.m?js$/.test(file)).sort()

export const changedFiles = (baseTree, headTree) =>
  [...new Set([...baseTree.keys(), ...headTree.keys()])]
    .filter((file) => baseTree.get(file) !== headTree.get(file))
    .sort()

export const checkChanged = (changed, restorable) =>
  changed.some((file) => inCheckFolder(file) || restorable.includes(file))

export const restoreProofs = (baseRoot, headRoot, files) => {
  const head = fs.realpathSync(headRoot)
  const deleted = []
  for (const file of files) {
    const target = path.join(head, file)
    const folder = path.dirname(target)
    fs.mkdirSync(folder, { recursive: true })
    if (fs.realpathSync(folder) !== folder) {
      throw new Error(`${path.dirname(file)} is a link in the pull request, so ${file} cannot be put back.`)
    }
    if (fs.lstatSync(target, { throwIfNoEntry: false }) === undefined) deleted.push(file)
    fs.rmSync(target, { recursive: true, force: true })
    fs.copyFileSync(path.join(baseRoot, file), target)
  }
  return deleted
}

export const missingNeeds = (file, has) => (proofNeeds[file] ?? []).filter((need) => !has(need))

export const firstFailure = ({ status, output, timedOut }) => {
  if (timedOut) return `ran longer than ${proofSeconds} seconds`
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
  const failedCase = lines.find((line) => /^(FAIL|×) .* > /.test(line))
  const thrown = lines.map((line) => /^(?:\w+: )?\w*Error(?: \[\w+\])?: (.+)$/.exec(line)?.[1]).find(Boolean)
  const message = [failedCase, thrown].filter(Boolean).join(": ")
  return (message || lines[0] || `exit ${status}`).slice(0, 300)
}

export const verdict = ({ results, approved }) => {
  const lines = results.map((result) => {
    if (result.state === "kept") return `kept ${result.file}`
    if (result.state === "broken") return `broken ${result.file}: ${result.message}`
    return `not proved here ${result.file}: ${result.message}`
  })
  if (!results.some((result) => result.state === "broken")) return { pass: true, lines }
  if (approved) return { pass: true, lines: [...lines, "The repo owner approved this commit, so it passes as it is."] }
  return { pass: false, lines: [...lines, advice] }
}

export const headEnv = (env) =>
  Object.fromEntries(
    Object.entries({ ...env, NO_COLOR: "1" }).filter(([name]) => !/^(GITHUB_|ACTIONS_|GH_)|TOKEN|SECRET/.test(name)),
  )

const tree = (root) =>
  new Map(
    execFileSync("git", ["ls-files", "-s", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\0")
      .filter((row) => row !== "")
      .map((row) => {
        const [print, file] = row.split("\t")
        return [file, print]
      }),
  )

const has = (need) => {
  try {
    needFinders[need]()
    return true
  } catch {
    return false
  }
}

const runProof = (headRoot, file, env) => {
  const missing = missingNeeds(file, has)
  if (missing.length > 0) return { file, state: "not proved", message: `this machine has no ${missing.join(" or ")}` }
  const [command, args] =
    proofRunner(file) === "vitest"
      ? [path.join(headRoot, "node_modules", ".bin", "vitest"), ["run", file]]
      : [process.execPath, [file]]
  const result = spawnSync(command, args, {
    cwd: headRoot,
    env,
    encoding: "utf8",
    timeout: proofSeconds * 1000,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status === 0) return { file, state: "kept" }
  const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}\n${result.error?.code === "ETIMEDOUT" ? "" : (result.error?.message ?? "")}`
  return {
    file,
    state: "broken",
    message: firstFailure({ status: result.status, output, timedOut: result.error?.code === "ETIMEDOUT" }),
  }
}

const read = (baseRoot, headRoot) => {
  const baseTree = tree(baseRoot)
  const baseFiles = [...baseTree.keys()]
  const proofs = proofFiles(baseFiles)
  const restorable = [...proofs, ...proofSupport(baseFiles)]
  return { proofs, restorable, changed: checkChanged(changedFiles(baseTree, tree(headRoot)), restorable) }
}

const judge = (baseRoot, headRoot, approved) => {
  const { proofs, restorable, changed } = read(baseRoot, headRoot)
  if (!changed) {
    console.log("No check changed.")
    return true
  }
  const started = Date.now()
  for (const file of restoreProofs(baseRoot, headRoot, restorable)) {
    console.log(`Put back ${file}, which the pull request deleted.`)
  }
  const env = headEnv(process.env)
  const install = spawnSync("pnpm", ["install", "--frozen-lockfile"], {
    cwd: headRoot,
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  if (install.status !== 0) {
    console.log(
      `${install.stdout ?? ""}${install.stderr ?? ""}${install.error?.message ?? ""}`.split("\n").slice(-20).join("\n"),
    )
    console.log("The install failed in the pull request, so no old proof could run.")
    return false
  }
  const result = verdict({ results: proofs.map((file) => runProof(headRoot, file, env)), approved })
  for (const line of result.lines) console.log(line)
  console.log(`Old proofs took ${Math.round((Date.now() - started) / 1000)} seconds.`)
  return result.pass
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
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
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
    else if (mode === "changed") console.log(`changed=${read(path.resolve(rest[0]), path.resolve(rest[1])).changed}`)
    else if (mode === "judge") {
      if (!judge(path.resolve(rest[0]), path.resolve(rest[1]), rest[2] === "--approved=true")) process.exit(1)
    } else throw new Error("Use approved, changed or judge.")
  } catch (error) {
    console.error(String(error.stderr ?? "").trim() || error.message)
    process.exit(1)
  }
}
