export const unitShards = ["1/2", "2/2"] as const

export const verificationShards = [
  { name: "render-brand", scripts: ["verify:pr-02", "verify:pr-06"], postgres: false, browser: true, libreoffice: false, isolation: true },
  { name: "pptx-agent", scripts: ["verify:pr-03", "verify:pr-08"], postgres: true, browser: false, libreoffice: true, isolation: true },
  { name: "sync", scripts: ["verify:pr-04"], postgres: true, browser: true, libreoffice: false, isolation: false },
  { name: "studio-mcp", scripts: ["verify:pr-05", "verify:pr-07"], postgres: true, browser: true, libreoffice: false, isolation: true },
  { name: "release", scripts: ["verify:pr-01", "verify:pr-09"], postgres: true, browser: true, libreoffice: false, isolation: false },
] as const

export const informationalPaths = new Set(["docs/release/ci.md"])

export function requiresFullGate(paths: string[]): boolean {
  return paths.length === 0 || paths.some(file => !informationalPaths.has(file))
}
