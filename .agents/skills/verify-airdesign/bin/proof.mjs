import { execFileSync, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { openBrowser } from "./browser.mjs"
import { proofFolder, publish } from "./publish.mjs"
import { renderBlocks, themeCss } from "../look/annotate.mjs"
import { calloutCrops, captureSide, composeBlock, driverFor, fullNames, saveFull } from "../look/before-after.mjs"
import { readCallouts } from "../look/callouts.mjs"
import { fragment } from "../look/fragment.mjs"
import { savePng } from "../look/images.mjs"
import { find } from "../look/states.mjs"

const self = fileURLToPath(new URL("./verify-airdesign.mjs", import.meta.url))
const scratchRoot = path.join(os.homedir(), "tmp", "verify-airdesign-scratch")
const valued = ["--base", "--head", "--before-run", "--after-run", "--out", "--pr"]

function read(args) {
  const values = []
  const flags = {}
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index]
    if (!word.startsWith("--")) values.push(word)
    else if (word === "--keep") flags.keep = true
    else if (valued.includes(word) && args[index + 1] !== undefined && !args[index + 1].startsWith("--"))
      flags[word.slice(2)] = args[(index += 1)]
    else throw new Error(`unknown flag or missing value: ${word}`)
  }
  return { values, flags }
}

const gitIn = (root) => (args) =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

function launchAt(repo, build, cleanup, args = []) {
  const child = spawn(process.execPath, [self, "launch", ...(build ? [] : ["--no-build"]), ...args], {
    cwd: repo,
    detached: true,
    env: { ...process.env, VERIFY_AIRDESIGN_REPO: repo },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let said = ""
  let complained = ""
  child.stdout.on("data", (chunk) => (said += chunk))
  child.stderr.on("data", (chunk) => (complained += chunk))
  const done = new Promise((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (status) => {
      try {
        if (status !== 0) throw new Error(complained.trim())
        const run = JSON.parse(said.trim().split("\n").at(-1)).run
        cleanup.runs.push({ run, repo })
        resolve(run)
      } catch (error) {
        reject(new Error(`launch at ${repo} failed: ${String(error.message ?? error)}`))
      }
    })
  })
  cleanup.launching.add({ child, ended: done.catch(() => undefined) })
  return done
}

function stopRun(run, repo) {
  execFileSync(process.execPath, [self, "stop", run], {
    env: { ...process.env, VERIFY_AIRDESIGN_REPO: repo },
    stdio: ["ignore", "ignore", "inherit"],
  })
}

export const carriedFolders = [
  ".agents/skills/verify-airdesign/look",
  ".agents/skills/verify-airdesign/journeys",
  "apps/api/src/testing/aira-streams",
]

const lines = (text) => text.split("\n").filter((line) => line !== "")

export function carried(repo, base, head) {
  const git = gitIn(repo)
  const changed = lines(
    git([
      "diff",
      "--no-renames",
      "--name-status",
      "--diff-filter=AM",
      base,
      ...(head ? [head] : []),
      "--",
      ...carriedFolders,
    ]),
  ).map((line) => {
    const [status, file] = line.split("\t")
    return { file, added: status === "A" }
  })
  const untracked = head
    ? []
    : lines(git(["ls-files", "--others", "--exclude-standard", "--", ...carriedFolders])).map((file) => ({
        file,
        added: true,
      }))
  return [...changed, ...untracked]
    .toSorted((a, b) => a.file.localeCompare(b.file))
    .map(({ file, added }) => ({
      file,
      added,
      bytes: head
        ? execFileSync("git", ["-C", repo, "show", `${head}:${file}`], { maxBuffer: 1 << 28 })
        : readFileSync(path.join(repo, file)),
    }))
}

function treeName(commit, carry) {
  if (carry.length === 0) return `tree-${commit.slice(0, 12)}`
  const hash = createHash("sha256")
  for (const { file, bytes } of carry) hash.update(file).update("\0").update(bytes).update("\0")
  return `tree-${commit.slice(0, 12)}-${hash.digest("hex").slice(0, 10)}`
}

export function baseTree(repo, commit, carry = [], root = scratchRoot) {
  const dir = path.join(root, treeName(commit, carry))
  if (!existsSync(dir)) {
    mkdirSync(root, { recursive: true })
    rmSync(`${dir}.built`, { force: true })
    gitIn(repo)(["worktree", "add", "--detach", "--quiet", dir, commit])
    for (const { file, bytes } of carry) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      writeFileSync(path.join(dir, file), bytes)
    }
  }
  return dir
}

function installIn(dir) {
  if (existsSync(path.join(dir, "node_modules"))) return
  try {
    execFileSync("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1 << 26,
    })
  } catch (error) {
    throw new Error(
      `pnpm install at ${dir} failed: ${String(error.stderr ?? error.message)
        .trim()
        .slice(-600)}`,
    )
  }
}

