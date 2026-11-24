import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"

const ts = createRequire(import.meta.url)("typescript-api")
const copyFile = /^(apps\/web\/src\/copy\/[^/]+|apps\/site\/src\/.*-copy)\.ts$/

const isCopyTest = (file) => (file.includes("/copy/") && /\.test\.ts$/.test(file)) || file.endsWith("-copy.test.ts")

function objectLiteral(node) {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)))
    node = node.expression
  return node && ts.isObjectLiteralExpression(node) ? node : undefined
}

function propertyName(node) {
  return node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : undefined
}

export function copyCompilerHost(root, options) {
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile
  host.getSourceFile = (file, languageVersion, ...rest) => {
    const source = getSourceFile(file, languageVersion, ...rest)
    if (
      !source ||
      !/\.[cm]?js$/.test(file) ||
      !source.text.includes("createRequire") ||
      path.relative(root, file).split(path.sep).includes("node_modules")
    )
      return source

    const loads = []
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isCallExpression(node.expression)) {
        const factory = node.expression.expression
        const specifier = node.arguments[0]
        if (
          ts.isIdentifier(factory) &&
          factory.text === "createRequire" &&
          specifier &&
          ts.isStringLiteralLike(specifier) &&
          specifier.text.startsWith(".") &&
          copyFile.test(path.relative(root, path.resolve(path.dirname(file), specifier.text)))
        ) {
          loads.push({ start: node.getStart(source), end: node.end, specifier: specifier.text })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    if (!loads.length) return source

    let rewritten = source.text
    const imports = []
    for (const { start, end, specifier } of loads.reverse()) {
      const name = `__airdesignCopyModule${start}`
      const lineBreaks = source.text.slice(start, end).replace(/[^\n]/g, "")
      rewritten = rewritten.slice(0, start) + name + lineBreaks + rewritten.slice(end)
      imports.push(`import * as ${name} from ${JSON.stringify(specifier)}`)
    }
    return ts.createSourceFile(file, rewritten + "\n" + imports.join("\n"), languageVersion, true)
  }
  return host
}

export function unusedCopy(root, checker, units) {
  const keys = new Map()
  const read = new Set()
  const objects = new Set()
  const paths = new Map()
  const missing = []
  const collect = (object, name, unit) => {
    paths.set(checker.getTypeAtLocation(object), name)
    for (const member of object.properties) {
      if (!ts.isPropertyAssignment(member)) continue
      const part = propertyName(member.name)
      if (part === undefined) continue
      const key = `${name}.${part}`
      const nested = objectLiteral(member.initializer)
      if (nested) collect(nested, key, unit)
      else {
        const line = unit.source.getLineAndCharacterOfPosition(member.getStart()).line + 1
        keys.set(member, { file: unit.file, key, line })
      }
    }
  }

  for (const unit of units.values()) {
    if (!copyFile.test(unit.file) || isCopyTest(unit.file) || !ts.isVariableStatement(unit.node)) continue
    for (const declaration of unit.node.declarationList.declarations) {
      const name = propertyName(declaration.name)
      const object = objectLiteral(declaration.initializer)
      if (name !== undefined && object) {
        objects.add(declaration)
        const type = checker.getTypeAtLocation(declaration)
        if (!type.getStringIndexType()) paths.set(type, name)
        collect(object, name, unit)
      }
    }
  }

  const mark = (declaration) => {
    if (keys.has(declaration)) read.add(declaration)
    if (
      !objects.has(declaration) &&
      (!ts.isPropertyAssignment(declaration) ||
        !copyFile.test(path.relative(root, declaration.getSourceFile().fileName)))
    )
      return
    for (const member of objectLiteral(declaration.initializer)?.properties ?? []) mark(member)
  }

  const declarationsOf = (node) => {
    const symbol = checker.getSymbolAtLocation(node)
    const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    return target?.declarations ?? []
  }

  const markSymbol = (symbol) => {
    for (const declaration of symbol?.declarations ?? []) mark(declaration)
  }

  const readProperty = (object, name, node, unit, qualifier) => {
    const member = object.getProperty(name)
    if (!member && paths.has(object)) {
      const line = unit.source.getLineAndCharacterOfPosition(node.getStart()).line + 1
      missing.push({ file: unit.file, key: `${paths.get(object)}.${name}`, line, missing: true })
    }
    if (!qualifier) markSymbol(member)
    return member
  }

  const visit = (node, unit, qualifier = false) => {
    if (ts.isTypeNode(node) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isPropertyAccessExpression(node)) {
      readProperty(checker.getTypeAtLocation(node.expression), node.name.text, node, unit, qualifier)
      visit(node.expression, unit, true)
      return
    }
    if (ts.isElementAccessExpression(node)) {
      const index = checker.getTypeAtLocation(node.argumentExpression)
      const variants = index.isUnion() ? index.types : [index]
      const object = checker.getTypeAtLocation(node.expression)
      const literal = variants.every((variant) => variant.isStringLiteral() || variant.isNumberLiteral())
      const members = literal
        ? variants.map((variant) => readProperty(object, String(variant.value), node, unit, qualifier))
        : []
      const resolved =
        members.length > 0 && members.every((member) => member?.declarations?.some(ts.isPropertyAssignment))
      visit(node.expression, unit, resolved || (paths.has(object) && members.every((member) => !member) && literal))
      visit(node.argumentExpression, unit)
      return
    }
    if (ts.isIdentifier(node) && !qualifier) {
      const parent = node.parent
      const declarationName =
        (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isBindingElement(parent)) &&
        (parent.name === node || parent.propertyName === node)
      if (!declarationName) {
        for (const declaration of declarationsOf(node)) if (objects.has(declaration)) mark(declaration)
        const type = checker.getTypeAtLocation(node)
        if (paths.has(type)) for (const member of type.getProperties()) markSymbol(member)
      }
    }
    if (ts.isCallExpression(node) && !qualifier) {
      const type = checker.getTypeAtLocation(node)
      if (paths.has(type)) for (const member of type.getProperties()) markSymbol(member)
    }
    ts.forEachChild(node, (child) => visit(child, unit))
  }
  for (const unit of units.values()) if (!isCopyTest(unit.file)) visit(unit.node, unit)

  const astro = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "apps/site/src/*.astro"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .split("\n")
    .filter(Boolean)
  for (const file of astro) {
    const absolute = path.join(root, file)
    if (!fs.existsSync(absolute)) continue
    const source = fs.readFileSync(absolute, "utf8")
    for (const [, imports, module] of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](\.[^"']+)["']/g)) {
      const imported =
        path.relative(root, path.resolve(path.dirname(absolute), module)).replace(/\.(js|ts)$/, "") + ".ts"
      if (!copyFile.test(imported)) continue
      for (const name of imports.split(",")) {
        const [original, local = original] = name.trim().split(/\s+as\s+/)
        for (const [member, { file: owner, key }] of keys) {
          if (owner !== imported || !key.startsWith(`${original}.`)) continue
          const access = local + key.slice(original.length)
          if (source.includes(access)) read.add(member)
        }
      }
    }
  }

  return [...[...keys].filter(([member]) => !read.has(member)).map(([, key]) => key), ...missing]
}
