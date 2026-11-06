export function releaseClaimHits(source: string): string[] {
  return [/lossless/i,/works in PowerPoint/i,/supported (?:by |in )?(?:Claude|Codex|Cursor|ChatGPT)/i,/href=["'](?:[^"']*\/)?(?:share|present)(?:[/?"'])/i,/quality score: ?\d/i,/>\s*(?:Share|Present)\s*</i,/["']\/(?:share|present)(?:\/|["'])/i,/fake drafting|coming soon/i].filter(pattern=>pattern.test(source)).map(pattern=>`unsupported-release-claim:${pattern.source}`)
}

export function sandboxDependencyHits(file: string, source: string): string[] {
  if (!file.replaceAll("\\", "/").includes("bench/release/")) return []
  return /symlink\s*\([^\n;]*["']node_modules["']/.test(source)
    ? ["sandbox-dependencies-outside-root: copy dependencies inside the archived sandbox root"]
    : []
}

export function productCaptureHits(file: string, source: string): string[] {
  if (!file.replaceAll("\\", "/").endsWith("bench/release/product-review.mjs")) return []
  const before = source.indexOf("review/studio-before.png")
  return before >= 0 && !source.slice(0, before).includes('textContent.includes("Saved")')
    ? ["product-capture-before-ready: wait for the saved deck before capturing its initial state"]
    : []
}
