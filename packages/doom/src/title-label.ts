const structural =
  /^(?:executive summary|summary|next steps|appendix|backup|methodology|glossary|q&a|questions|thank you|introduction|agenda|contents|table of contents|section (?:\d+|[ivxlcdm]+)(?:\s*[:.\-–—].*)?)$/
const bareTopic = /^[\p{L}\p{N}&/'’ -]+$/u
const dimension =
  /\bby (?:region|market|year|segment|country|quarter|month|channel|product|function|category|customer|team|geography|business unit)$/
const topicNouns = new Set(
  "overview summary highlights approach structure strategy plan roadmap breakdown metrics analysis timeline statement recommendations model thesis results performance trends landscape outlook findings steps assessment opportunities risks segments update review background context objectives goals priorities profile kpis dashboard snapshot status scorecard financials forecast budget scope framework options".split(
    " ",
  ),
)
const verbs = new Set(
  "am is are was were be been being has have had do does did can could may might shall should will would must won't can't isn't aren't wasn't weren't doesn't don't didn't rose fell grew led saw went made took held met ran became won lost hit cut beat drove gave got kept left paid sold spent struck stood fought brought bought thought found told shrank sank rethink".split(
    " ",
  ),
)
const connectors = new Set("by of per in for and or vs & to from at on with through across over under".split(" "))

export const normalizeTitle = (title: string) => title.trim().replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase()

export const isStructuralTitle = (title: string) => structural.test(normalizeTitle(title))

export function isTitleLabel(title: string): boolean {
  const normalized = normalizeTitle(title).replace(/’/g, "'")
  if (!bareTopic.test(normalized) || structural.test(normalized)) return false
  const words = normalized.split(" ")
  const [first = ""] = words
  const last = words.at(-1) ?? ""
  if (words.length > 6 || (!topicNouns.has(last) && !dimension.test(normalized))) return false
  if (words.length > 1 && /(?:ize|ise|ify|ate)$/.test(first)) return false
  return !words.some((word, index) => {
    const next = words[index + 1]
    return (
      verbs.has(word) ||
      word.endsWith("ed") ||
      (index > 0 && /^(?:a|an|the)$/.test(word)) ||
      (/[^s]s$/.test(word) && next !== undefined && !connectors.has(next))
    )
  })
}
