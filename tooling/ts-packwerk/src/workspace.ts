import { existsSync, globSync, readFileSync } from "node:fs"
import path from "node:path"
import { parse } from "oxc-parser"
import { ResolverFactory } from "oxc-resolver"
import YAML from "yaml"
import { exportTarget } from "./package-exports.ts"
import { lineStarts, position } from "./positions.ts"
import { typeGapsIn, type TypeGap } from "./public-types.ts"
import { tableUsesIn, type TableUse } from "./tables.ts"

export const configFile = "packwerk.yml"
export const manifestFile = "pack.yml"
export const todoFile = "pack_todo.yml"

export type Config = {
  readonly include: readonly string[]
  readonly exclude: readonly string[]
  readonly layers: readonly string[]
  readonly tableExempt: readonly string[]
}

export type Pack = {
  readonly name: string
  readonly layer: string | undefined
  readonly enforceDependencies: boolean
  readonly enforcePrivacy: boolean
  readonly enforceLayers: boolean
  readonly dependencies: readonly string[]
  readonly interfaceDependencies: ReadonlyMap<string, readonly string[]>
  readonly publicPaths: readonly string[]
  readonly interfaces: ReadonlyMap<string, readonly string[]>
  readonly enforcePublicTypes: boolean
  readonly ownsTables: readonly string[]
  readonly metadata: Readonly<Record<string, unknown>>
}

export type Target =
  | { readonly kind: "file"; readonly file: string }
  | { readonly kind: "package"; readonly name: string; readonly declared: "runtime" | "dev" | "missing" }
  | { readonly kind: "builtin" }
  | { readonly kind: "unresolved"; readonly reason: string }

export type Reference = {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly specifier: string
  readonly typeOnly: boolean
  readonly reexport: boolean
  readonly target: Target
}

export type Workspace = {
  readonly root: string
  readonly config: Config
  readonly packs: readonly Pack[]
  readonly files: readonly string[]
  readonly references: readonly Reference[]
  readonly packageRoots: readonly string[]
  readonly tableUses: readonly TableUse[]
  readonly typeGaps: readonly TypeGap[]
  readonly problems: readonly string[]
}

const defaultConfig: Config = {
  include: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
  exclude: ["**/node_modules/**", "**/dist/**"],
  layers: [],
  tableExempt: [],
}

const defaultPublic = ["index.ts", "index.tsx", "src/index.ts", "src/index.tsx"]

const posix = (file: string): string => file.split(path.sep).join("/")

const strings = (value: unknown, where: string, problems: string[]): string[] | undefined => {
  if (value === undefined) return undefined
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value
  problems.push(`${where} must be a list of strings`)
  return undefined
}

const flag = (value: unknown, where: string, problems: string[], fallback: boolean): boolean => {
  if (value === undefined) return fallback
  if (typeof value === "boolean") return value
  problems.push(`${where} must be true or false`)
  return fallback
}

const readYaml = (file: string, problems: string[]): Record<string, unknown> => {
  const parsed: unknown = YAML.parse(readFileSync(file, "utf8")) ?? {}
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  problems.push(`${file} must hold a mapping`)
  return {}
}

export const readConfig = (root: string, problems: string[]): Config => {
  const file = path.join(root, configFile)
  if (!existsSync(file)) return defaultConfig
  const raw = readYaml(file, problems)
  return {
    include: strings(raw.include, `${configFile} include`, problems) ?? defaultConfig.include,
    exclude: [...defaultConfig.exclude, ...(strings(raw.exclude, `${configFile} exclude`, problems) ?? [])],
    layers: strings(raw.layers, `${configFile} layers`, problems) ?? defaultConfig.layers,
    tableExempt: strings(raw.table_exempt, `${configFile} table_exempt`, problems) ?? defaultConfig.tableExempt,
  }
}

const skipDirectory = (name: string): boolean => name === "node_modules" || name === "dist" || name === ".git"

export const packName = (root: string, manifest: string): string =>
  posix(path.relative(root, path.dirname(manifest))) || "."

