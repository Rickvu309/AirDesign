import { skills } from "@airdesign/skills"
import { type Skill, SkillsExtension, type SkillSource } from "@modelcontextprotocol/server/ext/skills"

type Catalog = {
  readonly skills: ReadonlyMap<string, Skill>
  readonly files: ReadonlyMap<string, { readonly text: string; readonly mimeType: string }>
}

const mimeTypes: Readonly<Record<string, string>> = { md: "text/markdown", json: "application/json" }

const canonical = (uri: string): string => (URL.canParse(uri) ? new URL(uri).href : uri)

function built(): Catalog {
  const catalog = { skills: new Map<string, Skill>(), files: new Map<string, { text: string; mimeType: string }>() }
  for (const guide of skills()) {
    const uriOf = (path: string) => new URL(`skill://${guide.name}/${path}`).href
    const uri = uriOf("SKILL.md")
    catalog.skills.set(uri, {
      uri,
      frontmatter: { name: guide.name.slice(guide.name.lastIndexOf("/") + 1), description: guide.description },
      resources: guide.files.map((file) => ({ uri: uriOf(file.path), digest: file.digest, size: file.size })),
    })
    for (const file of guide.files) {
      const mimeType = mimeTypes[file.path.slice(file.path.lastIndexOf(".") + 1)] ?? "text/plain"
      catalog.files.set(uriOf(file.path), { text: new TextDecoder().decode(file.bytes), mimeType })
    }
  }
  return catalog
}

let cached: Catalog | undefined
const catalog = () => (cached ??= built())

const source: SkillSource = {
  list: async () => ({ skills: [...catalog().skills.values()] }),
  get: async (uri) => catalog().skills.get(canonical(uri)),
  read: async (uri) => catalog().files.get(canonical(uri)),
}

export const guides = new SkillsExtension({ source, cacheHint: { ttlMs: 300_000, cacheScope: "public" } })
