import type { Finding } from "./rules.ts"
import { packageRootOf, packOf, type Pack, type Workspace } from "./workspace.ts"

const unitOf = (workspace: Workspace, file: string): string | undefined =>
  packOf(workspace.packs, file)?.name ?? packageRootOf(workspace.packageRoots, file)

export const affected = (workspace: Workspace, changed: readonly string[]): string[] => {
  const users = new Map<string, Set<string>>()
  for (const reference of workspace.references) {
    if (reference.target.kind !== "file") continue
    const from = unitOf(workspace, reference.file)
    const to = unitOf(workspace, reference.target.file)
    if (from === undefined || to === undefined || from === to) continue
    users.set(to, (users.get(to) ?? new Set()).add(from))
  }
  const reached = new Set(
    changed.flatMap((file) => {
      const unit = unitOf(workspace, file)
      return unit === undefined ? [] : [unit]
    }),
  )
  const queue = [...reached]
  while (queue.length > 0) {
    for (const user of users.get(queue.pop() ?? "") ?? []) {
      if (!reached.has(user)) {
        reached.add(user)
        queue.push(user)
      }
    }
  }
  return [...reached].sort()
}

const nodeId = (name: string): string => `p_${name.replace(/[^A-Za-z0-9]/g, "_")}`

const cell = (items: readonly string[]): string => (items.length === 0 ? "none" : items.join(", "))

export const docs = (workspace: Workspace): string => {
  const lines = [
    "# Packs",
    "",
    "`ts-packwerk docs --out` writes this page from every `pack.yml`, and `ts-packwerk docs --check` fails when it is stale.",
    "",
    "```mermaid",
    "flowchart TD",
  ]
  const layers = [...workspace.config.layers, undefined]
  const named = (pack: Pack) => `  ${nodeId(pack.name)}["${pack.name}"]`
  for (const layer of layers) {
    const members = workspace.packs.filter((pack) => pack.layer === layer)
    if (members.length === 0) continue
    if (layer === undefined) lines.push(...members.map(named))
    else
      lines.push(
        `  subgraph ${nodeId(`layer ${layer}`)}["${layer}"]`,
        ...members.map((pack) => `  ${named(pack)}`),
        "  end",
      )
  }
  const names = new Set(workspace.packs.map((pack) => pack.name))
  for (const pack of workspace.packs) {
    for (const dependency of pack.dependencies) {
      if (names.has(dependency)) lines.push(`  ${nodeId(pack.name)} --> ${nodeId(dependency)}`)
    }
  }
  lines.push("```", "", "| Pack | Layer | Public | Dependencies | Tables |", "| --- | --- | --- | --- | --- |")
  for (const pack of workspace.packs) {
    const faces = [...pack.interfaces].map(([face, paths]) =>
      face === "default" ? cell(paths.map((file) => file.slice(pack.name.length + 1))) : `${face}: ${cell(paths)}`,
    )
    lines.push(
      `| \`${pack.name}\` | ${pack.layer ?? "none"} | ${faces.join("; ") || "none"} | ${cell(pack.dependencies)} | ${cell(
        pack.ownsTables,
      )} |`,
    )
  }
  return `${lines.join("\n")}\n`
}

export const sarif = (findings: readonly Finding[]): string =>
  JSON.stringify(
    {
      version: "2.1.0",
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      runs: [
        {
          tool: {
            driver: {
              name: "ts-packwerk",
              rules: [...new Set(findings.map((finding) => finding.rule))].sort().map((id) => ({ id })),
            },
          },
          results: findings.map((finding) => ({
            ruleId: finding.rule,
            level: "error",
            message: { text: finding.message },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: finding.file },
                  region: { startLine: finding.line, startColumn: finding.column },
                },
              },
            ],
          })),
        },
      ],
    },
    null,
    2,
  )

export const starterConfig = `include:
  - "src/**/*.{ts,tsx}"
exclude:
  - "**/*.test.{ts,tsx}"
layers: []
`
