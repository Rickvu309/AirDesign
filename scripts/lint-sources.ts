import { studioFoundationHits } from "./lint/studio-foundation.ts"
import {deploymentRuntimeHits} from "./lint/deployment-runtime.ts"
import {releaseRuntimeHits} from "./lint/release-runtime.ts"
import {renderSiteTerms} from "./site-terms.ts"
import {releaseClaimHits,publicAmountHits,type PublicClaim,sandboxDependencyHits,productCaptureHits} from "../packages/lint/src/release-claims.ts"
import {recoverySafetyHits} from "./lint/recovery-safety.ts"
import {formSubmitButtonHits} from "./lint/form-submit-button.ts"
import {imagePipelineSafetyHits} from "./lint/image-pipeline-safety.ts"
import {meteredToolSafetyHits} from "./lint/metered-tool-safety.ts"
import { editorStackingHits } from "./lint/editor-stacking.ts"
import { editorLayoutHits } from "./lint/editor-layout.ts"
import { viewportPanelSizingHits } from "./lint/viewport-panel-sizing.ts"
import { historyQuerySafetyHits } from "./lint/history-query-safety.ts"
import { operationSafetyHits } from "./lint/operation-safety.ts"
import { deckInvariantHits } from "./lint/deck-invariants.ts"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { nodeRuntimeSyntaxHits } from "./lint/node-runtime-syntax.ts"
import { commentHits } from "./lint/comment-rule.ts"
import { importBoundaryHits } from "./lint/import-boundary.ts"
import { accessSafetyHits } from "./lint/access-safety.ts"
import { gateRecordingHits } from "./lint/gate-recording.ts"
import { responseHeaderHits } from "./lint/response-headers.ts"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".txt", ".json"])
const skipped = new Set(["node_modules", "dist", "coverage", "docs", "fixtures"])

const files = await collect(repoRoot)
const failures: string[] = []
const claims:PublicClaim[]=JSON.parse(renderSiteTerms(await readFile(path.join(repoRoot,"apps/site/content/claims.json"),"utf8"))).claims
for (const file of files) {
  const source = await readFile(file, "utf8")
  for (const hit of studioFoundationHits(file, source)) failures.push(`${file}:${hit.line} ${hit.reason}`)
  for (const hit of deploymentRuntimeHits(file,source)) failures.push(`${file}: ${hit}`)
  for(const hit of releaseRuntimeHits(file,source))failures.push(`${file}: ${hit}`)
  for (const hit of sandboxDependencyHits(file,source)) failures.push(`${file}: ${hit}`)
  for (const hit of productCaptureHits(file,source)) failures.push(`${file}: ${hit}`)
  if (file.includes("/apps/site/") && /\.(html|txt)$/.test(file)) for (const hit of [...publicAmountHits(source),...releaseClaimHits(renderSiteTerms(source),claims)]) failures.push(`${file}: ${hit}`)
  if (!/\.(?:ts|tsx|js|mjs|css)$/.test(file)) continue
  for(const hit of recoverySafetyHits(file,source))failures.push(`${path.relative(repoRoot,file)}:${hit.line} ${hit.reason}`)
  for(const hit of formSubmitButtonHits(file,source))failures.push(`${path.relative(repoRoot,file)}:${hit.line} ${hit.reason}`)
  for(const hit of meteredToolSafetyHits(file,source))failures.push(`${path.relative(repoRoot,file)}:${hit.line} ${hit.reason}`)
  for (const hit of historyQuerySafetyHits(file, source)) failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  for (const hit of operationSafetyHits(file, source)) failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  for (const hit of deckInvariantHits(file, source)) failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  for (const hit of commentHits(file, source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} comment`)
  }
  for (const hit of editorStackingHits(file, source)) failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  for (const hit of editorLayoutHits(file, source)) failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  for (const hit of imagePipelineSafetyHits(file,source)) failures.push(`${path.relative(repoRoot,file)}:${hit.line} ${hit.reason}`)
  for (const hit of viewportPanelSizingHits(file, source)) failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  if (file.endsWith(".css")) {
    continue
  }
  for (const hit of importBoundaryHits(file, source, repoRoot)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason} ${hit.specifier}`)
  }
  for (const hit of nodeRuntimeSyntaxHits(file, source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  }
  for (const hit of responseHeaderHits(source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  }
  for (const hit of accessSafetyHits(file, source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  }
  for (const hit of gateRecordingHits(file, source)) {
    failures.push(`${path.relative(repoRoot, file)}:${hit.line} ${hit.reason}`)
  }
}
if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`)
  process.exit(1)
}

async function collect(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (skipped.has(entry.name) || entry.name.startsWith(".")) {
      continue
    }
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collect(full))
      continue
    }
    if (sourceExtensions.has(path.extname(entry.name)) || entry.name === "Dockerfile" || entry.name === "entrypoint.sh") {
      files.push(full)
    }
  }
  return files
}
