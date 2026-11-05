import ts from "typescript"
export function imagePipelineSafetyHits(file:string,source:string):{line:number;reason:string}[]{
  if(!file.endsWith("/server/src/images/store.ts")&&!file.endsWith("/files/src/assets/validate.ts"))return []
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),hits:{line:number;reason:string}[]=[]
  function visit(node:ts.Node){
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
      const sql=node.arguments[0],line=tree.getLineAndCharacterOfPosition(node.getStart()).line+1
      if(node.expression.name.text==="query"&&sql&&ts.isStringLiteral(sql)&&/SELECT\s+\*\s+FROM\s+image_asset\b/i.test(sql.text))hits.push({line,reason:"image-query-must-select-only-needed-columns"})
      if(node.expression.name.text==="png"&&node.arguments.length===0)hits.push({line,reason:"image-encode-needs-explicit-compression-budget"})
    }
    ts.forEachChild(node,visit)
  }
  visit(tree)
  return hits
}
