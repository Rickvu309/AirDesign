export const beforeAfterLabel = "needs-before-after"

const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/

export const seen = (file) => {
  if (testFile.test(file)) return false
  if (file.startsWith("apps/web/src/copy/")) return true
  if (file.startsWith("apps/web/src/")) return /\.(?:tsx|css)$/.test(file)
  if (file.startsWith("apps/site/src/")) return /\.(?:tsx|astro|css|html|mdx?)$/.test(file)
  return file.startsWith("packages/render/src/") || file.startsWith("packages/theme/src/")
}

export const beforeAfterSection = (body) => {
  const lines = String(body ?? "").split(/\r?\n/)
  const start = lines.findIndex((line) => /^#{1,6}[ \t]*before[ \t]*\/[ \t]*after\b/i.test(line))
  if (start === -1) return undefined
  const level = lines[start].match(/^#+/)[0].length
  const end = lines.findIndex((line, index) => index > start && new RegExp(`^#{1,${String(level)}}[ \\t]`).test(line))
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n")
}

export const noVisibleChange = (body) =>
  (beforeAfterSection(body) ?? "")
    .split("\n")
    .map((line) =>
      line
        .trim()
        .match(/^No visible change: (.{12,})$/)?.[1]
        .trim(),
    )
    .find((reason) => reason !== undefined)

export const proofImage = (repository) =>
  new RegExp(
    `!\\[[^\\]]*\\]\\(https://github\\.com/${repository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/releases/download/proof(?:-\\d+)?/[^)\\s]+\\.png\\)`,
    "i",
  )

export const hasBeforeAfter = (body, repository) => {
  const text = beforeAfterSection(body)
  if (text === undefined) return false
  if (noVisibleChange(body) !== undefined) return true
  return proofImage(repository).test(text)
}

export const beforeAfterNeed = ({ changedFiles, body, repository }) => {
  const shown = [...new Set(changedFiles.filter(seen))]
  return { shown, needed: shown.length > 0 && !hasBeforeAfter(body, repository), unseen: noVisibleChange(body) }
}

export const beforeAfterLine = ({ shown, needed, unseen }) => {
  if (shown.length === 0) return undefined
  if (!needed && unseen !== undefined) return `Before / after: no visible change, says the body: ${unseen}`
  const named = `${shown.slice(0, 3).join(", ")}${shown.length > 3 ? ` and ${String(shown.length - 3)} more` : ""}`
  return needed
    ? `Needs a Before / after section: this changes what a person sees (${named}). Run verify-airdesign before-after, open the image, publish it, and paste the fragment into the body, or write the one line "No visible change: <why>" under ## Before / after.`
    : `Has a Before / after section for what a person sees (${named}).`
}
