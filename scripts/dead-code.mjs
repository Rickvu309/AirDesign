import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const code = /\.(ts|tsx|mts|mjs|js)$/
const scanned = [
  /^apps\/(web|api|site)\/(src|worker|scripts)\//,
  /^apps\/web\/vite\.config\.ts$/,
  /^packages\/[^/]+\/(src|scripts)\//,
  /^packages\/[^/]+\/[^/]+\.mjs$/,
  /^tests\//,
  /^scripts\//,
  /^vitest\.config\.mts$/,
  /^\.agents\/skills\//,
]
const sourceReadingTests = ["apps/web/src/editor/color-parity.test.ts", "tests/spec-replay.test.ts"]

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean)

export const scannedFiles = (root) =>
  git(root, ["ls-files", "--cached", "--others", "--exclude-standard"]).filter(
    (file) =>
      code.test(file) &&
      !file.includes("node_modules") &&
      !file.includes("/dist/") &&
      scanned.some((pattern) => pattern.test(file)) &&
      fs.existsSync(path.join(root, file)),
  )

const ruleTestsOf = (root) => {
  const tests = new Set(sourceReadingTests)
  for (const rule of git(root, ["ls-files", "*.rule.md"]))
    for (const extension of [".test.ts", ".test.tsx"]) {
      const test = rule.replace(/\.rule\.md$/, extension)
      if (fs.existsSync(path.join(root, test))) tests.add(test)
    }
  return tests
}

export const roles = (ruleTests) => {
  const isTest = (file) =>
    !file.startsWith("tests/browser/") &&
    !ruleTests.has(file) &&
    (/\.(test|spec)\.[a-z]+$/.test(file) || file.includes("/src/testing/"))
  const isProduct = (file) =>
    !isTest(file) &&
    (file.startsWith("apps/") || file.startsWith("packages/")) &&
    !/\/scripts\//.test(file) &&
    !/^packages\/[^/]+\/[^/]+\.mjs$/.test(file)
  const isRoot = (file) =>
    !isTest(file) &&
    (!isProduct(file) ||
      ruleTests.has(file) ||
      file === "apps/web/src/main.tsx" ||
      file.endsWith("-screens.tsx") ||
      file.startsWith("apps/web/worker/") ||
      file === "apps/web/vite.config.ts" ||
      file.startsWith("apps/site/") ||
      /^apps\/api\/src\/[^/]+\.ts$/.test(file))
  return { isTest, isProduct, isRoot }
}

const ts = createRequire(import.meta.url)("typescript-api")

const compilerOptions = (root) => ({
  allowJs: true,
  checkJs: false,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2023,
  lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  baseUrl: root,
  paths: {
    "@airdesign/mcp/testing/evals": ["packages/mcp/src/testing/evals.ts"],
    "@airdesign/*": ["packages/*/src/index.ts"],
    "@/*": ["apps/web/src/*"],
  },
  allowImportingTsExtensions: true,
  resolveJsonModule: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
})

const isDeclaration = (statement) =>
  ts.isFunctionDeclaration(statement) ||
  ts.isClassDeclaration(statement) ||
  ts.isTypeAliasDeclaration(statement) ||
  ts.isInterfaceDeclaration(statement) ||
  ts.isEnumDeclaration(statement) ||
  ts.isVariableStatement(statement) ||
  ts.isModuleDeclaration(statement)

const namesOf = (statement) => {
  if (ts.isVariableStatement(statement))
    return statement.declarationList.declarations.flatMap((each) =>
      ts.isIdentifier(each.name) ? [each.name.text] : [],
    )
  return statement.name && ts.isIdentifier(statement.name) ? [statement.name.text] : []
}

const statementsOf = (program, root, files) => {
  const units = new Map()
  const unitOfNode = new Map()
  const byFile = new Map()
  for (const file of files) {
    const source = program.getSourceFile(path.join(root, file))
    if (!source) continue
    const list = source.statements.map((node, index) => {
      const unit = {
        id: `${file}#${index}`,
        file,
        node,
        source,
        names: namesOf(node),
        declaration: isDeclaration(node),
        exported: (ts.getModifiers?.(node) ?? []).some((each) => each.kind === ts.SyntaxKind.ExportKeyword),
        edges: new Set(),
      }
      units.set(unit.id, unit)
      if (ts.isVariableStatement(node)) for (const each of node.declarationList.declarations) unitOfNode.set(each, unit)
      else unitOfNode.set(node, unit)
      return unit
    })
    byFile.set(file, list)
  }
  const unitOf = (declaration) => {
    for (let node = declaration; node && !ts.isSourceFile(node); node = node.parent) {
      const unit = unitOfNode.get(node)
      if (unit) return unit
    }
    return undefined
  }
  return { units, byFile, unitOf }
}

const followAlias = (checker, symbol) => {
  let followed = symbol
  for (let step = 0; step < 10 && followed && followed.flags & ts.SymbolFlags.Alias; step++) {
    try {
      followed = checker.getAliasedSymbol(followed)
    } catch {
      break
    }
  }
  return followed
}

