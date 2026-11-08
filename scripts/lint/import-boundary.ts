import path from "node:path"

export type BoundaryHit = {
  line: number
  specifier: string
  reason: string
}

const specifierPattern = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g

export function importBoundaryHits(filePath: string, source: string, repoRoot: string): BoundaryHit[] {
  const hits: BoundaryHit[] = []
  const relativeFile = path.relative(repoRoot, filePath).split(path.sep).join("/")
  specifierPattern.lastIndex = 0
  let match: RegExpExecArray | null = specifierPattern.exec(source)
  while (match) {
    const specifier = match[1] ?? match[2] ?? ""
    const line = source.slice(0, match.index).split("\n").length
    const reason = boundaryReason(relativeFile, filePath, specifier, repoRoot)
    if (reason) {
      hits.push({ line, specifier, reason })
    }
    match = specifierPattern.exec(source)
  }
  specifierPattern.lastIndex = 0
  return hits
}

function boundaryReason(relativeFile: string, filePath: string, specifier: string, repoRoot: string): string | null {
  const deckLocal = (specifier.startsWith("./") || specifier.startsWith("../")) && path.relative(path.join(repoRoot, "packages/deck/src"), path.resolve(path.dirname(filePath), specifier)).split(path.sep).every(part => part !== "..")
  if (relativeFile.startsWith("packages/deck/src/") && (!deckLocal || /react|jsx-runtime|node:/.test(specifier))) {
    return "deck-must-be-dependency-free"
  }
  const inPackage = relativeFile.startsWith("packages/")
  const inStudio = relativeFile.startsWith("apps/studio/")
  const inServer = relativeFile.startsWith("apps/server/")
  const product = inPackage || relativeFile.startsWith("apps/")
  if (product && (specifier.includes("docs/design") || specifier.includes("/research/") || specifier.includes("design/v0.1/source"))) {
    return "design-tooling"
  }
  if (inPackage && (specifier.startsWith("apps/") || specifier.includes("/apps/"))) {
    return "package-imports-app"
  }
  const resolvedSpecifier = specifier.startsWith(".") ? path.relative(repoRoot,path.resolve(path.dirname(filePath),specifier)).split(path.sep).join("/") : specifier
  if(product && /^(?:apps|packages)\/[^/]+\/src\//.test(relativeFile) && resolvedSpecifier.startsWith("scripts/"))return "runtime-imports-scripts"
  if(product && /^(?:apps|packages)\/[^/]+\/src\//.test(relativeFile) && !/\.test\.[cm]?[jt]sx?$/.test(relativeFile) && /\/operator-smoke(?:\.[cm]?[jt]s)?$/.test(resolvedSpecifier) && relativeFile!=="apps/server/src/smoke/mint-link.ts")return "operator-smoke-outside-cli"
  if (specifier.startsWith(".")) {
    const resolved = path.normalize(path.join(path.dirname(filePath), specifier))
    const relativeResolved = path.relative(repoRoot, resolved).split(path.sep).join("/")
    if (inPackage && (relativeResolved.startsWith("apps/") || relativeResolved.startsWith("docs/"))) {
      return "package-escapes"
    }
    if ((inStudio || inServer) && relativeResolved.startsWith("docs/")) {
      return "app-imports-docs"
    }
  }
  if (relativeFile.startsWith("packages/ui/") && (specifier.startsWith("@airdesign/") || specifier.startsWith("packages/"))) {
    return "ui-imports-package"
  }
  if (relativeFile.startsWith("packages/access/") && (specifier === "@airdesign/ui" || specifier.startsWith("@airdesign/ui/"))) {
    return "access-imports-ui"
  }
  if (relativeFile.startsWith("packages/contract-rules/") && specifier.startsWith("@airdesign/")) {
    return "contract-rules-import"
  }
  if (inStudio && specifier === "@airdesign/access") {
    return "studio-imports-access-server"
  }
  if (inStudio && (specifier.startsWith("@airdesign/server") || specifier.startsWith("apps/server"))) {
    return "studio-imports-server"
  }
  if (inServer && specifier.startsWith("@airdesign/ui")) {
    return "server-imports-ui"
  }
  return null
}