function treeAt(repo, commit, carry, cleanup, root, install) {
  const dir = baseTree(repo, commit, carry, root)
  const built = `${dir}.built`
  cleanup.trees.push({ dir, built })
  install(dir)
  return { dir, built }
}

export async function stackFor({
  run,
  ref,
  runtime,
  cleanup,
  args,
  carry = [],
  launch = launchAt,
  mark = writeFileSync,
  root = scratchRoot,
  install = installIn,
}) {
  if (run !== undefined) return run
  if (ref === undefined) return launch(runtime.repo, true, cleanup, args)
  const commit = gitIn(runtime.repo)(["rev-parse", "--verify", `${ref}^{commit}`])
  const tree = treeAt(runtime.repo, commit, carry, cleanup, root, install)
  const at = await launch(tree.dir, !existsSync(tree.built), cleanup)
  mark(tree.built, commit)
  return at
}

async function endLaunches(cleanup) {
  const live = [...cleanup.launching].filter(({ child }) => child.pid !== undefined && child.exitCode === null)
  const signalGroups = (signal) => {
    for (const { child } of live) {
      try {
        process.kill(-child.pid, signal)
      } catch {}
    }
  }
  signalGroups("SIGTERM")
  const timer = setTimeout(() => signalGroups("SIGKILL"), 20_000)
  await Promise.all([...cleanup.launching].map(({ ended }) => ended))
  clearTimeout(timer)
}

function cleanUp(cleanup, runtime, stop) {
  const unstopped = cleanup.runs.filter(({ run, repo }) => {
    try {
      stop(run, repo)
      return false
    } catch {
      return true
    }
  })
  const unremoved = cleanup.trees.filter((tree) => {
    try {
      gitIn(runtime.repo)(["worktree", "remove", "--force", tree.dir])
      rmSync(tree.built, { force: true })
      return false
    } catch {
      return true
    }
  })
  if (unstopped.length > 0) throw new Error(`could not stop runs ${unstopped.map(({ run }) => run).join(" ")}`)
  if (unremoved.length > 0) throw new Error(`could not remove scratch trees ${unremoved.map((t) => t.dir).join(" ")}`)
}

export const newCleanup = () => ({ runs: [], trees: [], launching: new Set() })

const interruptions = ["SIGINT", "SIGTERM"]

export async function cleaning({ cleanup, keep, runtime, body, stop = stopRun }) {
  let interrupt
  const interrupted = new Promise((_, reject) => {
    interrupt = (signal) => reject(new Error(`interrupted by ${signal}`))
  })
  for (const signal of interruptions) process.once(signal, interrupt)
  let finished = false
  try {
    const result = await Promise.race([body(), interrupted])
    finished = true
    return result
  } finally {
    for (const signal of interruptions) process.off(signal, interrupt)
    await endLaunches(cleanup)
    if (finished && keep) {
      for (const { run, repo } of cleanup.runs)
        process.stderr.write(
          `kept run ${run}; stop it with VERIFY_AIRDESIGN_REPO=${repo} verify-airdesign stop ${run}\n`,
        )
    } else cleanUp(cleanup, runtime, stop)
  }
}

export const mergeBase = (runtime) => gitIn(runtime.repo)(["merge-base", "HEAD", "origin/main"])

async function sideOf({ key, name, label, missing, run, ref, runtime, cleanup, carry = [] }) {
  const at = await stackFor({ run, ref, runtime, cleanup, carry })
  const state = runtime.readState(at)
  const repo = state.repo ?? runtime.repo
  return {
    key,
    name,
    label,
    missing,
    run: at,
    origin: state.origin,
    repo,
    commit: state.commit,
    carried: carry.map(({ file }) => file),
    driver: await driverFor(repo, carry),
  }
}

function saveCrops(out, state, crops) {
  const folder = path.join(out, "callouts")
  mkdirSync(folder, { recursive: true })
  const byNumber = new Map()
  for (const { number, note, side, png } of crops) {
    const file = path.join(folder, `${state}-${String(number)}-${side}.png`)
    savePng(file, png)
    byNumber.set(number, { ...byNumber.get(number), number, note, [side]: file })
  }
  return [...byNumber.values()]
}

async function shoot({ blocks, sides, runtime, out }) {
  const browser = await openBrowser()
  try {
    const composed = []
    const warnings = []
    const rows = []
    const names = fullNames(blocks)
    for (const [index, block] of blocks.entries()) {
      const shots = await Promise.all(sides.map((side) => captureSide({ browser, side, block, runtime })))
      const last = shots.at(-1)
      if (last.error) throw new Error(`${block.state} was not reached on ${sides.at(-1).label}: ${last.error}`)
      const files = sides.map((side, at) => saveFull(out, names[index], side, shots[at]))
      const callouts = saveCrops(out, names[index], calloutCrops(block, sides, shots))
      rows.push({
        title: block.title,
        before: sides.length > 1 ? files[0] : null,
        beforeOutcome: sides.length > 1 ? shots[0].outcome : null,
        after: files.at(-1),
        callouts,
      })
      const done = composeBlock(block, sides, shots)
      warnings.push(...done.warnings)
      composed.push(done.block)
    }
    const images = await renderBlocks(browser, composed, themeCss(runtime.repo), (index) =>
      path.join(out, `annotated-${String(index + 1)}.png`),
    )
    return { images, rows, warnings }
  } finally {
    await browser.close()
  }
}

