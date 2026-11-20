const repositorySelectors = new Set([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
])

const providerPrefixes = ["ANTHROPIC_", "CLAUDE_", "CODEX_", "OPENAI_"]

const providerNames = new Set(["CLAUDECODE"])

export const isInherited = (name) =>
  repositorySelectors.has(name) || providerNames.has(name) || providerPrefixes.some((prefix) => name.startsWith(prefix))

export const cleanEnvironment = (env) => Object.fromEntries(Object.entries(env).filter(([name]) => !isInherited(name)))

export const stripInherited = (env = process.env) => {
  const removed = Object.keys(env).filter(isInherited)
  for (const name of removed) delete env[name]
  return removed
}
