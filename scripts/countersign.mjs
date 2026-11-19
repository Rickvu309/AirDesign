import { execFileSync, spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const agentLine = "🤖 **AI Agent responding on behalf of Quan Vu**"
const trusted = new Set(["OWNER", "MEMBER", "COLLABORATOR"])
const signLine = /^countersign ([0-9a-f]{40}) (right|wrong): (\S.*)$/gm
const verdicts = new Set(["right", "wrong"])

export const countersignBody = ({ head, verdict, reason }) =>
  `${agentLine}\n\ncountersign ${head} ${verdict}: ${reason}\n`

export const countersignFor = (comments, head) =>
  comments
    .filter((comment) => trusted.has(comment.association))
    .flatMap((comment) => [...String(comment.body).matchAll(signLine)])
    .filter((match) => match[1] === head)
    .map((match) => ({ verdict: match[2], reason: match[3].trim() }))
    .at(-1)

export const barSigned = ({ lowers, head, countersign }) => {
  if (!lowers) return { pass: true }
  if (countersign?.verdict === "right") return { pass: true, line: `Countersigned ${head}: ${countersign.reason}` }
  if (countersign?.verdict === "wrong") {
    return { pass: false, line: `Countersign refused for ${head}: ${countersign.reason}` }
  }
  return {
    pass: false,
    line: `Needs a countersign: this pull request lowers the bar, and no agent that did not write it has countersigned ${head}. pnpm land prints how to start one.`,
  }
}

export const postFault = ({ head, current, verdict, reason }) => {
  if (head !== current) return `the head of the pull request is ${current}, not ${head}. Judge the new head.`
  if (!verdicts.has(verdict)) return "the verdict is right or wrong."
  if (typeof reason !== "string" || reason.trim() === "" || reason.includes("\n"))
    return "the reason is one line of text."
  return undefined
}

export const verifierSteps = (number) => [
  `start a verifier that did not write pull request ${number}, with delegate_task or a fresh agent, and give it only this brief:`,
  `  Countersign pull request ${number}. Run node scripts/countersign.mjs ${number} for the bar's list and the head. Read the diff with gh pr diff ${number} and judge the diff and its effects. Do not read the pull request's body or comments. Then run node scripts/countersign.mjs ${number} <head> right "<one line: why lowering the bar here is right>", or the same with wrong "<one line: what is wrong>".`,
  "that command posts the comment countersign <head> right: <reason>, and a new push makes it stale",
  "the comment starts the bar check again; auto-merge queues the pull request once it passes. Follow it with pnpm land --watch",
]

export const commentsArgs = (repository, number) => [
  "--paginate",
  `repos/${repository}/issues/${number}/comments`,
  "--jq",
  ".[] | {body, association: .author_association} | @json",
]

export const commentsFrom = (lines) =>
  lines
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line))

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const gh = (args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim()
  const [number, head, verdict, reason] = process.argv.slice(2)
  if (!/^\d+$/.test(number ?? "")) {
    console.error('usage: node scripts/countersign.mjs <pr> [<head> right|wrong "<one-line reason>"]')
    process.exit(1)
  }
  const repository = gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])
  const current = gh(["api", `repos/${repository}/pulls/${number}`, "--jq", ".head.sha"])
  if (head === undefined) {
    console.log(`head ${current}`)
    const bar = spawnSync(process.execPath, [path.join(path.dirname(self), "bar.mjs"), repository, number], {
      encoding: "utf8",
    })
    process.stdout.write(bar.stdout)
    process.stderr.write(bar.stderr)
    console.log(`diff: gh pr diff ${number}`)
  } else {
    const fault = postFault({ head, current, verdict, reason })
    if (fault !== undefined) {
      console.error(`not posted: ${fault}`)
      process.exit(1)
    }
    gh([
      "api",
      `repos/${repository}/issues/${number}/comments`,
      "-f",
      `body=${countersignBody({ head, verdict, reason })}`,
    ])
    console.log(`posted: countersign ${head} ${verdict}: ${reason}`)
  }
}
