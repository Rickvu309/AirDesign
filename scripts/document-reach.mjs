import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

const readers = ["packages/pptx/", "packages/document/"]
const sources = /\.[cm]?[jt]sx?$/
const imports =
  /^(?:\s*(?:import|export)\b[^"'`]*\bfrom|\s*\}\s*from|\s*import|[^"'`]*\b(?:import|require)\s*\()\s*["']@airdesign\/document(?:\/[^"']*)?["']/
const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]

export const documentAdvice =
  "Only packages/pptx reads @airdesign/document, the PowerPoint model. Take slide data from @airdesign/doom (packages/doom/src/index.ts) and UI tokens from @airdesign/theme."

const dependsOnDocument = (text) => {
  const manifest = JSON.parse(text)
  return dependencyFields.some((field) => Object.hasOwn(manifest[field] ?? {}, "@airdesign/document"))
}

export function documentReachFaults(files, read) {
  return files.flatMap((file) => {
    if (readers.some((reader) => file.startsWith(reader))) return []
    if (path.basename(file) === "package.json")
      return dependsOnDocument(read(file)) ? [`${file} depends on @airdesign/document. ${documentAdvice}`] : []
    if (!sources.test(file)) return []
    return read(file)
      .split("\n")
      .flatMap((line, at) =>
        imports.test(line) ? [`${file}:${String(at + 1)} imports @airdesign/document. ${documentAdvice}`] : [],
      )
  })
}

export function repoFiles(root) {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => file !== "" && existsSync(path.join(root, file)))
}
