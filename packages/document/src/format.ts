import { traitNames, traits } from "./traits.js"

export const stamps: { readonly row: number; readonly index: number; readonly command: number } = {
  row: 2,
  index: 25,
  command: 20,
}

const traitVersions = traitNames.reduce((sum, name) => sum + traits[name].stamp.version, 0)

export const format: number = 1 + stamps.row + stamps.index + stamps.command + traitVersions