const readPack = (root: string, manifest: string, config: Config, problems: string[]): Pack => {
  const name = packName(root, manifest)
  const where = `${name}/${manifestFile}`
  const raw = readYaml(manifest, problems)
  const layer = raw.layer
  if (layer !== undefined && (typeof layer !== "string" || !config.layers.includes(layer))) {
    problems.push(`${where} layer ${String(layer)} is not one of ${configFile} layers`)
  }
  const directory = path.dirname(manifest)
  const rooted = (entry: string): string => (name === "." ? posix(entry) : `${name}/${posix(entry)}`)
  const interfaces = new Map<string, string[]>()
  const rawPublic = raw.public
  if (rawPublic === undefined) {
    interfaces.set("default", defaultPublic.filter((entry) => existsSync(path.join(directory, entry))).map(rooted))
  } else if (typeof rawPublic === "object" && rawPublic !== null && !Array.isArray(rawPublic)) {
    for (const [face, entries] of Object.entries(rawPublic)) {
      interfaces.set(face, (strings(entries, `${where} public.${face}`, problems) ?? []).map(rooted))
    }
  } else {
    interfaces.set("default", (strings(rawPublic, `${where} public`, problems) ?? []).map(rooted))
  }
  if (rawPublic !== undefined) {
    for (const entry of [...interfaces.values()].flat()) {
      if (!existsSync(path.join(root, entry))) problems.push(`${where} public path ${entry} does not exist`)
    }
  }
  const publicPaths = [...new Set([...interfaces.values()].flat())]
  const listedDependencies = strings(raw.dependencies, `${where} dependencies`, problems) ?? []
  const interfaceDependencies = new Map<string, string[]>()
  for (const entry of listedDependencies) {
    const [pack, face] = entry.split("#")
    if (pack === undefined || face === undefined) continue
    interfaceDependencies.set(pack, [...(interfaceDependencies.get(pack) ?? []), face])
  }
  const bare = new Set(listedDependencies.filter((entry) => !entry.includes("#")))
  for (const pack of bare) interfaceDependencies.delete(pack)
  const metadata = raw.metadata
  return {
    name,
    layer: typeof layer === "string" ? layer : undefined,
    enforceDependencies: flag(raw.enforce_dependencies, `${where} enforce_dependencies`, problems, true),
    enforcePrivacy: flag(raw.enforce_privacy, `${where} enforce_privacy`, problems, true),
    enforceLayers: flag(raw.enforce_layers, `${where} enforce_layers`, problems, true),
    dependencies: [...new Set(listedDependencies.map((entry) => entry.split("#")[0] ?? entry))],
    interfaceDependencies,
    publicPaths,
    interfaces,
    enforcePublicTypes: flag(raw.enforce_public_types, `${where} enforce_public_types`, problems, false),
    ownsTables: strings(raw.owns_tables, `${where} owns_tables`, problems) ?? [],
    metadata: typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : {},
  }
}

export const packOf = (packs: readonly Pack[], file: string): Pack | undefined => {
  let owner: Pack | undefined
  for (const pack of packs) {
    const inside = pack.name === "." || file === pack.name || file.startsWith(`${pack.name}/`)
    if (inside && (owner === undefined || pack.name.length > owner.name.length || owner.name === ".")) owner = pack
  }
  return owner
}

export const packageRootOf = (packageRoots: readonly string[], file: string): string | undefined => {
  let owner: string | undefined
  for (const root of packageRoots) {
    const inside = root === "." || file.startsWith(`${root}/`)
    if (inside && (owner === undefined || owner === "." || root.length > owner.length)) owner = root
  }
  return owner
}

export const isPublic = (pack: Pack, file: string): boolean =>
  pack.publicPaths.some((entry) => file === entry || file.startsWith(`${entry.replace(/\/$/, "")}/`))

type Request = { specifier: string; offset: number; typeOnly: boolean; reexport: boolean }

const literal = /^\s*(["'`])([^"'`$\\]*)\1\s*$/

const requestsOf = async (file: string, source: string): Promise<Request[]> => {
  const { module } = await parse(file, source)
  const requests: Request[] = module.staticImports.map((item) => ({
    specifier: item.moduleRequest.value,
    offset: item.moduleRequest.start,
    typeOnly: item.entries.length > 0 && item.entries.every((entry) => entry.isType),
    reexport: false,
  }))
  for (const item of module.staticExports) {
    const reexports = item.entries.filter((entry) => entry.moduleRequest !== null)
    const first = reexports[0]?.moduleRequest
    if (first === undefined || first === null) continue
    requests.push({
      specifier: first.value,
      offset: first.start,
      typeOnly: reexports.every((entry) => entry.isType),
      reexport: true,
    })
  }
  for (const item of module.dynamicImports) {
    const text = literal.exec(source.slice(item.moduleRequest.start, item.moduleRequest.end))
    if (text?.[2] !== undefined)
      requests.push({ specifier: text[2], offset: item.moduleRequest.start, typeOnly: false, reexport: false })
  }
  return requests
}

const jsonc = (text: string): string =>
  text
    .replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_match, quoted: string | undefined) => quoted ?? "")
    .replace(/,(\s*[}\]])/g, "$1")

