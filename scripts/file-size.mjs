import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { workingTree } from "./checked.mjs"

export const tokenLimit = 5000

export const tokensOf = (bytes) => Math.ceil(bytes / 4)

const written = /\.(?:ts|tsx|mts|js|mjs|cjs|css|astro|md|sh|yml|tla)$/
const drawn = /-art\.[a-z]+$/

export const authored = (file) => written.test(file) && !drawn.test(file)

const testFile = (file) => file.includes(".test.") || file.includes(".spec.")

const split = (file) =>
  testFile(file)
    ? "Put the new test in a new test file beside the code it tests, named after that code. Do not add to this file."
    : "Move one idea out of it into a new file beside it, named after what the new file holds, and import it from there. Leave the rest where it is."

export const specifierBytes = (text) =>
  [...text.matchAll(/\b(?:from|import)\s*\(?\s*(["'])([^"'\n]*)\1/g)].reduce((sum, match) => sum + match[2].length, 0)

export const sizeFault = ({ file, before, after, paths = { before: 0, after: 0 } }) => {
  const grown = after - paths.after - (before - paths.before)
  if (!authored(file) || tokensOf(after) <= tokenLimit || grown <= 0) return undefined
  const added = Math.max(1, tokensOf(after) - tokensOf(before))
  return `${file} is ${tokensOf(after)} tokens, over the limit of ${tokenLimit}, and this change adds ${added}. ${split(file)}`
}

const git = (root, args) =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })

const sizeAt = (root, tree, file) => {
  try {
    return Number(git(root, ["cat-file", "-s", `${tree}:${file}`]).trim())
  } catch {
    return 0
  }
}

const pathsAt = (root, tree, file) => {
  try {
    return specifierBytes(git(root, ["cat-file", "blob", `${tree}:${file}`]))
  } catch {
    return 0
  }
}

export const grownFiles = (root) => {
  let fork
  try {
    fork = git(root, ["merge-base", "HEAD", "origin/main"]).trim()
  } catch {
    return []
  }
  const head = workingTree(root)
  return git(root, ["diff", "--name-only", "-z", "--diff-filter=AM", fork, head])
    .split("\0")
    .filter((file) => file !== "")
    .map((file) => ({ file, before: sizeAt(root, fork, file), after: sizeAt(root, head, file) }))
    .map((grown) =>
      tokensOf(grown.after) > tokenLimit && grown.before > 0
        ? { ...grown, paths: { before: pathsAt(root, fork, grown.file), after: pathsAt(root, head, grown.file) } }
        : grown,
    )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."))
  const faults = grownFiles(root).flatMap((grown) => sizeFault(grown) ?? [])
  for (const fault of faults) console.error(fault)
  if (faults.length > 0) process.exit(1)
}
