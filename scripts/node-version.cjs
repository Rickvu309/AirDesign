const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")

const pinnedMajor = (folder = root) =>
  fs.readFileSync(path.join(folder, ".node-version"), "utf8").trim().replace(/^v/, "").split(".")[0]

const nodeMismatch = (running, pinned) => {
  const major = running.replace(/^v/, "").split(".")[0]
  return major === pinned
    ? undefined
    : `This is Node ${running}, but ci runs Node ${pinned} (.node-version). A test can pass here and fail there. Run it on Node ${pinned}: \`nvm use ${pinned}\`, or put a Node ${pinned} first on PATH.`
}

const requirePinnedNode = (running = process.version, folder = root) => {
  const message = nodeMismatch(running, pinnedMajor(folder))
  if (message === undefined) return
  console.error(message)
  process.exit(1)
}

module.exports = { pinnedMajor, nodeMismatch, requirePinnedNode }
