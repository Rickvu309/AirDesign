import fs from "node:fs"

export const text = fs.readFileSync("order.txt", "utf8")