const packageNameOf = (specifier: string): string => {
  const parts = specifier.split("/")
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier)
}

const isBare = (specifier: string): boolean =>
  !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("#") && !/^[a-z]+:/.test(specifier)

type Manifest = { directory: string; name: string | undefined; runtime: Set<string>; dev: Set<string> }

const extensionSwaps: Record<string, readonly string[]> = {
  ".js": [".ts", ".tsx", ".js"],
  ".jsx": [".tsx", ".jsx"],
  ".mjs": [".mts", ".mjs"],
  ".cjs": [".cts", ".cjs"],
  ".d.ts": [".ts", ".tsx"],
}

export const loadWorkspace = async (root: string): Promise<Workspace> => {
  const problems: string[] = []
  const config = readConfig(root, problems)
  const manifests = globSync(`**/${manifestFile}`, { cwd: root, exclude: (entry) => skipDirectory(entry) })
  const packs = manifests
    .map((manifest) => readPack(root, path.join(root, manifest), config, problems))
    .sort((left, right) => left.name.localeCompare(right.name))
  const names = new Set(packs.map((pack) => pack.name))
  const byName = new Map(packs.map((pack) => [pack.name, pack]))
  for (const pack of packs) {
    for (const [other, faces] of pack.interfaceDependencies) {
      for (const face of faces) {
        if (byName.get(other)?.interfaces.has(face) === false) {
          problems.push(
            `${pack.name}/${manifestFile} depends on ${other}#${face}, which is not one of its public interfaces`,
          )
        }
      }
    }
  }
  const tableOwners = new Map<string, string>()
  for (const pack of packs) {
    for (const table of pack.ownsTables) {
      const other = tableOwners.get(table)
      if (other !== undefined) problems.push(`${table} is owned by both ${other} and ${pack.name}`)
      tableOwners.set(table, pack.name)
    }
  }
  const tables = [...tableOwners.keys()]
  for (const pack of packs) {
    for (const dependency of pack.dependencies) {
      if (!names.has(dependency))
        problems.push(`${pack.name}/${manifestFile} depends on ${dependency}, which is not a pack`)
    }
  }

  const files = globSync([...config.include], { cwd: root, exclude: (entry) => skipDirectory(path.basename(entry)) })
    .map(posix)
    .filter((file) => !config.exclude.some((pattern) => path.matchesGlob(file, pattern)))
    .sort()
  const fileSet = new Set(files)

  const packageRoots = new Set<string>()
  const manifestsByDirectory = new Map<string, Manifest | undefined>()
  const nearestManifest = (directory: string): Manifest | undefined => {
    if (manifestsByDirectory.has(directory)) return manifestsByDirectory.get(directory)
    const file = path.join(directory, "package.json")
    let found: Manifest | undefined
    if (existsSync(file)) {
      const json = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>
      const keys = (field: string) => Object.keys((json[field] as Record<string, string> | undefined) ?? {})
      found = {
        directory: posix(path.relative(root, directory)) || ".",
        name: typeof json.name === "string" ? json.name : undefined,
        runtime: new Set([...keys("dependencies"), ...keys("peerDependencies"), ...keys("optionalDependencies")]),
        dev: new Set(keys("devDependencies")),
      }
    } else if (path.dirname(directory) !== directory && directory !== root) {
      found = nearestManifest(path.dirname(directory))
    }
    manifestsByDirectory.set(directory, found)
    return found
  }

  const outputs = new Map<string, { out: string; source: string } | undefined>()
  const buildOutput = (directory: string): { out: string; source: string } | undefined => {
    if (outputs.has(directory)) return outputs.get(directory)
    const tsconfig = path.join(directory, "tsconfig.json")
    let found: { out: string; source: string } | undefined
    if (existsSync(path.join(directory, "package.json"))) {
      if (existsSync(tsconfig)) {
        const options = (
          JSON.parse(jsonc(readFileSync(tsconfig, "utf8"))) as { compilerOptions?: Record<string, unknown> }
        ).compilerOptions
        const out = options?.outDir
        const source = options?.rootDir
        if (typeof out === "string") {
          found = {
            out: path.join(directory, out),
            source: path.join(directory, typeof source === "string" ? source : "."),
          }
        }
      }
    } else if (path.dirname(directory) !== directory && directory !== root) {
      found = buildOutput(path.dirname(directory))
    }
    outputs.set(directory, found)
    return found
  }

  const toSource = (absolute: string): string => {
    const relative = posix(path.relative(root, absolute))
    if (fileSet.has(relative)) return relative
    const build = buildOutput(path.dirname(absolute))
    if (build === undefined || !absolute.startsWith(`${build.out}${path.sep}`)) return relative
    const inside = path.join(build.source, path.relative(build.out, absolute))
    const extension = inside.endsWith(".d.ts") ? ".d.ts" : path.extname(inside)
    const stem = inside.slice(0, inside.length - extension.length)
    for (const swap of extensionSwaps[extension] ?? [extension]) {
      const candidate = posix(path.relative(root, `${stem}${swap}`))
      if (fileSet.has(candidate) || existsSync(`${stem}${swap}`)) return candidate
    }
    return relative
  }

  const resolver = new ResolverFactory({
    tsconfig: "auto",
    conditionNames: ["import", "module", "default"],
    extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"],
    extensionAlias: { ".js": [".ts", ".tsx", ".js"], ".jsx": [".tsx", ".jsx"], ".mjs": [".mts", ".mjs"] },
    builtinModules: true,
  })

  const workspacePackages = new Map<string, { directory: string; manifest: Record<string, unknown> }>()
  for (const file of globSync("**/package.json", {
    cwd: root,
    exclude: (entry) => skipDirectory(path.basename(entry)),
  })) {
    const manifest = JSON.parse(readFileSync(path.join(root, file), "utf8")) as Record<string, unknown>
    if (typeof manifest.name === "string")
      workspacePackages.set(manifest.name, { directory: path.join(root, path.dirname(file)), manifest })
  }

  const unbuilt = (specifier: string): string | undefined => {
    const name = packageNameOf(specifier)
    const found = workspacePackages.get(name)
    if (found === undefined) return undefined
    const subpath = `.${specifier.slice(name.length)}`
    const target = exportTarget(found.manifest, subpath)
    return target === undefined ? undefined : toSource(path.join(found.directory, target))
  }

  const targetOf = async (file: string, specifier: string): Promise<Target> => {
    const absolute = path.join(root, file)
    const resolved = await resolver.resolveFileAsync(absolute, specifier)
    if (resolved.builtin !== undefined || specifier.startsWith("node:")) return { kind: "builtin" }
    if (resolved.path === undefined && isBare(specifier)) {
      const source = unbuilt(specifier)
      if (source !== undefined) return { kind: "file", file: source }
    }
    const external = resolved.path === undefined || resolved.path.includes(`${path.sep}node_modules${path.sep}`)
    if (resolved.path !== undefined && !external) return { kind: "file", file: toSource(resolved.path) }
    if (!isBare(specifier)) return { kind: "unresolved", reason: resolved.error ?? "not found" }
    const name = packageNameOf(specifier)
    const manifest = nearestManifest(path.dirname(absolute))
    const declared =
      manifest === undefined || manifest.name === name || manifest.runtime.has(name)
        ? "runtime"
        : manifest.dev.has(name)
          ? "dev"
          : "missing"
    return { kind: "package", name, declared }
  }

  const tableUses: TableUse[] = []
  const perFile = await Promise.all(
    files.map(async (file) => {
      const owner = nearestManifest(path.dirname(path.join(root, file)))
      if (owner !== undefined) packageRoots.add(owner.directory)
      const source = readFileSync(path.join(root, file), "utf8")
      const starts = lineStarts(source)
      const requests = await requestsOf(file, source)
      if (tables.length > 0 && !config.tableExempt.some((pattern) => path.matchesGlob(file, pattern))) {
        tableUses.push(...tableUsesIn(file, source, tables))
      }
      return Promise.all(
        requests.map(async (request): Promise<Reference> => ({
          file,
          ...position(starts, request.offset),
          specifier: request.specifier,
          typeOnly: request.typeOnly,
          reexport: request.reexport,
          target: await targetOf(file, request.specifier),
        })),
      )
    }),
  )

  const references = perFile.flat()
  const typeGaps: TypeGap[] = []
  for (const pack of packs.filter((item) => item.enforcePublicTypes)) {
    const reached = new Set(pack.publicPaths.filter((file) => fileSet.has(file)))
    const queue = [...reached]
    while (queue.length > 0) {
      const file = queue.pop() ?? ""
      for (const reference of references) {
        if (reference.file !== file || !reference.reexport || reference.target.kind !== "file") continue
        const next = reference.target.file
        if (!reached.has(next) && fileSet.has(next) && packOf(packs, next) === pack) {
          reached.add(next)
          queue.push(next)
        }
      }
    }
    for (const file of [...reached].sort())
      typeGaps.push(...typeGapsIn(file, readFileSync(path.join(root, file), "utf8")))
  }
  return {
    root,
    config,
    packs,
    files,
    references,
    packageRoots: [...packageRoots].sort(),
    tableUses,
    typeGaps,
    problems,
  }
}
