import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/closed-branch.yml"), "utf8"))
const job = workflow.jobs["closed-branch"]
const [step] = job.steps

same("it runs when a pull request closes and at no other time", workflow.on, {
  pull_request_target: { types: ["closed"] },
})
same("it may write branches and nothing else", workflow.permissions, { contents: "write" })
for (const kept of [
  "github.event.pull_request.merged == false",
  "github.event.pull_request.head.repo.full_name == github.repository",
  "github.event.pull_request.head.ref != 'main'",
  "github.event.pull_request.head.ref != 'green'",
  "!startsWith(github.event.pull_request.head.ref, 'archive/')",
]) {
  same(`it only runs when ${kept}`, job.if.includes(kept), true)
}
same("it stops itself after two minutes", job["timeout-minutes"], 2)
same("it has one step", job.steps.length, 1)
same("the branch name reaches the shell as a value", step.env.BRANCH, "${{ github.event.pull_request.head.ref }}")
same("the pull request number reaches the shell as a value", step.env.NUMBER, "${{ github.event.pull_request.number }}")
same("the command never holds an expression itself", step.run.includes("${{"), false)

const runStep = ({ state, readFails = false }) => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "closed-branch-"))
  const calls = path.join(bin, "calls")
  fs.writeFileSync(path.join(bin, "sleep"), `#!/bin/sh\necho "sleep $*" >> "${calls}"\n`, { mode: 0o755 })
  fs.writeFileSync(
    path.join(bin, "gh"),
    [
      "#!/bin/sh",
      `echo "gh $*" >> "${calls}"`,
      `case "$*" in *"-X DELETE"*) exit 0 ;; esac`,
      readFails ? "exit 1" : `echo "${state}"`,
    ].join("\n"),
    { mode: 0o755 },
  )
  const answer = spawnSync("bash", ["-e", "-c", step.run], {
    encoding: "utf8",
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      GH_TOKEN: "token",
      GITHUB_REPOSITORY: "owner/repo",
      BRANCH: "fix",
      NUMBER: "953",
    },
  })
  const lines = fs.existsSync(calls) ? fs.readFileSync(calls, "utf8").trim().split("\n") : []
  fs.rmSync(bin, { recursive: true, force: true })
  return { status: answer.status, lines }
}

const deleted = (lines) => lines.includes("gh api -X DELETE repos/owner/repo/git/refs/heads/fix")
const waited = (lines) => {
  const wait = lines.findIndex((line) => line.startsWith("sleep "))
  const read = lines.findIndex((line) => line.startsWith("gh api repos/owner/repo/pulls/953"))
  return wait !== -1 && read > wait && Number(lines[wait].split(" ")[1]) >= 30
}

const reopened = runStep({ state: "open" })
same("a pull request reopened for its fresh run keeps its branch (PR 953)", deleted(reopened.lines), false)
same("and the job passes", reopened.status, 0)

const abandoned = runStep({ state: "closed" })
same("a pull request still closed after the wait loses its branch", deleted(abandoned.lines), true)
same("it waits at least 30 seconds and then reads the pull request again", waited(abandoned.lines), true)

const unread = runStep({ readFails: true })
same("a pull request whose state cannot be read keeps its branch", deleted(unread.lines), false)
