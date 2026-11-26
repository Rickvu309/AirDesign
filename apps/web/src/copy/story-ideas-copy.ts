export const storyIdeas = [
  { icon: "chart", words: "Why we beat the plan" },
  { icon: "presenter", words: "Our seed round pitch" },
  { icon: "doc", words: "The case for hiring now" },
  { icon: "chart", words: "The quarter in five numbers" },
  { icon: "presenter", words: "A new project kickoff" },
  { icon: "doc", words: "What customers told us" },
  { icon: "chart", words: "Why we should raise prices" },
  { icon: "presenter", words: "Our product launch plan" },
  { icon: "doc", words: "The year in review" },
] as const

export const ideasPerRound = 3

export function storyIdeasAt(round: number): readonly (typeof storyIdeas)[number][] {
  const start = (round * ideasPerRound) % storyIdeas.length
  return storyIdeas.slice(start, start + ideasPerRound)
}
