import { filesDir, fs, nodePath } from "./package-files.js"

type GuideFile = {
  readonly path: string
  readonly bytes: Uint8Array
  readonly digest: string
  readonly size: number
}

export type Guide = {
  readonly name: string
  readonly description: string
  readonly markdown: string
  readonly files: readonly GuideFile[]
}

const manifest = "SKILL.md"
const frontmatterPattern = /^---\nname: ([a-z0-9]+(?:-[a-z0-9]+)*)\ndescription: ("[^\n]*")\n---\n/

function filesUnder(dir: string, prefix = ""): string[] {
  const found: string[] = []
  for (const entry of fs().readdirSync(nodePath().join(dir, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) found.push(...filesUnder(dir, relative))
    else if (entry.isFile()) found.push(relative)
  }
  return found
}

function digestOf(bytes: Uint8Array): string {
  const { createHash } = process.getBuiltinModule("node:crypto")
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

function readFolder(root: string, name: string): Guide {
  const dir = nodePath().join(root, name)
  const paths = filesUnder(dir).sort((a, b) => (a === manifest ? -1 : b === manifest ? 1 : a < b ? -1 : 1))
  const files = paths.map((path) => {
    const bytes = new Uint8Array(fs().readFileSync(nodePath().join(dir, path)))
    return { path, bytes, digest: digestOf(bytes), size: bytes.byteLength }
  })
  const text = new TextDecoder().decode(files[0]!.bytes)
  const folder = name.slice(name.lastIndexOf("/") + 1)
  const matched = frontmatterPattern.exec(text)
  if (matched === null || matched[1] !== folder) {
    throw new Error(`${name}/${manifest} must open with "name: ${folder}" and a quoted description.`)
  }
  return {
    name,
    description: JSON.parse(matched[2]!) as string,
    markdown: text.slice(matched[0].length).trim(),
    files,
  }
}

export function guides(): readonly Guide[] {
  const root = filesDir()
  return filesUnder(root)
    .filter((path) => path.endsWith(`/${manifest}`))
    .map((path) => path.slice(0, -manifest.length - 1))
    .sort()
    .map((name) => readFolder(root, name))
}

export function guide(name: string): Guide | undefined {
  return guides().find((candidate) => candidate.name === name)
}
