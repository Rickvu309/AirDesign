import ts from "typescript"
export function nodeRuntimeSyntaxHits(file: string, source: string): { line: number; reason: string }[] {
  if (!file.endsWith(".ts")) return []
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const hits: { line: number; reason: string }[] = []
  function visit(node: ts.Node) {
    if (ts.isParameter(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword || m.kind === ts.SyntaxKind.PublicKeyword || m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) hits.push({ line: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1, reason: "node-strip-only-parameter-property" })
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return hits
}
