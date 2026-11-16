import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { openBrowser } from "./browser.mjs"
import { proofFolder, publish } from "./publish.mjs"
import { renderBlocks, themeCss } from "../look/annotate.mjs"
import { captureSide, composeBlock, driverFor, fullNames, saveFull } from "../look/before-after.mjs"
import { readCallouts } from "../look/callouts.mjs"
import { fragment } from "../look/fragment.mjs"
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

function launchAt(repo, build, args = []) {
  try {
    const said = execFileSync(process.execPath, [self, "launch", ...(build ? [] : ["--no-build"]), ...args], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, VERIFY_AIRDESIGN_REPO: repo },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1 << 26,
    })
    return JSON.parse(said.trim().split("\n").at(-1)).run
  } catch (error) {
    throw new Error(`launch at ${repo} failed: ${String(error.stderr ?? error.message).trim()}`)
  }
}

function stopRun(run) {
  execFileSync(process.execPath, [self, "stop", run], { stdio: "ignore" })
}

function treeAt(repo, commit) {
  const dir = path.join(scratchRoot, `tree-${commit.slice(0, 12)}`)
  const built = `${dir}.built`
  if (!existsSync(dir)) {
    mkdirSync(scratchRoot, { recursive: true })
    rmSync(built, { force: true })
    gitIn(repo)(["worktree", "add", "--detach", "--quiet", dir, commit])
  }
  if (!existsSync(path.join(dir, "node_modules"))) {
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
  return { dir, built }
}

export function stackFor({ run, ref, runtime, cleanup, args }) {
  if (run !== undefined) return run
  let at
  if (ref === undefined) at = launchAt(runtime.repo, true, args)
  else {
    const commit = gitIn(runtime.repo)(["rev-parse", "--verify", `${ref}^{commit}`])
    const tree = treeAt(runtime.repo, commit)
    at = launchAt(tree.dir, !existsSync(tree.built))
    writeFileSync(tree.built, commit)
    cleanup.trees.push(tree)
  }
  cleanup.runs.push(at)
  return at
}

export function cleanUp(cleanup, keep, runtime) {
  if (keep) {
    if (cleanup.runs.length > 0)
      process.stderr.write(`kept runs ${cleanup.runs.join(" ")}; stop each with verify-airdesign stop\n`)
    return
  }
  for (const run of cleanup.runs) stopRun(run)
  for (const tree of cleanup.trees) {
    gitIn(runtime.repo)(["worktree", "remove", "--force", tree.dir])
    rmSync(tree.built, { force: true })
  }
}

export const mergeBase = (runtime) => gitIn(runtime.repo)(["merge-base", "HEAD", "origin/main"])

async function sideOf({ key, label, missing, run, ref, runtime, cleanup }) {
  const at = stackFor({ run, ref, runtime, cleanup })
  const state = runtime.readState(at)
  const repo = state.repo ?? runtime.repo
  return {
    key,
    label,
    missing,
    run: at,
    origin: state.origin,
    repo,
    commit: state.commit,
    driver: await driverFor(repo),
  }
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
      rows.push({ title: block.title, before: sides.length > 1 ? files[0] : null, after: files.at(-1) })
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
  const cleanup = { runs: [], trees: [] }
  const base = flags.base ?? mergeBase(runtime)
  const labels = { before: flags.base ? `${flags.base}` : "main", after: flags.head ?? "this PR" }
  try {
    const sides = annotate
      ? [await sideOf({ key: "page", label: "", missing: "not on this page", run: first, runtime, cleanup })]
      : [
          await sideOf({
            key: "before",
            label: `BEFORE (${labels.before})`,
            missing: `not in ${labels.before}`,
            run: flags["before-run"],
            ref: base,
            runtime,
            cleanup,
          }),
          await sideOf({
            key: "after",
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
        after: relative(row.after),
      })),
      sides: Object.fromEntries(sides.map((side) => [side.key, { run: side.run, commit: side.commit }])),
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
      kept: flags.keep ? { runs: cleanup.runs, trees: cleanup.trees.map((tree) => tree.dir) } : undefined,
      next: "Open every annotated image and check each arrow and note before you publish.",
    }
  } finally {
    cleanUp(cleanup, flags.keep, runtime)
  }
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
