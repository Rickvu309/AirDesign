import ts from "typescript"

export function historyFixtureSafetyHits(file:string,source:string):{line:number;reason:string}[]{
  const replay=file.endsWith("/bench/design-parity/history.test.ts")
  const generation=file.endsWith("/bench/design-parity/generate-history-fixtures.ts")
  if(!replay&&!generation)return []
  const allowed=replay ? ["init","fetch","checkout","rev-parse","update-ref"] : ["init","add","commit","branch","checkout","bundle"]
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true)
  const hits:{line:number;reason:string}[]=[]
  function visit(node:ts.Node){
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==="git"){
      const command=node.arguments[0]
      if(!command||!ts.isStringLiteral(command)||!allowed.includes(command.text))hits.push({line:tree.getLineAndCharacterOfPosition(node.getStart()).line+1,reason:"history-fixtures-must-use-reviewed-git-commands-without-config-overrides"})
    }
    ts.forEachChild(node,visit)
  }
  visit(tree)
  return hits
}
