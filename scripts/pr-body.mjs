import fs from "node:fs"
import { beforeAfterNeed, noVisibleChange, proofImage, seen } from "./before-after.mjs"
import { changedOnBranch } from "./land-git.mjs"

const templateFile = new URL("../.github/pull_request_template.md", import.meta.url)

export const templateSentences = (template = fs.readFileSync(templateFile, "utf8")) =>
  template
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))

const withoutCode = (line) => line.replace(/`[^`]*`/g, "``")

const localPath = /(?:^|[\s`'"(<[=:])((?:\/home\/[\w.-]+|~\/tmp|\/tmp|file:\/\/)\/[^\s`'")\]]*[^\s`'")<>\].,;:])/
const placeholderWord =
  /\b(?:TODO|TBD|FIXME)\b|^[-*>\s]*[[{<$]*([A-Z]{3,}_[A-Z_]{3,})[\]}>]*$|[{<]\s*([A-Z]{3,}_[A-Z_]{3,})\s*[}>]/
const namedCommit = /(?:`([0-9a-f]{7,40})`|\b(?:at|on|head|commit)\s+([0-9a-f]{7,40})\b)/gi

const linesOf = (body) => {
  let fenced = false
  return String(body ?? "")
    .split(/\r?\n/)
    .map((text, at) => {
      const fence = /^\s*(?:```|~~~)/.test(text)
      const inside = fenced || fence
      if (fence) fenced = !fenced
      return { number: at + 1, text, code: inside }
    })
}

const pathFault = ({ number, text }) => {
  const found = text.match(localPath)
  if (found === null || /[<*…]/.test(found[1])) return undefined
  return `line ${number} names a local path (${found[1]}). A reader cannot open it. Publish an image with verify-airdesign publish and link its proof release URL, or say what the run showed without the path.`
}

const placeholderFault = ({ number, text, code }, sentences) => {
  if (code) return undefined
  if (sentences.includes(text.trim()))
    return `line ${number} still holds the template's sentence "${text.trim()}". Write what it asks for, or delete the line.`
  const found = withoutCode(text).trim().match(placeholderWord)
  if (found === null) return undefined
  return `line ${number} still holds the placeholder ${found[1] ?? found[2] ?? found[0]}. Replace it with what it stands for, or delete the line.`
}

const commitFaults = ({ number, text }, offBranch) =>
  [...text.matchAll(namedCommit)]
    .map((found) => found[1] ?? found[2])
    .filter((sha) => /[a-f]/i.test(sha) && /\d/.test(sha))
    .filter((sha) => offBranch(sha.toLowerCase()))
    .map(
      (sha) =>
        `line ${number} names commit ${sha}, which is on neither this branch nor main, so it is an old head or another branch. Measure again at the head, or drop the claim. To compare with an old head on purpose, call it that without its hash.`,
    )

export const bodyFaults = (body, { offBranch = () => false, changedFiles = [], repository }) => {
  const sentences = templateSentences()
  const lines = linesOf(body)
  const faults = lines.flatMap((line) =>
    [pathFault(line), placeholderFault(line, sentences), ...commitFaults(line, offBranch)].filter(
      (fault) => fault !== undefined,
    ),
  )
  const shown = beforeAfterNeed({ changedFiles, body: String(body ?? ""), repository })
  if (!shown.needed) return faults
  const named = `${shown.shown.slice(0, 3).join(", ")}${shown.shown.length > 3 ? ` and ${String(shown.shown.length - 3)} more` : ""}`
  return [
    ...faults,
    `this changes what a person sees (${named}), and the body has no ## Before / after with a proof release image. Add the image from verify-airdesign before-after and publish, or the one line "No visible change: <why>" under ## Before / after.`,
  ]
}

export const leadLimit = 25

const outsideDetails = (lines) => {
  let folded = false
  return lines.filter((line) => {
    if (/^<details\b/i.test(line)) folded = true
    const inside = folded
    if (/<\/details>\s*$/i.test(line)) folded = false
    return !inside && line !== ""
  })
}

export const leadFaults = (body, { changedFiles = [], repository }) => {
  const lines = String(body ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
  const first = lines.find((line) => line !== "") ?? ""
  const tree =
    first.startsWith("![") && proofImage(repository).test(first) && lines.some((line) => line.startsWith("**Result.**"))
  const plain = first.startsWith("**Now:**") && lines.some((line) => line.startsWith("**Proof:**"))
  const shown = noVisibleChange(body) === undefined ? [...new Set(changedFiles.filter(seen))] : []
  const named = `${shown.slice(0, 3).join(", ")}${shown.length > 3 ? ` and ${String(shown.length - 3)} more` : ""}`
  const open = outsideDetails(lines).length
  return [
    ...(tree || plain
      ? []
      : [
          "the body opens with neither lead. Open it with the tree picture from show-airdesign, published with verify-airdesign publish, and the tree's Markdown in a details block. For a change no person sees, open it with a **Now:** line and a **Proof:** line.",
        ]),
    ...(plain && shown.length > 0
      ? [
          `this changes what a person sees (${named}), so the body opens with the tree picture from show-airdesign and the tree's Markdown in a details block, not with the **Now:** line.`,
        ]
      : []),
    ...(open > leadLimit
      ? [
          `the body has ${String(open)} lines outside its details block, over the limit of ${String(leadLimit)}. Cut it, or move the detail into the details block.`,
        ]
      : []),
  ]
}

const succeeded = (git, command) => git(command).status === 0

export const localOffBranch = (git) => (sha) =>
  succeeded(git, ["cat-file", "-e", `${sha}^{commit}`]) &&
  !succeeded(git, ["merge-base", "--is-ancestor", sha, "HEAD"]) &&
  !succeeded(git, ["merge-base", "--is-ancestor", sha, "origin/main"])

const contains = (status) => status === "ahead" || status === "identical"

export const githubOffBranch = (compare) => (sha) => {
  const head = compare(sha, "head")
  return head !== undefined && !contains(head) && !contains(compare(sha, "base"))
}

export const branchBodyFaults = ({ body, git, repository }) =>
  bodyFaults(body, { offBranch: localOffBranch(git), changedFiles: changedOnBranch(git), repository })
