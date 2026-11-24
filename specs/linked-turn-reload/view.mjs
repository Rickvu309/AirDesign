export function state({ turn, phase, written, alpha, beta }) {
  const other = written === "none" ? (alpha ? "" : ", Alpha deleted elsewhere") : `, ${written} written elsewhere`
  return `${turn} is ${phase}${other}, Beta ${beta ? "present" : "deleted"}`
}
