import { isPublic, manifestFile, packageRootOf, packOf, type Pack, type Workspace } from "./workspace.ts"

export type RuleName = "dependency" | "privacy" | "layer" | "package" | "cycle"

export type Finding = {
  readonly rule: RuleName
  readonly file: string
  readonly line: number
  readonly column: number
  readonly fromPack: string
  readonly toPack: string
  readonly target: string
  readonly message: string
}

export const todoRules: ReadonlySet<RuleName> = new Set(["dependency", "privacy", "layer"])

const crossPack = (workspace: Workspace) =>
  workspace.references.flatMap((reference) => {
    if (reference.target.kind !== "file") return []
    const from = packOf(workspace.packs, reference.file)
    const to = packOf(workspace.packs, reference.target.file)
    if (from === undefined || to === undefined || from === to) return []
    return [{ reference, target: reference.target.file, from, to }]
  })

const rank = (workspace: Workspace, pack: Pack): number =>
  pack.layer === undefined ? -1 : workspace.config.layers.indexOf(pack.layer)

const packFindings = (workspace: Workspace): Finding[] =>
  crossPack(workspace).flatMap(({ reference, target, from, to }) => {
    const at = {
      file: reference.file,
      line: reference.line,
      column: reference.column,
      fromPack: from.name,
      toPack: to.name,
      target,
    }
    const found: Finding[] = []
    const samePackage =
      packageRootOf(workspace.packageRoots, reference.file) === packageRootOf(workspace.packageRoots, target)
    if (samePackage && from.enforceDependencies && !from.dependencies.includes(to.name)) {
      found.push({
        ...at,
        rule: "dependency",
        message: `${from.name} uses ${to.name} (${target}) but does not list it in dependencies; add it to ${from.name}/pack.yml if it should`,
      })
    }
    if (to.enforcePrivacy && !isPublic(to, target)) {
      found.push({
        ...at,
        rule: "privacy",
        message: `${target} is private to ${to.name}; import a public path (${to.publicPaths.join(", ") || "none yet"}) or add this file to its public list`,
      })
    }
    const fromRank = rank(workspace, from)
    const toRank = rank(workspace, to)
    if (from.enforceLayers && fromRank >= 0 && toRank >= 0 && toRank < fromRank) {
      found.push({
        ...at,
        rule: "layer",
        message: `${from.name} (layer ${from.layer}) may not use ${to.name} (layer ${to.layer}), a higher layer; move what it needs into a pack at layer ${from.layer} or lower`,
      })
    }
    return found
  })

const pathFindings = (workspace: Workspace): Finding[] =>
  workspace.references.flatMap((reference) => {
    const target = reference.target
    if (target.kind !== "file" || !reference.specifier.startsWith(".")) return []
    const fromRoot = packageRootOf(workspace.packageRoots, reference.file)
    const toRoot = packageRootOf(workspace.packageRoots, target.file)
    if (fromRoot === undefined || toRoot === undefined || fromRoot === toRoot) return []
    return [
      {
        rule: "package",
        file: reference.file,
        line: reference.line,
        column: reference.column,
        fromPack: packOf(workspace.packs, reference.file)?.name ?? ".",
        toPack: toRoot,
        target: target.file,
        message: `${reference.specifier} reaches into ${toRoot} by path; import it by its package name`,
      },
    ]
  })

const packageFindings = (workspace: Workspace): Finding[] =>
  workspace.references.flatMap((reference) => {
    const target = reference.target
    if (target.kind !== "package" || target.declared === "runtime") return []
    if (target.declared === "dev" && reference.typeOnly) return []
    const from = packOf(workspace.packs, reference.file)
    return [
      {
        rule: "package",
        file: reference.file,
        line: reference.line,
        column: reference.column,
        fromPack: from?.name ?? ".",
        toPack: target.name,
        target: target.name,
        message:
          target.declared === "dev"
            ? `${target.name} is a devDependency but runs here; move it to dependencies`
            : `${target.name} is not in the nearest package.json`,
      },
    ]
  })

export const dependencyCycles = (packs: readonly Pack[]): string[][] => {
  const byName = new Map(packs.map((pack) => [pack.name, pack]))
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const cycles: string[][] = []
  let counter = 0
  const visit = (name: string): void => {
    index.set(name, counter)
    low.set(name, counter)
    counter += 1
    stack.push(name)
    onStack.add(name)
    for (const next of byName.get(name)?.dependencies ?? []) {
      if (!byName.has(next)) continue
      if (!index.has(next)) {
        visit(next)
        low.set(name, Math.min(low.get(name) ?? 0, low.get(next) ?? 0))
      } else if (onStack.has(next)) {
        low.set(name, Math.min(low.get(name) ?? 0, index.get(next) ?? 0))
      }
    }
    if (low.get(name) !== index.get(name)) return
    const component: string[] = []
    let member: string | undefined
    do {
      member = stack.pop()
      if (member === undefined) break
      onStack.delete(member)
      component.push(member)
    } while (member !== name)
    const selfLoop = byName.get(name)?.dependencies.includes(name) ?? false
    if (component.length > 1 || selfLoop) cycles.push(component.sort())
  }
  for (const pack of packs) if (!index.has(pack.name)) visit(pack.name)
  return cycles.sort((left, right) => (left[0] ?? "").localeCompare(right[0] ?? ""))
}

const cycleFindings = (workspace: Workspace): Finding[] =>
  dependencyCycles(workspace.packs).map((cycle) => {
    const first = cycle[0] ?? "."
    return {
      rule: "cycle",
      file: first === "." ? manifestFile : `${first}/${manifestFile}`,
      line: 1,
      column: 1,
      fromPack: first,
      toPack: cycle.at(-1) ?? first,
      target: cycle.join(" -> "),
      message: `dependencies form a cycle: ${[...cycle, first].join(" -> ")}`,
    }
  })

const order = (left: Finding, right: Finding): number =>
  left.file.localeCompare(right.file) ||
  left.line - right.line ||
  left.column - right.column ||
  left.rule.localeCompare(right.rule)

export const findings = (workspace: Workspace): Finding[] =>
  [
    ...cycleFindings(workspace),
    ...packFindings(workspace),
    ...pathFindings(workspace),
    ...packageFindings(workspace),
  ].sort(order)
