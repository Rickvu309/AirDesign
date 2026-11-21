import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { readKeyed, writeKeyed } from "./keyed-cache.mjs"
import { validatorList } from "./pptx-corpus.mjs"

export const validationFolder = path.join(os.homedir(), ".cache", "airdesign", "pptx-validations")
export const judgeProject = "scripts/pptx-judge"
export const judgeProgram = path.join(judgeProject, "bin/Release/net8.0/PptxJudge.dll")
export const judgeBuild = ["build", judgeProject, "-c", "Release", "-v", "q", "--nologo"]

const sha256 = (value) => createHash("sha256").update(value).digest("hex")

export const validatorCode = (root) =>
  sha256(
    ["Program.cs", "PptxJudge.csproj"]
      .map((name) => sha256(fs.readFileSync(path.join(root, judgeProject, name))))
      .join(),
  )

export const validationKey = ({ bytes, code }) => sha256(JSON.stringify({ file: sha256(bytes), code }))

const validRow = (row) =>
  row !== null &&
  typeof row === "object" &&
  typeof row.opened === "string" &&
  Array.isArray(row.list) &&
  row.list.every((line) => typeof line === "string")

export const shareOut = ({ items, width }) => {
  const groups = Array.from({ length: Math.max(1, Math.min(width, items.length)) }, () => ({ size: 0, items: [] }))
  for (const item of [...items].sort((left, right) => right.size - left.size)) {
    const lightest = groups.reduce((best, group) => (group.size < best.size ? group : best))
    lightest.size += item.size
    lightest.items.push(item)
  }
  return groups.filter((group) => group.items.length > 0).map((group) => group.items)
}

export const validatorLists = async ({
  files,
  code,
  folder = validationFolder,
  width = Math.min(os.availableParallelism(), 4),
  validate,
  tally = { files: 0, distinct: 0, hits: 0 },
}) => {
  const distinct = new Map()
  const names = new Map()
  for (const file of files) {
    const bytes = fs.readFileSync(file)
    const key = validationKey({ bytes, code })
    const name = path.basename(file)
    if (names.has(name) && names.get(name) !== key) throw new Error(`${name} is two different files.`)
    names.set(name, key)
    if (!distinct.has(key)) distinct.set(key, { key, file, name, size: bytes.length })
  }
  tally.files += names.size
  tally.distinct += distinct.size
  const rows = new Map()
  const missing = []
  for (const item of distinct.values()) {
    const stored = readKeyed(folder, item.key, validRow)
    if (stored === null) missing.push(item)
    else {
      tally.hits += 1
      rows.set(item.key, stored)
    }
  }
  const answers = await Promise.all(
    shareOut({ items: missing, width }).map(async (group) => {
      const found = new Map()
      for (const row of await validate(group.map((item) => item.file))) found.set(row.file, row)
      return { group, found }
    }),
  )
  for (const { group, found } of answers) {
    for (const item of group) {
      const row = found.get(item.name)
      if (row === undefined) throw new Error(`The validator gave no answer for ${item.name}.`)
      const stored = { opened: row.opened, list: row.list }
      writeKeyed(folder, item.key, stored)
      rows.set(item.key, stored)
    }
  }
  return new Map([...names].map(([name, key]) => [name, validatorList(rows.get(key))]))
}

export const judgeRows = (output) =>
  output
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line))

export const validatorLine = (tally) =>
  `validator ${tally.files} files, ${tally.distinct} different, ${tally.hits} answered by the cache, ${tally.distinct - tally.hits} validated`

export const namedLists = (lists, names) =>
  new Map([...lists, ...names.map((name) => [name, lists.get(path.basename(name))])])
