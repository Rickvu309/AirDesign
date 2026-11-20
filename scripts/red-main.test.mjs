import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repository = "Rickvu309/AirDesign"

const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), "red-main-"))
fs.writeFileSync(
  path.join(fakeBin, "gh"),
  '#!/bin/bash\necho "gh $*" >> "$LOG"\nif [ "$1 $2" = "issue list" ]; then echo "$OPEN"; else cat >> "$LOG"; fi\n',
  { mode: 0o755 },
)
const redMainSays = (body, { open = true, existingOnly = false } = {}) => {
  const log = path.join(fakeBin, `log-${body.length}`)
  const run = spawnSync("bash", [path.join(root, "scripts/red-main.sh")], {
    encoding: "utf8",
    input: "",
    env: {
      PATH: `${fakeBin}:${process.env.PATH}`,
      LOG: log,
      OPEN: open ? "575" : "",
      RED_EXISTING_ONLY: existingOnly ? "1" : "",
      GITHUB_SHA: "abcdef1234",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: repository,
      GITHUB_RUN_ID: "9",
      RED_BODY: body,
    },
  })
  const actions = fs.readFileSync(log, "utf8").split("\n").slice(1).join("\n")
  return existingOnly && !open ? `${run.stdout.trim()}${actions}` : actions
}
same(
  "red-main.sh still says which run failed when given no body",
  redMainSays(""),
  `gh issue comment 575 --repo ${repository} --body-file -\nci failed on main at abcdef1. https://github.com/${repository}/actions/runs/9`,
)
same(
  "red-main.sh comments the bot's text as written",
  redMainSays("the bot opened pull 1200 for $HOME"),
  `gh issue comment 575 --repo ${repository} --body-file -\nthe bot opened pull 1200 for $HOME`,
)

same(
  "a drill reports an absent open issue in the log without opening one",
  redMainSays("drill outcome", { open: false, existingOnly: true }),
  "No open main is red issue. The drill result is recorded in the workflow log.",
)
fs.rmSync(fakeBin, { recursive: true, force: true })
