import path from "node:path"
import { fileURLToPath } from "node:url"
import { knowsMain } from "./checked.mjs"
import { commitsIn } from "./commit-authors.mjs"
import { titleAdvice, titleVerdict } from "./title.mjs"

export const commitTitle = (message) => message.trim().split(/\n[ \t]*\n/)[0]

export const titleLines = (commits) =>
  commits.flatMap(({ hash, message }) => {
    const fault = titleVerdict(commitTitle(message))
    return fault === undefined ? [] : [`commit ${hash.slice(0, 8)} title is ${fault}`]
  })

export const titleFix = `${titleAdvice} Reword the last commit with git commit --amend, or an older one with git rebase -i origin/main and reword.`

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const commits = knowsMain(root) ? commitsIn(root, ["origin/main..HEAD"]) : []
  const lines = titleLines(commits)
  if (lines.length > 0) {
    for (const line of [...lines, titleFix]) console.error(line)
    process.exit(1)
  }
  console.log(`commit-titles: ${commits.length} commits since origin/main, every title within the rule`)
}
