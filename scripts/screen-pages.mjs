import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSync } from "oxc-parser"

export const webSource = "apps/web/src"
export const appEntry = `${webSource}/main.tsx`
export const knownFile = "scripts/screen-pages-known.json"

const source = /\.(?:tsx?|mts)$/
const test = /\.test\.[cm]?[jt]sx?$/
export const isScreen = (file) => /\/screens\/[^/]+\.tsx$/.test(file) || /-screens\.tsx$/.test(file)

const literalSource = (node) => (node?.type === "Literal" && typeof node.value === "string" ? node.value : undefined)

const typeOnly = (statement) =>
  statement.importKind === "type" ||
  (statement.specifiers.length > 0 && statement.specifiers.every((specifier) => specifier.importKind === "type"))

export const specifiers = (program) => {
  const found = []
  for (const statement of program.body) {
    if (statement.type === "ImportDeclaration" && !typeOnly(statement)) found.push(statement.source.value)
    if (
      (statement.type === "ExportNamedDeclaration" || statement.type === "ExportAllDeclaration") &&
      statement.source &&
      statement.exportKind !== "type"
    )
      found.push(statement.source.value)
  }
  walk(program, (node) => {
    if (node.type === "ImportExpression" && literalSource(node.source) !== undefined) found.push(node.source.value)
  })
  return found
}

export const resolver = (files) => {
  const known = new Set(files)
  return (from, specifier) => {
    const base = specifier.startsWith("@/")
      ? path.posix.join(webSource, specifier.slice(2))
      : specifier.startsWith(".")
        ? path.posix.join(path.posix.dirname(from), specifier)
        : undefined
    if (base === undefined) return undefined
    return ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]
      .map((ending) => `${base.replace(/\.js$/, "")}${ending}`)
      .find((candidate) => known.has(candidate))
  }
}

const children = (node) =>
  Object.values(node).flatMap((value) =>
    Array.isArray(value)
      ? value.filter((each) => each && typeof each.type === "string")
      : value && typeof value.type === "string"
        ? [value]
        : [],
  )

const walk = (node, visit) => {
  if (visit(node) === false) return
  for (const child of children(node)) walk(child, visit)
}

const drawsJsx = (node) => {
  let found = false
  walk(node, (each) => {
    if (found) return false
    if (each.type === "JSXElement" || each.type === "JSXFragment") found = true
  })
  return found
}

const functionLike = (node) =>
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionExpression" ||
  node?.type === "FunctionDeclaration"

const componentValue = (node) => {
  if (functionLike(node)) return drawsJsx(node)
  if (node?.type === "CallExpression") return node.arguments.some(componentValue)
  if (node?.type === "ObjectExpression")
    return node.properties.some((property) => property.type === "Property" && componentValue(property.value))
  return false
}

const componentDeclarations = (statement) => {
  const declaration = statement.type.startsWith("Export") ? statement.declaration : statement
  if (!declaration) return []
  if (declaration.type === "FunctionDeclaration")
    return declaration.id && drawsJsx(declaration) ? [{ name: declaration.id.name, node: declaration }] : []
  if (declaration.type === "VariableDeclaration")
    return declaration.declarations
      .filter((each) => each.id.type === "Identifier" && componentValue(each.init))
      .map((each) => ({ name: each.id.name, node: each }))
  return []
}

export const appRoot = `${webSource}/App.tsx`

const importedNames = (program) =>
  program.body
    .filter((statement) => statement.type === "ImportDeclaration" && !typeOnly(statement))
    .flatMap((statement) =>
      statement.specifiers
        .filter((specifier) => specifier.importKind !== "type")
        .map((specifier) => ({ name: specifier.local.name, from: statement.source.value })),
    )

const jsxRoot = (name) => (name.type === "JSXMemberExpression" ? jsxRoot(name.object) : name)

export const drawUses = (program) => {
  const uses = []
  walk(program, (node) => {
    if (node.type === "JSXOpeningElement") {
      const root = jsxRoot(node.name)
      if (root.type === "JSXIdentifier") uses.push({ name: root.name, at: node.start })
    }
    if (node.type === "CallExpression" && node.callee.type === "Identifier")
      uses.push({ name: node.callee.name, at: node.start })
    if (node.type === "JSXExpressionContainer" && node.expression.type === "Identifier")
      uses.push({ name: node.expression.name, at: node.start })
  })
  return uses
}

