import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const limitsFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../packages/document/src/limits.ts",
)

export const readLimits = (source) => {
  const body = /export const limits = \{([^}]*)\}/.exec(source)?.[1] ?? ""
  return Object.fromEntries(
    [...body.matchAll(/(\w+):\s*([\d_]+)\s*,/g)].map((match) => [match[1], Number(match[2].replaceAll("_", ""))]),
  )
}

export const limitValues = readLimits(fs.readFileSync(limitsFile, "utf8"))

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const copyFile = (filename) =>
  !/\.(test|spec|proof)\.[cm]?[jt]sx?$/.test(filename) &&
  (filename.includes("/copy/") || /-copy\.[cm]?[jt]sx?$/.test(filename))

const scales = { "": 1, KB: 1_000, MB: 1_000_000 }

const namesFor = (value) =>
  Object.entries(limitValues)
    .filter(([, limit]) => limit === value)
    .map(([name]) => `limits.${name}`)

const findings = (text) =>
  [...text.matchAll(/(?<![\w$.:])(\d{1,3}(?:,\d{3})+|\d+(?:_\d+)*)(?:\s?(KB|MB))?(?![\w%:°]|\.\d)/g)].flatMap(
    (match) => {
      const value = Number(match[1].replaceAll(/[,_]/g, "")) * scales[match[2] ?? ""]
      const names = namesFor(value)
      return names.length > 0 ? [{ written: match[0], names }] : []
    },
  )

const messageFor = ({ written, names }) =>
  `${written} is ${names.join(" or ")} in @airdesign/document. Import limits from @airdesign/document and interpolate it, so the words change when the limit does.`

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject a limit from @airdesign/document written as a number in product copy.",
    },
  },
  create(context) {
    if (!copyFile(filenameOf(context))) return {}
    const check = (node, text) => {
      for (const finding of findings(text)) context.report({ node, message: messageFor(finding) })
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw)
      },
    }
  },
}

export default rule
