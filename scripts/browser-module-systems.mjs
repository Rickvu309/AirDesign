import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { parseSync } from "oxc-parser"

const scripted = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/
const esmOnly = (file) => /\.m[jt]s$/.test(file) || /\/packages\/[^/]+\/dist\//.test(file)
const quoted = /^(["'`])([^"'`$]+)\1$/

const trackedFiles = (root) =>
  execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    encoding: "utf8",
    maxBuffer: 64 * 2 ** 20,
  })
    .split("\0")
    .filter((file) => scripted.test(file) && existsSync(path.join(root, file)))

const importsOf = (file) => {
  const source = readFileSync(file, "utf8")
  const { module } = parseSync(file, source)
  const line = (offset) => source.slice(0, offset).split("\n").length
  const statics = [
    ...module.staticImports
      .filter(({ entries }) => entries.length === 0 || entries.some((entry) => !entry.isType))
      .map(({ moduleRequest, start }) => ({ specifier: moduleRequest.value, line: line(start) })),
    ...module.staticExports.flatMap(({ entries, start }) =>
      entries
        .filter((entry) => entry.moduleRequest && !entry.isType)
        .map((entry) => ({ specifier: entry.moduleRequest.value, line: line(start) })),
    ),
  ]
  const dynamics = module.dynamicImports.flatMap(({ moduleRequest }) => {
    const literal = source.slice(moduleRequest.start, moduleRequest.end).match(quoted)
    return literal ? [literal[2]] : []
  })
  return { statics, dynamics }
}

const isFile = (file) => existsSync(file) && statSync(file).isFile()
const candidates = (literal) => [
  literal,
  ...(literal.endsWith(".js") ? [literal.replace(/\.js$/, ".ts"), literal.replace(/\.js$/, ".tsx")] : []),
  ...[".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"].map((suffix) => literal + suffix),
]

export const browserModuleSystemFaults = (root) => {
  const parsed = new Map()
  const parse = (file) => {
    if (!parsed.has(file)) parsed.set(file, importsOf(file))
    return parsed.get(file)
  }
  const resolve = (specifier, from) => {
    if (specifier.startsWith("@airdesign/")) return { package: specifier }
    if (!specifier.startsWith(".") && !specifier.startsWith("/")) return undefined
    const file = candidates(path.resolve(path.dirname(from), specifier)).find(isFile)
    return file ? { file } : undefined
  }
  const relative = (file) => path.relative(root, file)
  const inside = (file, folder) => file.startsWith(path.join(root, folder) + path.sep)

  const esmLoaded = new Set()
  const loadAsEsm = (file) => {
    if (esmLoaded.has(file) || !scripted.test(file) || inside(file, "node_modules")) return
    esmLoaded.add(file)
    for (const specifier of [...parse(file).statics.map(({ specifier }) => specifier), ...parse(file).dynamics]) {
      const target = resolve(specifier, file)
      if (target?.file) loadAsEsm(target.file)
    }
  }
  const files = trackedFiles(root).map((file) => path.join(root, file))
  const browserFiles = files.filter((file) => inside(file, "tests/browser") && /\.tsx?$/.test(file))
  for (const file of files) if (esmOnly(file) && !/\.test\.m[jt]s$/.test(file)) loadAsEsm(file)
  for (const file of browserFiles) {
    for (const specifier of parse(file).dynamics) {
      const target = resolve(specifier, file)
      if (target?.file) loadAsEsm(target.file)
    }
  }

  const chainFrom = (specifier, from, seen) => {
    const target = resolve(specifier, from)
    if (target?.package) return [`${target.package} (a package that exports only to import)`]
    if (!target?.file) return undefined
    const name = relative(target.file)
    if (esmOnly(target.file)) return [`${name} (an ES module)`]
    if (inside(target.file, "tests/browser") || seen.has(target.file)) return undefined
    seen.add(target.file)
    if (esmLoaded.has(target.file)) return [`${name} (also loaded by import() or from an .mjs file)`]
    for (const next of parse(target.file).statics) {
      const deeper = chainFrom(next.specifier, target.file, seen)
      if (deeper) return [name, ...deeper]
    }
    return undefined
  }

  return browserFiles.flatMap((file) =>
    parse(file).statics.flatMap(({ specifier, line }) => {
      const chain = chainFrom(specifier, file, new Set())
      return chain ? [{ file: relative(file), line, specifier, chain }] : []
    }),
  )
}

export const describeFault = ({ file, line, specifier, chain }) =>
  `${file}:${String(line)}: the static import of "${specifier}" loads ${chain.join(" -> ")}. ` +
  "Playwright loads browser specs and their helpers as CommonJS, and a file loaded both as CommonJS and as an ES module in one worker loses its exports. " +
  `Load it where it is used: const { name } = await import("${specifier}"), or write import type when only types are used. ` +
  "See scripts/browser-module-systems.rule.md"
