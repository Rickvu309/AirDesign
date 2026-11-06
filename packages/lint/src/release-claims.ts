export function releaseClaimHits(source: string): string[] {
  return [/lossless/i,/works in PowerPoint/i,/supported (?:by |in )?(?:Claude|Codex|Cursor|ChatGPT)/i,/href=["'](?:[^"']*\/)?(?:share|present)(?:[/?"'])/i,/quality score: ?\d/i,/>\s*(?:Share|Present)\s*</i,/["']\/(?:share|present)(?:\/|["'])/i,/fake drafting|coming soon/i].filter(pattern=>pattern.test(source)).map(pattern=>`unsupported-release-claim:${pattern.source}`)
}