const componentName = /^[A-Z]/

const drawnNames = (program) => {
  const uses = new Set(drawUses(program).map(({ name }) => name))
  return new Set(
    importedNames(program)
      .map(({ name }) => name)
      .filter((name) => uses.has(name)),
  )
}

export const ownComponents = (program) => {
  const uses = drawUses(program)
  return [
    ...new Set(
      program.body
        .flatMap(componentDeclarations)
        .filter(({ name }) => componentName.test(name))
        .filter(({ name, node }) =>
          uses.some((use) => use.name === name && (use.at < node.start || use.at >= node.end)),
        )
        .map(({ name }) => name),
    ),
  ].toSorted()
}

export const screenFaultReads = (sources) => {
  const files = [...sources.keys()]
  const resolve = resolver(files)
  const programs = new Map(files.map((file) => [file, parseSync(file, sources.get(file)).program]))
  const importsOf = new Map(
    files.map((file) => [
      file,
      specifiers(programs.get(file))
        .map((specifier) => resolve(file, specifier))
        .filter((target) => target !== undefined),
    ]),
  )
  const reached = new Set()
  const queue = sources.has(appEntry) ? [appEntry] : []
  while (queue.length > 0) {
    const file = queue.pop()
    if (reached.has(file) || isScreen(file) || test.test(file)) continue
    reached.add(file)
    queue.push(...importsOf.get(file))
  }
  const dataMemo = new Map()
  const plainData = (file, seen = new Set()) => {
    if (dataMemo.has(file)) return dataMemo.get(file)
    if (seen.has(file)) return true
    seen.add(file)
    const data =
      file.endsWith(".ts") && importsOf.get(file).every((target) => reached.has(target) || plainData(target, seen))
    dataMemo.set(file, data)
    return data
  }
  const pages = new Set((importsOf.get(appRoot) ?? []).filter((target) => !target.endsWith("screen-routes.tsx")))
  const drawsAPage = (file) => {
    const program = programs.get(file)
    const drawn = drawnNames(program)
    return importedNames(program).some(({ name, from }) => drawn.has(name) && pages.has(resolve(file, from)))
  }
  const drawsOnlyTheApp = (file) =>
    file.endsWith(".tsx") &&
    ownComponents(programs.get(file)).length === 0 &&
    importsOf.get(file).every((target) => reached.has(target) || plainData(target)) &&
    drawsAPage(file)
  return files
    .filter(isScreen)
    .flatMap((screen) => [
      ...ownComponents(programs.get(screen)).map((name) => `${screen} -> own ${name}`),
      ...importsOf
        .get(screen)
        .filter((target) => !isScreen(target) && !reached.has(target) && !plainData(target))
        .filter((target) => !drawsOnlyTheApp(target))
        .map((target) => `${screen} -> ${target}`),
    ])
    .toSorted()
}

const what = (read) => {
  const [screen, target] = read.split(" -> ")
  return target.startsWith("own ")
    ? `${screen} draws its own ${target.slice(4)}, which the app never draws`
    : `${screen} draws ${target}, which the app never reaches from ${appEntry}`
}

export const screenFaults = (reads, known) => {
  const listed = new Set(known)
  const now = new Set(reads)
  return [
    ...reads
      .filter((read) => !listed.has(read))
      .map(
        (read) =>
          `${what(read)}. A screen shows the page a person sees: render that page with sample data, as editor-screens.tsx renders DoomEditor through editor-sample.tsx, a harness that draws only what the app draws.`,
      ),
    ...known
      .filter((read) => !now.has(read))
      .map((read) => `${knownFile} still lists "${read}", which is fixed or gone. Drop it from the list.`),
  ]
}

export const webSources = (root) =>
  new Map(
    execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z", webSource], {
      encoding: "utf8",
    })
      .split("\0")
      .filter((file) => source.test(file) && fs.existsSync(path.join(root, file)))
      .map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]),
  )

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."))
  const known = JSON.parse(fs.readFileSync(path.join(root, knownFile), "utf8")).known
  const faults = screenFaults(screenFaultReads(webSources(root)), known)
  for (const fault of faults) console.error(fault)
  if (faults.length > 0) process.exit(1)
}
