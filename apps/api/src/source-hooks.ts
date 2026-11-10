import { existsSync } from "node:fs"
import { registerHooks } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"

const packages = fileURLToPath(new URL("../../../packages/", import.meta.url))

registerHooks({
  resolve(specifier, context, next) {
    const workspace = /^@airdesign\/([a-z0-9-]+)$/.exec(specifier)
    if (workspace !== null) {
      return { url: pathToFileURL(`${packages}${workspace[1] ?? ""}/src/index.ts`).href, shortCircuit: true }
    }
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL !== undefined) {
      const source = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL)
      if (existsSync(fileURLToPath(source))) return { url: source.href, shortCircuit: true }
    }
    return next(specifier, context)
  },
})
