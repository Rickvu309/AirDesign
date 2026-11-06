export const replayLabel = "harness check, not a quality result"
export type Preference = "win" | "tie" | "loss" | "unresolved"
export type Sample = { task: string; sample: number; hard: boolean; content: boolean; editable: boolean; forward: Preference; reverse: Preference }
export function utility(sample: Sample | undefined) {
  if (!sample || !sample.hard || !sample.content || !sample.editable || sample.forward !== sample.reverse) return 0
  return sample.forward === "win" ? 1 : sample.forward === "tie" ? .5 : 0
}
export function summarize(tasks: readonly {id: string; family: string}[], rows: Sample[], seed = 20261106) {
  if (tasks.length !== 48 || new Set(tasks.map(task => task.id)).size !== 48) throw new Error("Expected 48 distinct frozen tasks")
  const counts = [...new Set(tasks.map(task => task.family))].map(family => tasks.filter(task => task.family === family).length)
  if (counts.length !== 6 || counts.some(count => count !== 8)) throw new Error("Expected six families with eight tasks each")
  const keys = new Set<string>()
  for (const row of rows) {
    const key = `${row.task}:${row.sample}`
    if (keys.has(key) || !tasks.some(task => task.id === row.task) || ![0,1,2].includes(row.sample)) throw new Error("Unexpected or duplicate sample")
    keys.add(key)
  }
  const cases = tasks.map(task => {
    const samples = [0,1,2].map(index => rows.find(row => row.task === task.id && row.sample === index))
    const values = samples.map(utility)
    return {...task, mean: values.reduce<number>((a,b) => a+b,0)/3, pass: values.filter(value => value >= .5).length >= 2}
  })
  let state = seed >>> 0
  const random = () => { state = (Math.imul(1664525,state)+1013904223) >>> 0; return state/4294967296 }
  const bootstrap = Array.from({length:10000}, () => Array.from({length:48}, () => cases[Math.floor(random()*48)]!.mean).reduce((a,b) => a+b,0)/48).sort((a,b) => a-b)
  const families = [...new Set(tasks.map(task => task.family))].map(family => ({family,passed:cases.filter(task => task.family === family && task.pass).length}))
  return {seed,resamples:10000,denominator:144,missing:144-rows.length,cases,families,lower95:bootstrap[249]!,upper95:bootstrap[9749]!,passed:cases.filter(task => task.pass).length,thresholdsMet:cases.filter(task => task.pass).length>=44 && families.every(family => family.passed>=7) && bootstrap[249]!>=.5}
}
