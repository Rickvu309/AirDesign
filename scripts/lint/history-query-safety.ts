import ts from "typescript"
export function historyQuerySafetyHits(file: string, source: string): { line: number; reason: string }[] {
  if ((!file.includes("/db/") && !file.includes("/change-log/src/")) || !file.endsWith(".ts")) return []
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const hits: { line: number; reason: string }[] = []
  function visit(node: ts.Node) {
    if(file.endsWith("/db/history-index.ts") && ts.isSpreadAssignment(node) && node.expression.getText(tree)==="event" && ts.isObjectLiteralExpression(node.parent) && ts.isPropertyAssignment(node.parent.parent) && node.parent.parent.name.getText(tree)==="payload")hits.push({line:tree.getLineAndCharacterOfPosition(node.getStart()).line+1,reason:"history-property-index-must-reference-contributions"})
    if(file.endsWith("/change-log/src/index.ts") && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text==="structuredClone" && ["current","patch.after"].includes(node.arguments[0]?.getText(tree) ?? ""))hits.push({line:tree.getLineAndCharacterOfPosition(node.getStart()).line+1,reason:"history-execution-must-copy-only-mutable-state"})
    if(ts.isPropertyAssignment(node) && node.name.getText(tree)==="actor" && /command\.run/.test(node.initializer.getText(tree)))hits.push({line:tree.getLineAndCharacterOfPosition(node.getStart()).line+1,reason:"actor-must-come-from-execution-identity"})
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "query") {
      const sql = node.arguments[0]
      if(file.endsWith("/db/history-index.ts") && sql && ts.isStringLiteral(sql) && /INSERT INTO editing_property/.test(sql.text) && /AS p\([^)]*\b(?:seq|payload)\b/.test(sql.text))hits.push({line:tree.getLineAndCharacterOfPosition(node.getStart()).line+1,reason:"history-property-rows-must-share-event-metadata"})
      if (sql && (ts.isStringLiteral(sql) || ts.isNoSubstitutionTemplateLiteral(sql)) && /;\s*\S/.test(sql.text)) hits.push({line:tree.getLineAndCharacterOfPosition(node.getStart()).line + 1,reason:"prepared-query-must-have-one-statement"})
    }
    ts.forEachChild(node,visit)
  }
  visit(tree)
  return hits
}
