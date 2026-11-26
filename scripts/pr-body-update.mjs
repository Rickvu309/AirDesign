import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { beforeAfterNeed } from "./before-after.mjs"
import { pullBodyFaults, readPullHead, readPullMeta } from "./bar.mjs"
import { attributionLine } from "./commit-authors.mjs"
import { ghApi, readWithRetry } from "./github-read.mjs"
import { leadFaults } from "./pr-body.mjs"

export const usage = "usage: pnpm pr-body <pull request number> <body file>"

export const updateBody = ({ api, repository, number, body }) => {
  const read = readWithRetry({ run: api })
  const { pull, listed } = readPullHead(repository, number, read)
  const changedFiles = listed.map((file) => file.name)
  const attribution = attributionLine(body)
  const faults = [
    ...(attribution === undefined ? [] : [`the body has the attribution line "${attribution}". Delete that line.`]),
    ...pullBodyFaults({ api: read, repository, pull, changedFiles, body }),
    ...leadFaults(body, { changedFiles, repository }),
  ]
  if (faults.length > 0) return { ok: false, lines: faults.map((fault) => `Body: ${fault}`) }
  const movement = (now) =>
    [
      ...(now.head === pull.head ? [] : [`from head ${pull.head.slice(0, 8)} to ${now.head.slice(0, 8)}`]),
      ...(now.base === pull.base && now.baseRef === pull.baseRef
        ? []
        : [`from base ${pull.baseRef}@${pull.base.slice(0, 8)} to ${now.baseRef}@${now.base.slice(0, 8)}`]),
    ].join(" and ")
  const retry = `Run pnpm pr-body ${number} <file> again.`
  const refuse = (reason) => ({ ok: false, lines: [`Body: ${reason} ${retry}`] })
  const before = movement(readPullMeta(repository, number, read))
  if (before) {
    return refuse(`pull request ${number} moved ${before} while the body was judged. Nothing was written.`)
  }
  let failure
  try {
    api(["-X", "PATCH", `repos/${repository}/pulls/${number}`, "-f", `body=${body}`])
  } catch (error) {
    failure = `GitHub did not confirm the write (${String(error.stderr || error.message).trim()}).`
  }
  const after = movement(readPullMeta(repository, number, read))
  if (failure) {
    return refuse(after ? `pull request ${number} moved ${after} during the write. ${failure}` : failure)
  }
  if (after) {
    return refuse(
      `pull request ${number} moved ${after} as the body was written. Judge the body against the new pull request state.`,
    )
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
      api: ghApi,
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
