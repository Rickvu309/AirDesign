import path from "node:path"

const builtOutput = /^(apps|packages)\/[^/]+\/dist\//

export const sourceOnly = (root) => ({
  name: "source-only",
  enforce: "pre",
  load(id) {
    const file = path.relative(root, id.split("?")[0]).split(path.sep).join("/")
    if (builtOutput.test(file))
      throw new Error(`${file} is built output. Tests read sources, so import the package by its name.`)
    return null
  },
})
