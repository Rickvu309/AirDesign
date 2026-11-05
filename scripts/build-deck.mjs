import { mkdir, readFile, writeFile } from "node:fs/promises"
import ts from "typescript"
for (const name of ["model", "parse", "apply", "index", "jsx", "fixture"]) {
  const source = await readFile(`packages/deck/src/${name}.ts`, "utf8")
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } })
  await mkdir("packages/deck/dist", { recursive: true })
  await writeFile(`packages/deck/dist/${name}.js`, result.outputText.replaceAll('.ts"', '.js"'))
}
