import fs from "node:fs"

export const areaMap = JSON.parse(fs.readFileSync(new URL("./areas.json", import.meta.url), "utf8"))

const inArea = ({ paths, except = [] }, file) =>
  paths.some((start) => file.startsWith(start)) && !except.some((start) => file.startsWith(start))

export const areasOf = (files) =>
  Object.entries(areaMap)
    .filter(([, area]) => files.some((file) => inArea(area, file)))
    .map(([name]) => name)