const loadedPaths = (root, file, written, folderLoads) => {
  const folder = path.dirname(path.join(root, file))
  for (const candidate of [
    written,
    written.replace(/\.js$/, ".ts"),
    written.replace(/\.js$/, ".tsx"),
    `${written}.ts`,
    `${written}.tsx`,
  ]) {
    const full = candidate.startsWith("@/")
      ? path.join(root, "apps/web/src", candidate.slice(2))
      : path.resolve(folder, candidate)
    if (!fs.existsSync(full)) continue
    if (fs.statSync(full).isFile()) return [path.relative(root, full)]
    if (folderLoads) return fs.readdirSync(full).map((name) => path.relative(root, path.join(full, name)))
  }
  return []
}

const isBody = (node) => !ts.isImportDeclaration(node) && !ts.isExportDeclaration(node) && !ts.isExportAssignment(node)

const link = ({ checker, root, units, byFile, unitOf }) => {
  const linkTo = (unit, symbol, crossFileOnly) => {
    for (const declaration of symbol?.declarations ?? []) {
      const target = unitOf(declaration)
      if (target && target !== unit && (!crossFileOnly || target.file !== unit.file)) unit.edges.add(target.id)
    }
  }
  for (const unit of units.values()) {
    if (ts.isImportDeclaration(unit.node)) continue
    const visit = (node) => {
      if (ts.isIdentifier(node) || ts.isPrivateIdentifier?.(node)) {
        let symbol = checker.getSymbolAtLocation(node)
        if (ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node)
          symbol = checker.getShorthandAssignmentValueSymbol(node.parent) ?? symbol
        const followed = followAlias(checker, symbol)
        linkTo(unit, followed, false)
        if (symbol && symbol !== followed) linkTo(unit, symbol, true)
      }
      const urlOf = ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "URL"
      const written = (ts.isCallExpression(node) || urlOf) && node.arguments?.[0]
      if (written && ts.isStringLiteralLike(written) && /^(\.{1,2}\/|@\/)/.test(written.text))
        for (const file of loadedPaths(root, unit.file, written.text, urlOf))
          for (const target of byFile.get(file) ?? [])
            if (isBody(target.node) && (target.exported || !target.declaration)) unit.edges.add(target.id)
      ts.forEachChild(node, visit)
    }
    visit(unit.node)
  }
}

const workspaceFolders = (root) =>
  new Map(
    ["apps", "packages"].flatMap((top) =>
      fs
        .readdirSync(path.join(root, top), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, top, entry.name, "package.json")))
        .map((entry) => [
          JSON.parse(fs.readFileSync(path.join(root, top, entry.name, "package.json"), "utf8")).name,
          `${top}/${entry.name}`,
        ]),
    ),
  )

const distRootsOf = ({ checker, program, root, files, byFile, unitOf, isScript }) => {
  const scriptText = files.filter(isScript).map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  const words = new Set(scriptText.flatMap((text) => text.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []))
  const folders = workspaceFolders(root)
  const modules = new Set(
    scriptText.flatMap((text) => [
      ...[...text.matchAll(/(packages|apps)\/([a-z-]+)\/dist\/([A-Za-z0-9_./-]+)\.js/g)].map(
        ([, top, name, rest]) => `${top}/${name}/src/${rest}`,
      ),
      ...[...text.matchAll(/packageBuild\([^,()]+,\s*"(@airdesign\/[a-z-]+)"(?:,\s*"([A-Za-z0-9_./-]+)\.js")?/g)]
        .filter(([, name]) => folders.has(name))
        .map(([, name, file]) => `${folders.get(name)}/src/${file ?? "index"}`),
    ]),
  )
  const roots = []
  for (const module of modules) {
    const file = [`${module}.ts`, `${module}.tsx`].find((each) => byFile.has(each))
    if (!file) continue
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(path.join(root, file)))
    for (const exported of moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []) {
      if (!words.has(exported.name)) continue
      for (const declaration of followAlias(checker, exported)?.declarations ?? []) {
        const unit = unitOf(declaration)
        if (unit) roots.push(unit)
      }
    }
  }
  return roots
}

const lineOf = (unit, position) => unit.source.getLineAndCharacterOfPosition(position).line + 1

