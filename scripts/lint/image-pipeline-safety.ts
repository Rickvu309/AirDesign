import ts from "typescript"
export function imagePipelineSafetyHits(file:string,source:string):{line:number;reason:string}[]{
  if(!file.endsWith("/server/src/images/store.ts")&&!file.endsWith("/files/src/assets/validate.ts")&&!file.endsWith("/operations/src/index.ts")&&!file.endsWith("bench/templates-images/live.mjs"))return []
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),hits:{line:number;reason:string}[]=[]
  if(file.endsWith("/operations/src/index.ts") && source.includes("UPDATE operations SET state='expired'") && !/CREATE INDEX IF NOT EXISTS operations_expiry ON operations\(state,expires\)/.test(source))hits.push({line:1,reason:"operation-expiry-must-use-metadata-index"})
  function visit(node:ts.Node){
    if(file.endsWith("/files/src/assets/validate.ts") && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text==="sharp" && node.arguments[0]?.getText(tree)==="data")hits.push({line:tree.getLineAndCharacterOfPosition(node.getStart()).line+1,reason:"image-thumbnail-must-use-decoded-raster"})
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
      const sql=node.arguments[0],line=tree.getLineAndCharacterOfPosition(node.getStart()).line+1
      if(["query","prepare"].includes(node.expression.name.text)&&sql&&ts.isStringLiteral(sql)&&/SELECT\s+\*\s+FROM\s+(?:image_asset|operations)\b/i.test(sql.text))hits.push({line,reason:"image-query-must-select-only-needed-columns"})
      if(file.endsWith("/files/src/assets/validate.ts")&&node.expression.name.text==="png"&&node.arguments.length===0)hits.push({line,reason:"image-encode-needs-explicit-compression-budget"})
      if(file.endsWith("bench/templates-images/live.mjs")&&node.expression.name.text==="endsWith"&&sql&&ts.isStringLiteral(sql)&&sql.text===".png")hits.push({line,reason:"native-picture-probe-must-follow-relationship"})
    }
    ts.forEachChild(node,visit)
  }
  visit(tree)
  return hits
}
