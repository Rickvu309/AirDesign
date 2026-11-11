import fs from "node:fs"
import { registerHooks } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { expectAccepts, expectRejects } from "../harness.js"
import { routePaths } from "./no-route-literal.js"

const packages = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../packages")

registerHooks({
  resolve(specifier, context, nextResolve) {
    const workspace = /^@airdesign\/([a-z-]+)$/.exec(specifier)
    if (workspace) {
      return { url: pathToFileURL(path.join(packages, workspace[1], "src/index.ts")).href, shortCircuit: true }
    }
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL?.endsWith(".ts")) {
      const typed = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL)
      if (fs.existsSync(typed)) return { url: typed.href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})

const { deckPaths, oauthPaths, signInPaths } = await import(
  pathToFileURL(path.join(packages, "catalog/src/index.ts")).href
)

const catalogPaths = [...deckPaths, ...signInPaths, ...oauthPaths].sort()
if (JSON.stringify(catalogPaths) !== JSON.stringify([...routePaths].sort())) {
  throw new Error(
    `no-route-literal holds a path list that differs from @airdesign/catalog\nrule ${JSON.stringify([...routePaths].sort())}\ncatalog ${JSON.stringify(catalogPaths)}`,
  )
}

const rule = { "airdesign/no-route-literal": "error" }
const message = "Take an API path from deckRoutes, signInRoutes or oauthRoutes"
const source = "apps/web/src/decks/home.tsx"

for (const route of catalogPaths) {
  expectRejects(`${route} spelled by hand fails`, source, `export const go = () => fetch("${route}")\n`, rule, message)
}
expectRejects(
  "a template under /decks/ fails",
  source,
  "export const go = (x) => fetch(`/decks/${x}`)\n",
  rule,
  message,
)
expectRejects(
  "a template after a base fails",
  source,
  "export const go = (base, x) => fetch(`${base}/oauth/${x}`)\n",
  rule,
  message,
)
expectRejects(
  "a template that extends a sign-in path fails",
  source,
  "export const go = (x) => fetch(`/sign-in/email?${x}`)\n",
  rule,
  message,
)
expectRejects("a concatenation fails", source, `export const go = (x) => fetch("/decks/" + x)\n`, rule, message)
expectRejects(
  "a concatenation after a base fails",
  source,
  `export const go = (base, x) => fetch(base + "/oauth/" + x)\n`,
  rule,
  message,
)
expectRejects(
  "a path inside new URL fails",
  source,
  `export const go = () => fetch(new URL("/decks/list", window.location.origin))\n`,
  rule,
  message,
)
expectRejects(
  "a path held in a const first fails",
  source,
  `const listPath = "/decks/list"\nexport const go = () => fetch(listPath)\n`,
  rule,
  message,
)
expectRejects(
  "a path in a site file fails",
  "apps/site/src/access/sign-in-requests.ts",
  `export const go = () => fetch("/sign-in/code")\n`,
  rule,
  message,
)
expectAccepts("a page link stays", source, `export const href = "/sign-in"\n`, rule)
expectAccepts("the check page stays", source, `export const next = "/sign-in/check"\n`, rule)
expectAccepts("the oauth page stays", source, `export const page = (path) => path === "/oauth/authorize"\n`, rule)
expectAccepts(
  "a path from the catalog stays",
  source,
  `import { deckRoutes } from "@airdesign/catalog"\nexport const go = (x) => fetch(\`\${deckRoutes.list.path}?\${x}\`)\n`,
  rule,
)
expectAccepts(
  "the catalog may spell its paths",
  "packages/catalog/src/deck-routes.ts",
  `export const p = "/decks/list"\n`,
  rule,
)
expectAccepts("a test may spell a path", "apps/web/src/decks/home.test.tsx", `export const p = "/decks/list"\n`, rule)
expectAccepts("a proof may spell a path", "apps/web/src/decks/home.proof.ts", `export const p = "/decks/list"\n`, rule)
expectAccepts(
  "the smoke probe may spell the production paths it calls",
  "scripts/smoke.mjs",
  "export const p = (origin) => `${origin}/decks/open`\n",
  rule,
)
expectRejects(
  "another script fails",
  "scripts/second.mjs",
  "export const p = (origin) => `${origin}/decks/open`\n",
  rule,
  message,
)
expectAccepts("a spec may spell a path", "tests/decks.spec.ts", "export const p = (x) => `/decks/${x}`\n", rule)
