import { mkdir, readFile, writeFile } from "node:fs/promises"
import ts from "typescript"
import { spawnSync } from "node:child_process"
for (const name of ["model", "parse", "apply", "index", "jsx", "fixture"]) {
  const source = await readFile(`packages/deck/src/${name}.ts`, "utf8")
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } })
  await mkdir("packages/deck/dist", { recursive: true })
  await writeFile(`packages/deck/dist/${name}.js`, result.outputText.replaceAll('.ts"', '.js"'))
}
const declarations = spawnSync("npx", ["tsc", "--declaration", "--emitDeclarationOnly", "--noEmit", "false", "--allowImportingTsExtensions", "--module", "esnext", "--moduleResolution", "bundler", "--target", "es2023", "--skipLibCheck", "--outDir", "packages/deck/dist", "packages/deck/src/index.ts", "packages/deck/src/jsx.ts"], { stdio: "inherit" })
if (declarations.status !== 0) process.exit(declarations.status ?? 1)
