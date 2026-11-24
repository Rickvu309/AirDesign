import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export const pinnedMajor = (folder = root) =>
  fs.readFileSync(path.join(folder, ".node-version"), "utf8").trim().split(".")[0]

export const nodeMismatch = (running, pinned) => {
  const major = running.replace(/^v/, "").split(".")[0]
  return major === pinned
    ? undefined
    : `This is Node ${running}, but ci runs Node ${pinned} (.node-version). A test can pass here and fail there. Run it on Node ${pinned}: \`nvm use ${pinned}\`, or put a Node ${pinned} first on PATH.`
}

export const requirePinnedNode = (running = process.version, pinned = pinnedMajor()) => {
  const message = nodeMismatch(running, pinned)
  if (message === undefined) return
  console.error(message)
  process.exit(1)
}
