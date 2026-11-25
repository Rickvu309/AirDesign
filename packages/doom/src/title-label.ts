const topic =
  /^(?:(?:market|business|industry|project|company|product|financial) overview|(?:executive|financial|project) summary|overview of (?:the )?(?:market|business|project|results)|(?:q[1-4]|fy ?\d{2,4}|annual|quarterly) (?:results|performance)|(?:total |net |gross )?(?:revenue|sales|profit|costs?|volume|spend|growth|headcount|retention) by (?:region|market|year|segment|country|quarter))$/i

export function isTitleLabel(title: string): boolean {
  return topic.test(title.trim().replace(/\s+/g, " ").replace(/\.$/, ""))
}