export const deadCode = (root, files = scannedFiles(root)) => {
  const { isTest, isProduct, isRoot } = roles(ruleTestsOf(root))
  const program = ts.createProgram(
    files.map((file) => path.join(root, file)),
    compilerOptions(root),
  )
  const checker = program.getTypeChecker()
  const { units, byFile, unitOf } = statementsOf(program, root, files)
  link({ checker, root, units, byFile, unitOf })
  const isScript = (file) => !isTest(file) && !isProduct(file)

  const reached = new Map()
  const opened = new Set()
  const queue = []
  const reach = (unit, from) => {
    if (isTest(unit.file) || reached.has(unit.id)) return
    reached.set(unit.id, from)
    queue.push(unit)
  }
  for (const [file, list] of byFile)
    for (const unit of list) {
      if (isRoot(file) && isBody(unit.node)) reach(unit, undefined)
    }
  for (const unit of distRootsOf({ checker, program, root, files, byFile, unitOf, isScript })) reach(unit, undefined)
  while (queue.length > 0) {
    const unit = queue.pop()
    if (!opened.has(unit.file)) {
      opened.add(unit.file)
      for (const each of byFile.get(unit.file)) if (!each.declaration && isBody(each.node)) reach(each, unit.id)
    }
    for (const edge of unit.edges) reach(units.get(edge), unit.id)
  }

  const testUsers = new Map()
  for (const unit of units.values())
    if (isTest(unit.file))
      for (const edge of unit.edges) testUsers.set(edge, new Set([...(testUsers.get(edge) ?? []), unit.file]))
  const testsOf = (list) => [...new Set(list.flatMap((unit) => [...(testUsers.get(unit.id) ?? [])]))].sort()

  const deadFiles = []
  const deadUnits = []
  for (const [file, list] of byFile) {
    if (!isProduct(file) || file.endsWith(".d.ts")) continue
    const declarations = list.filter((unit) => unit.declaration)
    const dead = declarations.filter((unit) => !reached.has(unit.id))
    if (dead.length === 0) continue
    if (dead.length === declarations.length && !opened.has(file)) {
      const source = list[0].source
      deadFiles.push({ file, lines: lineOf(list[0], source.getEnd()), tests: testsOf(dead) })
      continue
    }
    for (const unit of dead) {
      const line = lineOf(unit, unit.node.getStart(unit.source))
      deadUnits.push({
        file,
        names: unit.names,
        line,
        lines: lineOf(unit, unit.node.getEnd()) - line + 1,
        tests: testsOf([unit]),
      })
    }
  }

  const chainTo = (file, name) => {
    const unit = (byFile.get(file) ?? []).find((each) => each.names.includes(name))
    if (!unit) return undefined
    if (!reached.has(unit.id)) return []
    const chain = []
    for (let id = unit.id; id; id = reached.get(id)) {
      const step = units.get(id)
      chain.unshift(`${step.file}:${step.names.join(",") || `line ${lineOf(step, step.node.getStart(step.source))}`}`)
    }
    return chain
  }
  return { deadFiles, deadUnits, chainTo }
}

export const areaOf = (file) => file.split("/").slice(0, 2).join("/")

export const summary = ({ deadFiles, deadUnits }) => {
  const areas = new Map()
  const areaFor = (file) => {
    const key = areaOf(file)
    if (!areas.has(key)) areas.set(key, { files: 0, fileLines: 0, units: 0, unitLines: 0 })
    return areas.get(key)
  }
  for (const each of deadFiles) {
    areaFor(each.file).files++
    areaFor(each.file).fileLines += each.lines
  }
  for (const each of deadUnits) {
    areaFor(each.file).units++
    areaFor(each.file).unitLines += each.lines
  }
  return new Map([...areas].sort(([a], [b]) => a.localeCompare(b)))
}

const covered = (tests) => (tests.length === 0 ? "" : `  (only tests: ${tests.join(", ")})`)

export const report = (dead) => {
  const lines = ["Dead files:"]
  for (const each of dead.deadFiles) lines.push(`  ${each.file} (${each.lines} lines)${covered(each.tests)}`)
  lines.push("Dead declarations:")
  for (const each of dead.deadUnits)
    lines.push(
      `  ${each.file}:${each.line} ${each.names.join(", ") || "statement"} (${each.lines} lines)${covered(each.tests)}`,
    )
  lines.push("By area: files (lines), declarations (lines)")
  for (const [area, counts] of summary(dead))
    lines.push(`  ${area}: ${counts.files} (${counts.fileLines}), ${counts.units} (${counts.unitLines})`)
  lines.push(`${dead.deadFiles.length} dead files, ${dead.deadUnits.length} dead declarations`)
  return lines.join("\n")
}

const flagValue = (argv, flag) => {
  const given = argv.find((word) => word.startsWith(`${flag}=`))
  return given?.slice(flag.length + 1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const argv = process.argv.slice(2)
  const dead = deadCode(root)
  const json = flagValue(argv, "--json")
  if (json)
    fs.writeFileSync(json, `${JSON.stringify({ deadFiles: dead.deadFiles, deadUnits: dead.deadUnits }, null, 1)}\n`)
  const why = flagValue(argv, "--why")
  if (why) {
    const [file, name] = why.split("#")
    const chain = dead.chainTo(file, name)
    if (chain === undefined) console.log(`${why} names no declaration`)
    else if (chain.length === 0) console.log(`${why} is dead: no root reaches it`)
    else console.log(`${why} is reached by:\n  ${chain.join("\n  -> ")}`)
  } else console.log(report(dead))
}
