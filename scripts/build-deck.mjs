import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"
import { spawnSync } from "node:child_process"
for (const file of (await readdir("packages/deck/src", {recursive: true})).filter(name => name.endsWith(".ts"))) {
  const name = file.slice(0, -3)
  const source = await readFile(`packages/deck/src/${file}`, "utf8")
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } })
  await mkdir(path.dirname(`packages/deck/dist/${name}.js`), { recursive: true })
  await writeFile(`packages/deck/dist/${name}.js`, result.outputText.replaceAll('.ts"', '.js"'))
}
const declarations = spawnSync("npx", ["tsc", "--declaration", "--emitDeclarationOnly", "--noEmit", "false", "--allowImportingTsExtensions", "--module", "esnext", "--moduleResolution", "bundler", "--target", "es2023", "--skipLibCheck", "--outDir", "packages/deck/dist", "packages/deck/src/index.ts", "packages/deck/src/jsx.ts", "packages/deck/src/text/index.ts"], { stdio: "inherit" })
if (declarations.status !== 0) process.exit(declarations.status ?? 1)
