import ts from "typescript"

export function historyFixtureSafetyHits(file:string,source:string):{line:number;reason:string}[]{
  const replay=file.endsWith("/bench/design-parity/history.test.ts")
  const generation=file.endsWith("/bench/design-parity/generate-history-fixtures.ts")
  if(!replay&&!generation)return []
  const allowed=replay ? ["init","fetch","checkout","rev-parse","update-ref"] : ["init","add","commit","branch","checkout","bundle"]
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true)
  const hits:{line:number;reason:string}[]=[]
  const reject=(node:ts.Node)=>hits.push({line:tree.getLineAndCharacterOfPosition(node.getStart()).line+1,reason:"history-fixtures-must-use-reviewed-git-commands-without-config-overrides"})
  function reviewedExecution(node:ts.CallExpression){
    if(node.arguments.length!==3||node.arguments[0]?.getText(tree)!=='"git"'||node.arguments[1]?.getText(tree)!=="args")return false
    let parent:ts.Node|undefined=node.parent
    while(parent&&!ts.isArrowFunction(parent))parent=parent.parent
    if(!parent||!ts.isArrowFunction(parent)||!ts.isVariableDeclaration(parent.parent)||parent.parent.name.getText(tree)!=="git"||parent.parameters.length!==1||!parent.parameters[0]?.dotDotDotToken||parent.parameters[0].name.getText(tree)!=="args")return false
    const options=node.arguments[2]
    if(!options||!ts.isObjectLiteralExpression(options))return false
    return options.properties.every(property=>{
      if(ts.isShorthandPropertyAssignment(property))return property.name.text==="cwd"
      if(!ts.isPropertyAssignment(property)||!ts.isIdentifier(property.name))return false
      if(["encoding","stdio"].includes(property.name.text))return ts.isStringLiteral(property.initializer)
      if(property.name.text!=="env"||!ts.isObjectLiteralExpression(property.initializer))return false
      return property.initializer.properties.every(value=>ts.isSpreadAssignment(value) ? value.expression.getText(tree)==="process.env" : ts.isPropertyAssignment(value)&&ts.isIdentifier(value.name)&&value.name.text==="TMPDIR")
    })
  }
  function visit(node:ts.Node){
    if((ts.isIdentifier(node)||ts.isStringLiteral(node))&&/^GIT_(AUTHOR|COMMITTER|CONFIG)(_|$)/.test(node.text))reject(node)
    if(ts.isStringLiteral(node)&&/^(node:)?child_process$/.test(node.text)&&!ts.isImportDeclaration(node.parent))reject(node)
    if(ts.isIdentifier(node)&&["execFileSync","execFile","execSync","exec","spawn","spawnSync","fork"].includes(node.text)&&!ts.isImportSpecifier(node.parent)&&(!ts.isCallExpression(node.parent)||node.parent.expression!==node))reject(node)
    if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)&&/^(node:)?child_process$/.test(node.moduleSpecifier.text)){
      const bindings=node.importClause?.namedBindings
      if(!bindings||!ts.isNamedImports(bindings)||bindings.elements.some(value=>value.name.text!=="execFileSync"||value.propertyName!==undefined))reject(node)
    }
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==="git"){
      const command=node.arguments[0]
      if(!command||!ts.isStringLiteral(command)||!allowed.includes(command.text)||node.arguments.some(value=>ts.isSpreadElement(value)||ts.isStringLiteral(value)&&/^(--author(?:=|$)|--reset-author$|--no-verify$|-n$|-c$|--config-env(?:=|$))/.test(value.text)))reject(node)
      else if(command.text==="commit"&&(node.arguments.length!==4||node.arguments[1]?.getText(tree)!=='"--allow-empty"'||node.arguments[2]?.getText(tree)!=='"-m"'))reject(node)
    }
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&["execFileSync","execFile","execSync","exec","spawn","spawnSync","fork"].includes(node.expression.text)&&(node.expression.text!=="execFileSync"||!reviewedExecution(node)))reject(node)
    ts.forEachChild(node,visit)
  }
  visit(tree)
  return hits
}
