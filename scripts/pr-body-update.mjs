import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { beforeAfterNeed } from "./before-after.mjs"
import { pullBodyFaults, readPullHead, readPullMeta } from "./bar.mjs"
import { attributionLine } from "./commit-authors.mjs"
import { ghApi, readWithRetry } from "./github-read.mjs"

export const usage = "usage: pnpm pr-body <pull request number> <body file>"

export const updateBody = ({ api, repository, number, body }) => {
  const { pull, listed } = readPullHead(repository, number, api)
  const changedFiles = listed.map((file) => file.name)
  const attribution = attributionLine(body)
  const faults = [
    ...(attribution === undefined ? [] : [`the body has the attribution line "${attribution}". Delete that line.`]),
    ...pullBodyFaults({ api, repository, pull, changedFiles, body }),
  ]
  if (faults.length > 0) return { ok: false, lines: faults.map((fault) => `Body: ${fault}`) }
  const moved = (now) => now.head !== pull.head || now.base !== pull.base
  const before = readPullMeta(repository, number, api)
  if (moved(before)) {
    return {
      ok: false,
      lines: [
        `Body: pull request ${number} moved from head ${pull.head.slice(0, 8)} to ${before.head.slice(0, 8)} while the body was judged. Nothing was written. Run pnpm pr-body ${number} <file> again.`,
      ],
    }
  }
  api(["-X", "PATCH", `repos/${repository}/pulls/${number}`, "-f", `body=${body}`])
  const after = readPullMeta(repository, number, api)
  if (moved(after)) {
    return {
      ok: false,
      lines: [
        `Body: pull request ${number} moved from head ${pull.head.slice(0, 8)} to ${after.head.slice(0, 8)} as the body was written, so the body was not judged against the head it sits on. Run pnpm pr-body ${number} <file> again.`,
      ],
    }
  }
  const shown = beforeAfterNeed({ changedFiles, body, repository })
  return {
    ok: true,
    lines: [
      `Body of pull request ${number} set, judged against its head ${pull.head.slice(0, 8)} and its ${changedFiles.length} changed files.`,
      "A new body starts the bar check again and cancels a bar run in progress; the new run judges it.",
      ...(shown.unseen === undefined ? [] : [`Before / after: no visible change, says the body: ${shown.unseen}`]),
    ],
  }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const [number, file] = process.argv.slice(2)
  if (!/^\d+$/.test(number ?? "") || file === undefined) {
    console.error(usage)
    process.exit(1)
  }
  try {
    const repository = execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], {
      encoding: "utf8",
    }).trim()
    const result = updateBody({
      api: readWithRetry({ run: ghApi }),
      repository,
      number,
      body: fs.readFileSync(file, "utf8"),
    })
    for (const line of result.lines) console.log(line)
    process.exit(result.ok ? 0 : 1)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
