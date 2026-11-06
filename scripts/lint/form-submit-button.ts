import ts from "typescript"
export function formSubmitButtonHits(file:string,source:string){
  if(!file.endsWith(".tsx")||file.endsWith(".test.tsx"))return []
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),hits:{line:number;reason:string}[]=[]
  function visit(node:ts.Node,inForm:boolean){
    const opening=ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined
    const name=opening?.tagName.getText(tree),attributes=opening?.attributes.properties
    if(inForm&&name==="Button"&&!attributes?.some(attribute=>ts.isJsxAttribute(attribute)&&(attribute.name.getText(tree)==="type"||attribute.name.getText(tree)==="onClick")))hits.push({line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1,reason:"form-action-button-requires-explicit-submit-type"})
    ts.forEachChild(node,child=>visit(child,inForm||name==="form"))
  }
  visit(tree,false)
  return hits
}