function blocksFrom(file) {
  if (file === undefined || !existsSync(file)) throw new Error(`name a callouts file; ${String(file)} does not exist`)
  const { blocks, warnings } = readCallouts(readFileSync(file, "utf8"), file)
  for (const block of blocks) find(block.state)
  return { blocks, warnings }
}

async function beforeAfter(command, values, flags, runtime) {
  const annotate = command === "annotate"
  const [first, second] = values
  const { blocks, warnings } = blocksFrom(annotate ? second : first)
  if (annotate && first === undefined) throw new Error("name the run: verify-airdesign annotate <run> <callouts.json>")
  const out = path.resolve(flags.out ?? runtime.evidenceDir(`${command}-${String(Date.now())}`))
  mkdirSync(out, { recursive: true })
  const cleanup = newCleanup()
  const base = flags.base ?? mergeBase(runtime)
  const carry = annotate || flags["before-run"] !== undefined ? [] : carried(runtime.repo, base, flags.head)
  const labels = { before: flags.base ? `${flags.base}` : "main", after: flags.head ?? "this PR" }
  return cleaning({
    cleanup,
    keep: flags.keep,
    runtime,
    body: async () => {
      const sides = annotate
        ? [
            await sideOf({
              key: "page",
              name: "",
              label: "",
              missing: "not on this page",
              run: first,
              runtime,
              cleanup,
            }),
          ]
        : [
            await sideOf({
              key: "before",
              name: labels.before,
              label: `BEFORE (${labels.before})`,
              missing: `not in ${labels.before}`,
              run: flags["before-run"],
              ref: base,
              runtime,
              cleanup,
              carry,
            }),
            await sideOf({
              key: "after",
              name: labels.after,
              label: `AFTER (${labels.after})`,
              missing: `not in ${labels.after}`,
              run: flags["after-run"],
              ref: flags.head,
              runtime,
              cleanup,
            }),
          ]
      const shot = await shoot({ blocks, sides, runtime, out })
      const relative = (file) => path.relative(out, file)
      const summary = {
        labels,
        images: shot.images.map(relative),
        rows: shot.rows.map((row) => ({
          title: row.title,
          before: row.before && relative(row.before),
          beforeOutcome: row.beforeOutcome,
          after: relative(row.after),
          callouts: row.callouts.map(({ number, note, ...files }) => ({
            number,
            note,
            ...Object.fromEntries(Object.entries(files).map(([side, file]) => [side, relative(file)])),
          })),
        })),
        sides: Object.fromEntries(
          sides.map((side) => [side.key, { run: side.run, commit: side.commit, carried: side.carried }]),
        ),
        warnings: [...warnings, ...shot.warnings],
      }
      writeFileSync(path.join(out, "before-after.json"), `${JSON.stringify(summary, null, 2)}\n`)
      if (!annotate) writeFileSync(path.join(out, "before-after.md"), fragment(summary))
      return {
        command,
        out,
        images: shot.images,
        full: shot.rows.flatMap((row) => [row.before, row.after].filter(Boolean)),
        fragment: annotate ? undefined : path.join(out, "before-after.md"),
        warnings: summary.warnings,
        kept: flags.keep
          ? { runs: cleanup.runs.map(({ run }) => run), trees: cleanup.trees.map((tree) => tree.dir) }
          : undefined,
        next: "Open every annotated image and check each arrow and note before you publish.",
      }
    },
  })
}

function publishCommand(values, flags, runtime) {
  const [dir] = values
  if (dir === undefined || !existsSync(dir))
    throw new Error("name the folder to publish: verify-airdesign publish <dir>")
  const folder = path.resolve(dir)
  const git = gitIn(runtime.repo)
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"])
  const files = readdirSync(folder)
    .filter((name) => name.endsWith(".png"))
    .sort()
    .map((name) => path.join(folder, name))
  const prefix = proofFolder({ pr: flags.pr, branch: branch === "HEAD" ? "" : branch })
  mkdirSync(scratchRoot, { recursive: true })
  const done = publish({ files, prefix, scratch: scratchRoot })
  const summaryFile = path.join(folder, "before-after.json")
  let published
  if (existsSync(summaryFile)) {
    const summary = JSON.parse(readFileSync(summaryFile, "utf8"))
    published = path.join(folder, "before-after.published.md")
    writeFileSync(published, fragment({ ...summary, link: (file) => done.links[path.basename(file)] }))
  }
  return { command: "publish", release: done.release, links: done.links, fragment: published }
}

export async function proofCommand(command, args, runtime) {
  const { values, flags } = read(args)
  if (command === "publish") return publishCommand(values, flags, runtime)
  return beforeAfter(command, values, flags, runtime)
}
